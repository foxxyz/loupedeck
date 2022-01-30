const EventEmitter = require('events')
const { createCanvas } = require('canvas')
const rgba = require('color-rgba')
const {
    HEADERS,
    CONNECTION_TIMEOUT,
    BRIGHTNESS_LEVELS,
    BUTTONS,
    DISPLAYS,
    HAPTIC,
    RECONNECT_INTERVAL
} = require('../constants')

class LoupedeckDevice extends EventEmitter {
    constructor() {
        super()
        this.transactionID = 0
        this.touches = {}
        this.handlers = {
            [HEADERS.BUTTON_PRESS]: this.onButton.bind(this),
            [HEADERS.KNOB_ROTATE]: this.onRotate.bind(this),
            [HEADERS.SERIAL]: this.onSerial.bind(this),
            [HEADERS.TICK]: this.onTick.bind(this),
            [HEADERS.TOUCH]: this.onTouch.bind(this, 'touchmove'),
            [HEADERS.TOUCH_END]: this.onTouch.bind(this, 'touchend'),
            [HEADERS.VERSION]: this.onVersion.bind(this),
        }
        // Track last interaction time
        this.lastTick = Date.now()
        // How long until declaring a timed out connetion
        this.connectionTimeout = CONNECTION_TIMEOUT
        // How long between reconnect attempts
        this.reconnectInterval = RECONNECT_INTERVAL
        // Track pending transactions
        this.pendingTransactions = {}
    }
    checkConnected() {
        this._keepAliveTimer = setTimeout(this.checkConnected.bind(this), this.connectionTimeout * 2)
        if (Date.now() - this.lastTick > this.connectionTimeout) this.connection.terminate()
    }
    close() {
        clearTimeout(this._reconnectTimer)
        if (!this.connection) return
        this.connection.close()
    }
    connect() {
        throw new Error('Implement connect in child class')
    }
    // Create a canvas with correct dimensions and pass back for drawing
    async drawCanvas({ id, width, height, x = 0, y = 0, autoRefresh = true }, cb) {
        const displayInfo = DISPLAYS[id]
        if (!width) width = displayInfo.width
        if (!height) height = displayInfo.height

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
        await this.send(HEADERS.WRITE_FRAMEBUFF, Buffer.concat([displayInfo.id, header, canvas.toBuffer('raw')]), { track: true })

        // Draw to display
        if (autoRefresh) await this.refresh(id)
    }
    // Draw to a specific key index (0-12)
    drawKey(index, cb) {
        // Get offset x/y for key index
        const width = 90
        const height = 90
        const x = index % 4 * width
        const y = Math.floor(index / 4) * height
        return this.drawCanvas({ id: 'center', x, y, width, height }, cb)
    }
    // Draw to a specific screen
    drawScreen(id, cb) {
        return this.drawCanvas({ id }, cb)
    }
    async getInfo() {
        return {
            serial: await this.send(HEADERS.SERIAL, undefined, { track: true }),
            version: await this.send(HEADERS.VERSION, undefined, { track: true })
        }
    }
    onButton(buff) {
        const id = BUTTONS[buff[0]]
        const event = buff[1] === 0x00 ? 'down' : 'up'
        this.emit(event, { id })
    }
    onConnect() {
        this.emit('connect', this)
        this._keepAliveTimer = setTimeout(this.checkConnected.bind(this), this.connectionTimeout * 2)
        this._connectionResolver()
    }
    onDisconnect(error) {
        if (error === 1006) error = new Error('Connection timeout - was the device disconnected?')
        this.emit('disconnect', error)
        clearTimeout(this._keepAliveTimer)
        // Normal disconnect, do not reconnect
        if (error === 1000) return
        this._reconnectTimer = setTimeout(this.connect.bind(this), this.reconnectInterval)
    }
    onReceive(buff) {
        const header = buff.readUInt16BE()
        const handler = this.handlers[header]
        const transactionID = buff[2]
        const response = handler ? handler(buff.slice(3)) : buff
        const resolver = this.pendingTransactions[transactionID]
        if (resolver) resolver(response)
        return response
    }
    onRotate(buff) {
        const id = BUTTONS[buff[0]]
        const delta = buff.readInt8(1)
        this.emit('rotate', { id, delta })
    }
    onSerial(buff) {
        return buff.toString().trim()
    }
    onTick() {
        this.lastTick = Date.now()
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
    onVersion(buff) {
        return `${buff[0]}.${buff[1]}.${buff[2]}`
    }
    // Display the current framebuffer
    refresh(id) {
        const displayInfo = DISPLAYS[id]
        return this.send(HEADERS.DRAW, displayInfo.id, { track: true })
    }
    send(action, data = Buffer.alloc(0), { track = false } = {}) {
        //if (this.connection.readyState !== this.connection.OPEN) return
        this.transactionID = (this.transactionID + 1) % 256
        // Skip transaction ID's of zero since the device seems to ignore them
        if (this.transactionID === 0) this.transactionID++
        const header = Buffer.alloc(3)
        header.writeUInt16BE(action)
        header[2] = this.transactionID
        const packet = Buffer.concat([header, data])
        this._send(packet)
        if (track) {
            return new Promise(res => {
                this.pendingTransactions[this.transactionID] = res
            })
        }
    }
    _send(buff) {
        throw new Error('Implement _send in child class')
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

module.exports = { LoupedeckDevice }