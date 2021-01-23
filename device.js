const { networkInterfaces } = require('os')
const EventEmitter = require('events')
const { createCanvas } = require('canvas')
const rgba = require('color-rgba')
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

const DISPLAYS = {
    center: { id: Buffer.from('\x00A'), width: 360, height: 270 }, // "A"
    left: { id: Buffer.from('\x00L'), width: 60, height: 270 }, // "L"
    right: { id: Buffer.from('\x00R'), width: 60, height: 270 }, // "R"
}

const HEADERS = {
    CONFIRM:         0x0302,
    TICK:            0x0400,
    SET_BRIGHTNESS:  0x0409,
    SET_VIBRATION:   0x041b,
    BUTTON_PRESS:    0x0500,
    KNOB_ROTATE:     0x0501,
    DRAW:            0x050f,
    SET_COLOR:       0x0702,
    TOUCH:           0x094d,
    TOUCH_END:       0x096d,
    WRITE_FRAMEBUFF: 0xff10
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
    constructor({ ip }) {
        super()
        this.url = `ws://${ip}`
        this.transactionID = 0
        this.touches = {}
        this.handlers = {
            [HEADERS.BUTTON_PRESS]: this.onButton.bind(this),
            [HEADERS.KNOB_ROTATE]: this.onRotate.bind(this),
            [HEADERS.TOUCH]: this.onTouch.bind(this, 'touchmove'),
            [HEADERS.TOUCH_END]: this.onTouch.bind(this, 'touchend')
        }
    }
    async connect() {
        this.connection = new WebSocket(this.url)
        this.connection.on('open', this.onConnect.bind(this))
        this.connection.on('message', this.onReceive.bind(this))
        return new Promise(res => {
            this._connectionResolver = res
        })
    }
    // Display the current framebuffer
    draw(displayID) {
        this.send(HEADERS.DRAW, displayID)
    }
    // Create a canvas with correct dimensions and pass back for drawing
    drawCanvas({ id, width, height, x = 0, y = 0 }, cb) {
        const canvas = createCanvas(width, height)
        const ctx = canvas.getContext('2d', { pixelFormat: 'RGB16_565' }) // Loupedeck uses 16-bit (5-6-5) LE RGB colors
        cb(ctx, width, height)

        // Header with x/y/w/h and display ID
        const header = Buffer.alloc(8)
        header.writeUInt16BE(x, 0)
        header.writeUInt16BE(y, 2)
        header.writeUInt16BE(width, 4)
        header.writeUInt16BE(height, 6)

        // Write to frame buffer
        this.send(HEADERS.WRITE_FRAMEBUFF, Buffer.concat([id, header, canvas.toBuffer('raw')]))

        // Draw to display
        this.draw(id)
    }
    // Draw to a specific key index (0-12)
    drawKey(index, cb) {
        // Get offset x/y for key index
        const width = 90
        const height = 90
        const x = (index % 4) * width
        const y = Math.floor(index / 4) * height
        return this.drawCanvas({ id: DISPLAYS.center.id, x, y, width, height }, cb)
    }
    // Draw to a specific screen
    drawScreen(id, cb) {
        return this.drawCanvas(DISPLAYS[id], cb)
    }
    onButton(buff) {
        const id = BUTTONS[buff[0]]
        const event = buff[1] === 0x00 ? 'down' : 'up'
        this.emit(event, { id })
    }
    onConnect() {
        this.emit('connect', this)
        this._connectionResolver()
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
        const id = buff[5]

        // Determine target
        const screen = x < 60 ? 'left' : x >= 420 ? 'right' : 'center'
        let key
        if (screen === 'center') {
            const column = Math.floor((x - 60) / 90)
            const row = Math.floor(y / 90)
            key = row * 4 + column
        }

        // Create touch
        const touch = { x, y, id, target: { screen, key } }

        // End touch, remove from local cache
        if (event === 'touchend') {
            delete this.touches[touch.id]
        }
        else {
            // First time seeing this touch, emit touchstart instead of touchmove
            if (!this.touches[touch.id]) event = 'touchstart'
            this.touches[touch.id] = touch
        }

        this.emit(event, { touches: Object.values(this.touches), changedTouches: [touch] })
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
    setButtonColor({ id, color }) {
        const key = Object.keys(BUTTONS).find(k => BUTTONS[k] === id)
        if (!key) throw new Error(`Invalid button ID: ${id}`)
        const [r, g, b] = rgba(color)
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