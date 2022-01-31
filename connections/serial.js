const EventEmitter = require('events')
const SerialPort = require('serialport')

const MagicByteLengthParser = require('../parser')
const {
    HEADERS_V2,
} = require('../constants')

const WS_UPGRADE_HEADER = `GET /index.html
HTTP/1.1
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Key: 123abc

`
const WS_UPGRADE_RESPONSE = 'HTTP/1.1'

class LoupedeckSerialConnection extends EventEmitter {
    constructor({ path } = {}) {
        super()
        this.path = path
    }
    // Automatically find Loupedeck Serial device by scanning ports
    static async discover() {
        for(const { manufacturer, path } of await SerialPort.list()) {
            if (manufacturer === 'Loupedeck') return { path }
        }
    }
    connect() {
        this.address = this.path
        this.connection = new SerialPort(this.address, { baudRate: 256000 })
        this.connection.on('error', this.onError.bind(this))
        this.connection.on('open', this.onConnect.bind(this))
        this.connection.on('close', this.onDisconnect.bind(this))
        return new Promise(res => {
            this._connectionResolver = res
        })
    }
    isReady() {
        return true
    }
    async onConnect() {
        // Wait for the "websocket" handshake over serial (...)
        await new Promise((res, rej) => {
            this.connection.once('data', buff => {
                if (buff.toString().startsWith(WS_UPGRADE_RESPONSE)) res()
                else rej('Invalid handshake response: ', buff)
            })
            this.send(Buffer.from(WS_UPGRADE_HEADER), true)
        })

        // Set up data pipeline
        const parser = new MagicByteLengthParser({ magicByte: 0x82 })
        this.connection.pipe(parser)
        parser.on('data', this.emit.bind(this, 'message'))

        this.emit('connect', this)
        this._connectionResolver()
    }
    onDisconnect(err) {
        this.emit('disconnect', err)
    }
    onError(err) {
        console.error(`Loupedeck Serial Error: ${err.message}`)
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
            }
            // Small messages
            else {
                // Prepend each message with a send indicating the length to come
                prep = Buffer.alloc(6)
                prep[0] = 0x82
                prep[1] = 0x80 + buff.length
            }
            this.connection.write(prep)
        }
        this.connection.write(buff)
    }
}

module.exports = LoupedeckSerialConnection