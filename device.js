const { networkInterfaces } = require('os')
const EventEmitter = require('events')
const WebSocket = require('ws')

// ...it really does seem to go up to 11
const BRIGHTNESS_LEVELS = 11

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
    CONFIRM:         0x0302,
    TICK:            0x0400,
    SET_BRIGHTNESS:  0x0409,
    SET_VIBRATION:   0x041b,
    BUTTON_PRESS:    0x0500,
    KNOB_ROTATE:     0x0501,
    SET_COLOR:       0x0702,
    TOUCH:           0x094d,
    TOUCH_END:       0x096d
}

const HAPTIC = {
    SHORT:       0x01,
    MEDIUM:      0x0a,
    LONG:        0x0f,
    LOW:         0x31,
    SHORT_LOW:   0x32,
    SHORT_LOWER: 0x33,
    LOWER:       0x40,
    LOWEST:      0x41,
    DESCEND_SLOW:0x46,
    DESCEND_MED: 0x47,
    DESCEND_FAST:0x48,
    ASCEND_SLOW: 0x52,
    ASCEND_MED:  0x53,
    ASCEND_FAST: 0x58,
    REV_SLOWEST: 0x5e,
    REV_SLOW:    0x5f,
    REV_MED:     0x60,
    REV_FAST:    0x61,
    REV_FASTER:  0x62,
    REV_FASTEST: 0x63,
    RISE_FALL:   0x6a,
    BUZZ:        0x70,
    RUMBLE5:     0x77, // lower frequencies in descending order
    RUMBLE4:     0x78,
    RUMBLE3:     0x79,
    RUMBLE2:     0x7a,
    RUMBLE1:     0x7b,
    VERY_LONG:   0x76, // 10 sec high freq (!)
}

class LoupedeckDevice extends EventEmitter {
    constructor({ ip } = {}) {
        super()
        this.url = `ws://${ip}`
        this.transactionID = 0
        this.handlers = {
            [HEADERS.BUTTON_PRESS]: this.onButton.bind(this),
            [HEADERS.KNOB_ROTATE]: this.onRotate.bind(this),
            [HEADERS.TOUCH]: this.onTouch.bind(this, 'touch'),
            [HEADERS.TOUCH_END]: this.onTouch.bind(this, 'touchend')
        }
    }
    connect() {
        this.connection = new WebSocket(this.url)
        this.connection.on('open', this.onConnect.bind(this))
        this.connection.on('message', this.onReceive.bind(this))
    }
    onButton(buff) {
        const id = BUTTONS[buff[0]]
        const event = buff[1] === 0x00 ? 'down' : 'up'
        this.emit(event, { id })
    }
    onConnect() {
        this.emit('connect', this)
    }
    onReceive(buff) {
        const header = buff.readUInt16BE()
        const handler = this.handlers[header]
        if (!handler) return
        handler(buff.slice(3))
    }
    onRotate(buff) {
        const id = BUTTONS[buff[0]]
        const delta = buff.readInt8(1)
        this.emit('rotate', { id, delta })
    }
    onTouch(event, buff) {
        const x = buff.readUInt16BE(1)
        const y = buff.readUInt16BE(3)
        this.emit(event, { x, y })
    }
    send(action, data) {
        this.transactionID = (this.transactionID + 1) % 0xff
        const header = Buffer.alloc(3)
        header.writeUInt16BE(action)
        header[2] = this.transactionID
        const packet = Buffer.concat([header, data])
        this.connection.send(packet)
    }
    setBrightness(value) {
        const byte = Math.max(0, Math.min(BRIGHTNESS_LEVELS, Math.round(value * BRIGHTNESS_LEVELS)))
        this.send(HEADERS.SET_BRIGHTNESS, Buffer.from([byte]))
    }
    setColor({ id, r, g, b }) {
        const key = Object.keys(BUTTONS).find(k => BUTTONS[k] === id)
        if (!key) throw new Error(`Invalid button ID: ${id}`)
        const data = Buffer.from([key, r, g, b])
        this.send(HEADERS.SET_COLOR, data)
    }
    vibrate(pattern = HAPTIC.SHORT) {
        this.send(HEADERS.SET_VIBRATION, Buffer.from([pattern]))
    }
}

// Automatically find Loupedeck IP by scanning network interfaces
function openLoupedeck() {
    const interfaces = Object.values(networkInterfaces()).flat()
    const iface = interfaces.find(i => i.address.startsWith('100.127'))
    if (!iface) throw new Error('No Loupedeck devices found!')
    const ip = iface.address.replace(/.2$/, '.1')
    const device = new LoupedeckDevice({ ip })
    device.connect()
    return device
}

module.exports = { openLoupedeck, LoupedeckDevice, HAPTIC }