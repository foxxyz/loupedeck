const { networkInterfaces } = require('os')
const EventEmitter = require('events')
const { createCanvas } = require('canvas')
const rgba = require('color-rgba')
const WebSocket = require('ws')
const { HEADERS, BRIGHTNESS_LEVELS, BUTTONS, DISPLAYS, HAPTIC } = require('./constants')

class LoupedeckDevice extends EventEmitter {
    constructor({ host, autoConnect = true } = {}) {
        super()
        this.host = host
        this.transactionID = 0
        this.touches = {}
        this.handlers = {
            [HEADERS.BUTTON_PRESS]: this.onButton.bind(this),
            [HEADERS.KNOB_ROTATE]: this.onRotate.bind(this),
            [HEADERS.TOUCH]: this.onTouch.bind(this, 'touchmove'),
            [HEADERS.TOUCH_END]: this.onTouch.bind(this, 'touchend')
        }
        if (autoConnect) this.connect().catch(console.error)
    }
    async connect() {
        const host = this.host || autoDiscover()
        this.address = `ws://${host}`
        this.connection = new WebSocket(this.address)
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
function autoDiscover() {
    const interfaces = Object.values(networkInterfaces()).flat()
    const iface = interfaces.find(i => i.address.startsWith('100.127'))
    if (!iface) throw new Error('No Loupedeck devices found!')
    return iface.address.replace(/.2$/, '.1')
}

module.exports = { LoupedeckDevice }