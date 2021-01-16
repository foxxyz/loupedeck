const { networkInterfaces } = require('os')
const EventEmitter = require('events')
const WebSocket = require('ws')

const BUTTONS = {
    0x01: 'knobTL',
    0x02: 'knobCL',
    0x03: 'knobBL',
    0x04: 'knobTR',
    0x05: 'knobCR',
    0x06: 'knobBR',
    0x07: 'circle',
    0x08: '1',
    0x09: '2',
    0x0a: '3',
    0x0b: '4',
    0x0c: '5',
    0x0d: '6',
    0x0e: '7'
}

const HEADERS = {
    CONFIRM: 0x03,
    TICK: 0x04,
    BUTTON: 0x05,
    COLOR: 0x07,
    TOUCH: 0x09
}

class LoupedeckDevice extends EventEmitter {
    constructor({ ip }) {
        super()
        this.url = `ws://${ip}`
        this.connection = new WebSocket(this.url)
        this.connection.on('open', this.onConnect.bind(this))
        this.connection.on('message', this.onReceive.bind(this))
        this.handlers = {
            [HEADERS.BUTTON]: this.onButton.bind(this),
            [HEADERS.TOUCH]: this.onTouch.bind(this)
        }
    }
    onButton(buff) {
        // Rotation dial
        if (buff[1] === 0x01) {
            const id = BUTTONS[buff[3]]
            const delta = buff.readInt8(4)
            this.emit('rotate', { id, delta })
        }
        // Button press
        else {
            const id = BUTTONS[buff[3]]
            const event = buff[4] === 0x00 ? 'down' : 'up'
            this.emit(event, { id })
        }
    }
    onConnect() {
        this.emit('connect', this)
    }
    onReceive(buff) {
        const handler = this.handlers[buff[0]]
        if (!handler) return
        handler(buff)
    }
    onTouch(buff) {
        const event = buff[1] === 0x6d ? 'touchend' : 'touch'
        const x = buff.readUInt16BE(4)
        const y = buff.readUInt16BE(6)
        this.emit(event, { x, y })
    }
    setColor({ id, r, g, b }) {
        const key = Object.keys(BUTTONS).find(k => BUTTONS[k] === id)
        if (!key) throw new Error(`Invalid button ID: ${id}`)
        const buff = Buffer.from([HEADERS.COLOR, 0x02, 0x01, key, r, g, b])
        this.connection.send(buff)
    }
}

// Automatically find Loupedeck IP by scanning network interfaces
function openLoupedeck() {
    const interfaces = Object.values(networkInterfaces()).flat()
    const iface = interfaces.find(i => i.address.startsWith('100.127'))
    if (!iface) throw new Error('No Loupedeck devices found!')
    const ip = iface.address.replace(/.2$/, '.1')
    return new LoupedeckDevice({ ip })
}

module.exports = { openLoupedeck, LoupedeckDevice }