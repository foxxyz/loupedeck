import { Emitter as EventEmitter } from 'strict-event-emitter'

const WS_UPGRADE_HEADER = `GET /index.html
HTTP/1.1
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Key: 123abc

`
const WS_UPGRADE_RESPONSE = 'HTTP/1.1'

// TransformStream version of ../parser.js
class MagicByteLengthParser {
    constructor({ magicByte }) {
        this.buffer = Buffer.alloc(0)
        this.delimiter = magicByte
    }
    transform(chunk, controller) {
        let data = Buffer.concat([this.buffer, chunk])
        let position
        while ((position = data.indexOf(this.delimiter)) !== -1) {
            // We need to at least be able to read the length byte
            if (data.length < position + 2) break
            const nextLength = data[position + 1]
            // Make sure we have enough bytes to meet this length
            const expectedEnd = position + nextLength + 2
            if (data.length < expectedEnd) break
            controller.enqueue(data.slice(position + 2, expectedEnd))
            data = data.slice(expectedEnd)
        }
        this.buffer = data
    }
    flush(controller) {
        controller.enqueue(this.buffer)
    }
}

// Async pipeline transformer that splits a stream by 0x82 magic bytes
async function *read(port, { signal }) {
    const transformer = new TransformStream(new MagicByteLengthParser({ magicByte: 0x82 }))
    const transformed = port.readable.pipeThrough(transformer, { signal })
    const reader = transformed.getReader()
    try {
        while (true) {
            const { value, done } = await reader.read()
            if (done) break
            yield value
        }
    } catch (error) {
        console.error('error', error)
    } finally {
        reader.releaseLock()
    }
}

export default class LoupedeckWebSerialConnection extends EventEmitter {
    constructor({ port } = {}) {
        super()
        this.port = port
        navigator.serial.addEventListener('disconnect', this.onDisconnect.bind(this))
    }
    // Automatically find Loupedeck Serial device by scanning ports
    static async discover() {
        // Return authorized ports if available
        const ports = await navigator.serial.getPorts()
        if (!ports.length) {
            // Request a new port
            try {
                ports.push(await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x2ec2 }, { usbVendorId: 0x1532 }] }))
            } catch (e) {
                console.warn('Unable to open port!')
            }
        }
        const connections = []
        for (const port of ports) {
            const info = await port.getInfo()
            connections.push({
                connectionType: this,
                port,
                productId: info.usbProductId,
                vendorId: info.usbVendorId,
            })
        }
        return connections
    }
    async close() {
        this.aborter.abort('Manual close initiated')
        await new Promise(res => this.on('readEnd', res))
        this.writer.close()
        this.writer.releaseLock()
        // Without the line below, the serialport will refuse to close with
        // "TypeError: Failed to execute 'close': Cannot cancel a locked stream"
        //
        // However, the port.readable stream should have been unlocked via reader.releaseLock() (see read() above)
        //
        // Apparently it unlocks after a one tick propagation (due to pipeThrough()), but there doesn't
        // seem to be a promise anywhere to await this happening...
        //
        // Annoyingly, we have to wait one tick here which is really hacky,
        // and we should find a way to do this more robustly
        await new Promise(res => setTimeout(res, 10))
        await this.port.close()
    }
    async connect() {
        if (!this.isReady()) {
            await this.port.open({ baudRate: 256000 })
        }

        const reader = this.port.readable.getReader()
        this.writer = this.port.writable.getWriter()

        // Wait for the "websocket" handshake over serial (...)
        const nextMessage = reader.read()
        this.send(Buffer.from(WS_UPGRADE_HEADER), true)
        const { value: response } = await nextMessage
        const stringResponse = new TextDecoder().decode(response)
        if (!stringResponse.startsWith(WS_UPGRADE_RESPONSE)) throw new Error(`Invalid handshake response: ${stringResponse}`)
        reader.releaseLock()

        // Set up data pipeline
        this.aborter = new AbortController()
        this.readStream = read(this.port, this.aborter)
        this.emit('connect', { address: 'web' })
        this.read()
    }
    isReady() {
        return this.port && this.port.readable
    }
    onDisconnect(err) {
        // TODO
        this.emit('disconnect', err)
    }
    onError(err) {
        // TODO
        console.error(`Loupedeck Serial Error: ${err.message}`)
        this.onDisconnect(err)
    }
    async read() {
        for await (const message of this.readStream) {
            if (!this.port.readable) break
            this.emit('message', message)
        }
        this.emit('readEnd')
    }
    send(buff, raw = false) {
        if (!raw) {
            let prep
            // Large messages
            if (buff.length > 0xff) {
                prep = Buffer.alloc(14)
                prep[0] = 0x82
                prep[1] = 0xff
                prep.writeUInt32BE(buff.length, 6)
            // Small messages
            } else {
                // Prepend each message with a send indicating the length to come
                prep = Buffer.alloc(6)
                prep[0] = 0x82
                prep[1] = 0x80 + buff.length
            }
            this.writer.write(prep)
        }
        return this.writer.write(buff)
    }
}
