const EventEmitter = require('events')
const rgba = require('color-rgba')

let SerialConnection, WSConnection
if (typeof navigator !== 'undefined') {
    SerialConnection = require('./connections/web-serial')
} else {
    SerialConnection = require('./connections/serial')
    WSConnection = require('./connections/ws')
}

const {
    BUTTONS,
    COMMANDS,
    DEFAULT_RECONNECT_INTERVAL,
    HAPTIC,
    MAX_BRIGHTNESS,
} = require('./constants')

const { rgba2rgb565 } = require('./util')

class LoupedeckDevice extends EventEmitter {
    static async list({ ignoreSerial = false, ignoreWebsocket = false } = {}) {
        const ps = []

        if (!ignoreSerial) ps.push(SerialConnection.discover())
        if (!ignoreWebsocket && WSConnection) ps.push(WSConnection.discover())

        // Run them in parallel
        const rawDevices = await Promise.all(ps)

        return rawDevices.flat()
    }
    constructor({ host, path, autoConnect = true, reconnectInterval = DEFAULT_RECONNECT_INTERVAL } = {}) {
        super()
        this.transactionID = 0
        this.touches = {}
        this.handlers = {
            [COMMANDS.BUTTON_PRESS]: this.onButton.bind(this),
            [COMMANDS.KNOB_ROTATE]: this.onRotate.bind(this),
            [COMMANDS.SERIAL]: this.onSerial.bind(this),
            [COMMANDS.TICK]: () => {},
            [COMMANDS.TOUCH]: this.onTouch.bind(this, 'touchmove'),
            [COMMANDS.TOUCH_END]: this.onTouch.bind(this, 'touchend'),
            [COMMANDS.VERSION]: this.onVersion.bind(this),
            [COMMANDS.TOUCH_CT]: this.onTouch.bind(this, 'touchmove'),
            [COMMANDS.TOUCH_END_CT]: this.onTouch.bind(this, 'touchend'),
        }
        // Track pending transactions
        this.pendingTransactions = {}
        // How long between reconnect attempts
        this.reconnectInterval = reconnectInterval
        // Host for websocket connections
        this.host = host
        // Path for serial connections
        this.path = path
        // Automatically connect?
        if (autoConnect) this._connectBlind()
    }
    close() {
        if (!this.connection) return
        return this.connection.close()
    }
    async connect() {
        // Explicitly asked for a serial connection (V0.2.X)
        if (this.path) this.connection = new SerialConnection({ path: this.path })
        // Explicitly asked for a websocket connection (V0.1.X)
        else if (this.host) this.connection = new WSConnection({ host: this.host })
        // Autodiscover
        else {
            const devices = await this.constructor.list()
            if (devices.length > 0) {
                const { connectionType, ...args } = devices[0]
                this.connection = new connectionType(args)
            }
            if (!this.connection) {
                return Promise.reject(this.onDisconnect(new Error('No devices found')))
            }
        }

        this.connection.on('connect', this.onConnect.bind(this))
        this.connection.on('message', this.onReceive.bind(this))
        this.connection.on('disconnect', this.onDisconnect.bind(this))
        return this.connection.connect()
    }
    _connectBlind() {
        return this.connect().catch(() => {})
    }
    // Draw an arbitrary buffer to the device
    // Buffer format must be 16bit 5-6-5 (LE, except BE for the Loupedeck CT Knob screen)
    async drawBuffer({ id, width, height, x = 0, y = 0, autoRefresh = true }, buffer) {
        const displayInfo = this.displays[id]
        if (!displayInfo) throw new Error(`Display '${id}' is not available on this device!`)
        if (!width) width = displayInfo.width
        if (!height) height = displayInfo.height
        if (displayInfo.offset) {
            x += displayInfo.offset[0]
            y += displayInfo.offset[1]
        }

        const pixelCount = width * height * 2
        if (buffer.length !== pixelCount) {
            throw new Error(`Expected buffer length of ${pixelCount}, got ${buffer.length}!`)
        }

        // Header with x/y/w/h and display ID
        const header = Buffer.alloc(8)
        header.writeUInt16BE(x, 0)
        header.writeUInt16BE(y, 2)
        header.writeUInt16BE(width, 4)
        header.writeUInt16BE(height, 6)

        // Write to frame buffer
        await this.send(COMMANDS.FRAMEBUFF, Buffer.concat([displayInfo.id, header, buffer]))

        // Draw to display
        if (autoRefresh) await this.refresh(id)
    }
    // Create a canvas with correct dimensions and pass back for drawing
    drawCanvas({ id, width, height, ...args }, cb) {
        const displayInfo = this.displays[id]
        if (!displayInfo) throw new Error(`Display '${id}' is not available on this device!`)
        if (!width) width = displayInfo.width
        if (!height) height = displayInfo.height
        let createCanvas
        try {
            createCanvas = require('canvas').createCanvas
        } catch (e) {
            throw new Error('Using callbacks requires the `canvas` library to be installed. Install it using `npm install canvas`.')
        }

        const canvas = createCanvas(width, height)
        const ctx = canvas.getContext('2d', { pixelFormat: 'RGB16_565' }) // Loupedeck uses 16-bit (5-6-5) LE RGB colors
        cb(ctx, width, height)
        let buffer
        // If using NodeJS canvas package
        if (canvas.toBuffer) {
            buffer = canvas.toBuffer('raw')
        // If using browser canvas API
        } else {
            const imageData = ctx.getImageData(0, 0, width, height)
            const rgba = imageData.data
            // Convert from RGBA to RGB16_565
            buffer = rgba2rgb565(rgba, width * height)
        }
        // Swap endianness depending on display
        if (displayInfo.endianness === 'be') buffer.swap16()
        return this.drawBuffer({ id, width, height, ...args }, buffer)
    }
    // Draw to a specific key index (0-11 on Live, 0-14 on Live S)
    drawKey(index, cb) {
        // Get offset x/y for key index
        if (index < 0 || index >= this.columns * this.rows) throw new Error(`Key ${index} is not a valid key`)
        const width = 90
        const height = 90
        const x = this.visibleX[0] + index % this.columns * width
        const y = Math.floor(index / this.columns) * height
        return this[cb instanceof Buffer ? 'drawBuffer' : 'drawCanvas']({ id: 'center', x, y, width, height }, cb)
    }
    // Draw to a specific screen
    drawScreen(id, cb) {
        return this[cb instanceof Buffer ? 'drawBuffer' : 'drawCanvas']({ id }, cb)
    }
    async getInfo() {
        if (!this.connection || !this.connection.isReady()) throw new Error('Not connected!')
        return {
            serial: await this.send(COMMANDS.SERIAL),
            version: await this.send(COMMANDS.VERSION)
        }
    }
    onButton(buff) {
        if (buff.length < 2) return
        const id = BUTTONS[buff[0]]
        const event = buff[1] === 0x00 ? 'down' : 'up'
        this.emit(event, { id })
    }
    onConnect(info) {
        this.emit('connect', info)
    }
    onDisconnect(error) {
        this.emit('disconnect', error)
        clearTimeout(this._reconnectTimer)
        this.connection = null
        // Normal disconnect, do not reconnect
        if (!error) return
        // Reconnect if desired
        if (this.reconnectInterval) {
            this._reconnectTimer = setTimeout(this._connectBlind.bind(this), this.reconnectInterval)
        }
        return error.message
    }
    onReceive(buff) {
        const msgLength = buff[0]
        const handler = this.handlers[buff[1]]
        const transactionID = buff[2]
        const response = handler ? handler(buff.slice(3, msgLength)) : buff
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
    onTouch(event, buff) {
        const x = buff.readUInt16BE(1)
        const y = buff.readUInt16BE(3)
        const id = buff[5]

        // Create touch
        const touch = { x, y, id, target: this.getTarget(x, y, id) }

        // End touch, remove from local cache
        if (event === 'touchend') {
            delete this.touches[touch.id]
        } else {
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
        const displayInfo = this.displays[id]
        return this.send(COMMANDS.DRAW, displayInfo.id)
    }
    send(command, data = Buffer.alloc(0)) {
        if (!this.connection || !this.connection.isReady()) return
        this.transactionID = (this.transactionID + 1) % 256
        // Skip transaction ID's of zero since the device seems to ignore them
        if (this.transactionID === 0) this.transactionID++
        const header = Buffer.alloc(3)
        header[0] = Math.min(3 + data.length, 0xff)
        header[1] = command
        header[2] = this.transactionID
        const packet = Buffer.concat([header, data])
        this.connection.send(packet)
        return new Promise(res => {
            this.pendingTransactions[this.transactionID] = res
        })
    }
    setBrightness(value) {
        const byte = Math.max(0, Math.min(MAX_BRIGHTNESS, Math.round(value * MAX_BRIGHTNESS)))
        return this.send(COMMANDS.SET_BRIGHTNESS, Buffer.from([byte]))
    }
    setButtonColor({ id, color }) {
        const key = Object.keys(BUTTONS).find(k => BUTTONS[k] === id)
        if (!key) throw new Error(`Invalid button ID: ${id}`)
        const [r, g, b] = rgba(color)
        const data = Buffer.from([key, r, g, b])
        return this.send(COMMANDS.SET_COLOR, data)
    }
    vibrate(pattern = HAPTIC.SHORT) {
        return this.send(COMMANDS.SET_VIBRATION, Buffer.from([pattern]))
    }
}

class LoupedeckLive extends LoupedeckDevice {
    static productId = 0x0004
    static vendorId = 0x2ec2
    buttons = [0, 1, 2, 3, 4, 5, 6, 7]
    knobs = ['knobCL', 'knobCR', 'knobTL', 'knobTR', 'knobBL', 'knobBR']
    columns = 4
    displays = {
        center: { id: Buffer.from('\x00A'), width: 360, height: 270 }, // "A"
        left: { id: Buffer.from('\x00L'), width: 60, height: 270 }, // "L"
        right: { id: Buffer.from('\x00R'), width: 60, height: 270 }, // "R"
    }
    rows = 3
    type = 'Loupedeck Live'
    visibleX = [0, 480]
    // Determine touch target based on x/y position
    getTarget(x, y) {
        if (x < 60) return { screen: 'left' }
        if (x >= 420) return { screen: 'right' }
        const column = Math.floor((x - 60) / 90)
        const row = Math.floor(y / 90)
        const key = row * this.columns + column
        return {
            screen: 'center',
            key
        }
    }
}

class LoupedeckCT extends LoupedeckLive {
    static productId = 0x0003
    buttons = [0, 1, 2, 3, 4, 5, 6, 7, 'home', 'enter', 'undo', 'save', 'keyboard', 'fnL', 'a', 'b', 'c', 'd', 'fnR', 'e']
    displays = {
        center: { id: Buffer.from('\x00A'), width: 360, height: 270 }, // "A"
        left: { id: Buffer.from('\x00L'), width: 60, height: 270 }, // "L"
        right: { id: Buffer.from('\x00R'), width: 60, height: 270 }, // "R"
        knob: { id: Buffer.from('\x00W'), width: 240, height: 240, endianness: 'be' }, // "W"
    }
    type = 'Loupedeck CT'
    // Determine touch target based on x/y position
    getTarget(x, y, id) {
        if (id === 0) return { screen: 'knob' }
        return super.getTarget(x, y)
    }
}

class LoupedeckLiveS extends LoupedeckDevice {
    static productId = 0x0006
    static vendorId = 0x2ec2
    buttons = [0, 1, 2, 3]
    knobs = ['knobCL', 'knobTL']
    columns = 5
    displays = {
        center: { id: Buffer.from('\x00M'), width: 480, height: 270 },
    }
    rows = 3
    type = 'Loupedeck Live S'
    visibleX = [15, 465]
    // Determine touch target based on x/y position
    getTarget(x, y) {
        if (x < this.visibleX[0] || x >= this.visibleX[1]) return {}
        const column = Math.floor((x - this.visibleX[0]) / 90)
        const row = Math.floor(y / 90)
        const key = row * this.columns + column
        return {
            screen: 'center',
            key
        }
    }
}

class RazerStreamController extends LoupedeckLive {
    static productId = 0x0d06
    static vendorId = 0x1532
    type = 'Razer Stream Controller'
    // All displays are addressed as the same screen
    // So we add offsets
    displays = {
        center: { id: Buffer.from('\x00M'), width: 360, height: 270, offset: [60, 0] },
        left: { id: Buffer.from('\x00M'), width: 60, height: 270 },
        right: { id: Buffer.from('\x00M'), width: 60, height: 270, offset: [420, 0] },
    }
}

module.exports = {
    LoupedeckCT,
    LoupedeckDevice,
    LoupedeckLive,
    LoupedeckLiveS,
    RazerStreamController,
}