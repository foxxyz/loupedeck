const SerialPort = require('serialport')

const { LoupedeckDevice } = require('./base')
const {
    HEADERS_V2,
} = require('../constants')

const WS_UPGRADE_HEADER = `GET /index.html
HTTP/1.1
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Key: aaa

`

class LoupedeckSerialDevice extends LoupedeckDevice {
    constructor({ path, autoConnect = true } = {}) {
        super()
        this.path = path
        // Connect automatically if desired
        if (autoConnect) this.connect().catch(console.error)
    }
    async connect() {
        const path = this.path || (await autoDiscover()).path
        this.address = path
        this.connection = new SerialPort(path, {
            baudRate: 115200
        })
        this.connection.on('open', this.onConnect.bind(this))
        this.connection.on('data', this.onReceive.bind(this))
        this.connection.on('close', this.onDisconnect.bind(this))
        this.connection.on('error', err => {
            console.error('Error', err)
        })
        return new Promise(res => {
            this._connectionResolver = res
        })
    }
    async getInfo() {
        return {
            serial: await this.send(HEADERS_V2.SERIAL, undefined, { track: true }),
            version: await this.send(HEADERS_V2.VERSION, undefined, { track: true })
        }
    }
    onConnect() {
        this._send(Buffer.from(WS_UPGRADE_HEADER), true)
    }
    onReceive(buff) {
        // First two bytes seem to be a header (always 0x82) and a length byte
        // TODO: Use a proper parser here since some messages get cut off with the default parser
        if (buff[0] === 0x82 && buff.length > 4) return super.onReceive(buff.slice(2))
        if (buff.toString().startsWith('HTTP/1.1')) {
            this.emit('connect', this)
            this._connectionResolver()
        }
    }
    _send(buff, raw = false) {
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

// Automatically find Loupedeck Serial device by scanning ports
async function autoDiscover() {
    for(const device of await SerialPort.list()) {
        if (device.manufacturer === 'Loupedeck') return device
    }
    throw new Error('No Loupedeck devices found!')
}

module.exports = { LoupedeckSerialDevice }