const { LoupedeckLiveS } = require('..')
const SerialConnection = require('../connections/serial')
const WSConnection = require('../connections/ws')

expect.extend({
    toBePixelBuffer(received, { displayID, x, y, width, height }) {
        if (received.readUInt16BE(0) !== 0xff10) return { pass: false, message: () => `Header should be 0xff10, found 0x${received.readUInt16BE().toString(16)}` }
        if (received.readUInt16BE(3) !== displayID) return { pass: false, message: () => `Display ID should be ${displayID}, but found 0x${received.readUInt16BE(3).toString(16)}` }
        if (received.readUInt16BE(5) !== x) return { pass: false, message: () => `X coordinate should be ${x}, but found ${received.readUInt16BE(3)}` }
        if (received.readUInt16BE(7) !== y) return { pass: false, message: () => `Y coordinate should be ${y}, but found ${received.readUInt16BE(5)}` }
        if (received.readUInt16BE(9) !== width) return { pass: false, message: () => `Width should be ${width}, but found ${received.readUInt16BE(9)}` }
        if (received.readUInt16BE(11) !== height) return { pass: false, message: () => `Height should be ${height}, but found ${received.readUInt16BE(11)}` }
        const correctLength = 13 + width * height * 2
        if (received.length !== correctLength) return { pass: false, message: () => `Buffer length should be ${correctLength}, but found ${received.length}` }
        return { pass: true }
    }
})

const delay = ms => new Promise(res => setTimeout(res, ms))

let device

describe('Commands', () => {
    beforeEach(() => {
        device = new LoupedeckLiveS({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('retrieves device information', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        const promise = device.getInfo()
        expect(sender).toHaveBeenCalledWith(Buffer.from('030301', 'hex'))
        device.onReceive(Buffer.from('1f03014c444c31313031303133303030333936373030313338413030303120', 'hex'))
        await delay(20)
        expect(sender).toHaveBeenCalledWith(Buffer.from('030702', 'hex'))
        device.onReceive(Buffer.from('0c070201052000ff00000000', 'hex'))
        expect(promise).resolves.toEqual({
            version: '1.5.32',
            serial: 'LDL1101013000396700138A0001'
        })
    })
    it('rejects retrieving device information if not connected', async() => {
        device.connection = { send: () => {}, isReady: () => false }
        const promise = device.getInfo()
        await expect(promise).rejects.toThrow(/not connected/i)
    })
    it('sets brightness', () => {
        const sender = jest.spyOn(device.connection, 'send')
        device.setBrightness(0)
        expect(sender).toHaveBeenCalledWith(Buffer.from('04090100', 'hex'))
        device.setBrightness(1)
        // 0x0b should be max brightness
        expect(sender).toHaveBeenCalledWith(Buffer.from('0409020a', 'hex'))
    })
    it('sets button color', () => {
        const sender = jest.spyOn(device.connection, 'send')
        device.setButtonColor({ id: 4, color: 'red' })
        expect(sender).toHaveBeenCalledWith(Buffer.from('0702010bff0000', 'hex'))
    })
    it('errors on unknown button passed', () => {
        expect(() => device.setButtonColor({ id: 'triangle', color: 'blue' })).toThrow(/Invalid button/)
    })
    it('vibrates short by default', () => {
        const sender = jest.spyOn(device.connection, 'send')
        device.vibrate()
        expect(sender).toHaveBeenCalledWith(Buffer.from('041b0101', 'hex'))
    })
    it('vibrates a specific pattern', () => {
        const sender = jest.spyOn(device.connection, 'send')
        device.vibrate(0x56)
        expect(sender).toHaveBeenCalledWith(Buffer.from('041b0156', 'hex'))
    })
})
describe('Drawing (Callback API)', () => {
    beforeEach(() => {
        device = new LoupedeckLiveS({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('should report an error if attempting to write to a different display', () => {
        expect(() => device.drawScreen('left', () => {})).toThrow(/display 'left' is not available on this device/i)
    })
    it('writes pixels to display', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        device.drawScreen('center', (ctx, w, h) => {
            ctx.fillStyle = '#00f' // blue
            ctx.fillRect(0, 0, w, h)
        })
        // Color format is 5-6-5 16-bit RGB
        // so last 5 bits for full blue is 0x001f, or 0x1f00 in LE
        const pixels = '1f00'.repeat(480 * 270)
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 0, y: 0, width: 480, height: 270 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(pixels)
        // Confirm write
        device.onReceive(Buffer.from('04d001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenNthCalledWith(2, Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to a specific key area', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        device.drawKey(6, (ctx, w, h) => {
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 0, w, h)
        })
        const pixels = 'ffff'.repeat(90 * 90)
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 90 + 15, y: 90, width: 90, height: 90 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(pixels)
        // Confirm write
        device.onReceive(Buffer.from('04d001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenNthCalledWith(2, Buffer.from('050f02004d', 'hex'))
    })
    it('refuses to write to keys that do not exist', () => {
        expect(() => device.drawKey(15, () => {})).toThrow(/key 15 is not a valid key/i)
    })
    it('writes pixels without refreshing the screen', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        device.drawCanvas({ id: 'center', width: 10, height: 10, autoRefresh: false }, () => {})
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenCalledTimes(1)
    })
    it('informs the user if the canvas library is not installed', () => {
        jest.mock('canvas', () => {})
        expect(() => device.drawKey(6, () => {})).toThrow(/using callbacks requires the `canvas` library/i)
    })
})
describe('Drawing (Buffer API)', () => {
    beforeEach(() => {
        device = new LoupedeckLiveS({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('should report an error if attempting to write to a different display', async() => {
        const buffer = Buffer.from([])
        await expect(device.drawScreen('left', buffer)).rejects.toThrow(/display 'left' is not available on this device/i)
    })
    it('writes pixels to center display', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        const pixels = Array(480 * 270).fill([0x1f, 0x00])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('center', buffer)
        // Color format is 5-6-5 16-bit RGB
        // so last 5 bits for full blue is 0x001f, or 0x1f00 in LE
        const hex = '1f00'.repeat(480 * 270)
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 0, y: 0, width: 480, height: 270 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(hex)
        // Confirm write
        device.onReceive(Buffer.from('04d001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenNthCalledWith(2, Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to a specific key area', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        const pixels = Array(90 * 90 * 2).fill(0xff)
        const buffer = Buffer.from(pixels)
        device.drawKey(6, buffer)
        const hex = 'ffff'.repeat(90 * 90)
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 105, y: 90, width: 90, height: 90 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(hex)
        // Confirm write
        device.onReceive(Buffer.from('04d001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenNthCalledWith(2, Buffer.from('050f02004d', 'hex'))
    })
    it('reports an error if the buffer is the wrong size', async() => {
        const pixels = Array(30).fill(0xff)
        const buffer = Buffer.from(pixels)
        await expect(device.drawScreen('center', buffer)).rejects.toThrow(/expected buffer length of 259200, got 30/i)
    })
})

describe('Message Parsing', () => {
    beforeEach(() => {
        device = new LoupedeckLiveS({ ip: '255.255.255.255', autoConnect: false })
    })
    it('processes button presses', () => {
        const SAMPLE_MESSAGE = Buffer.from('0500000900', 'hex')
        const fn = jest.fn()
        device.on('down', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith({ id: 2 })
    })
    it('processes button releases', () => {
        const SAMPLE_MESSAGE = Buffer.from('0500000701', 'hex')
        const fn = jest.fn()
        device.on('up', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith({ id: 0 })
    })
    it('processes clockwise knob turns', () => {
        const SAMPLE_MESSAGE = Buffer.from('0501000101', 'hex')
        const fn = jest.fn()
        device.on('rotate', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith({ id: 'knobTL', delta: 1 })
    })
    it('processes counter-clockwise knob turns', () => {
        const SAMPLE_MESSAGE = Buffer.from('05010005ff', 'hex')
        const fn = jest.fn()
        device.on('rotate', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith({ id: 'knobCR', delta: -1 })
    })
    it('processes initial screen touches', () => {
        const SAMPLE_MESSAGE = Buffer.from('094d0000007300e213', 'hex')
        const fn = jest.fn()
        device.on('touchstart', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith(expect.objectContaining({
            changedTouches: [expect.objectContaining({ x: 115, y: 226 })],
        }))
    })
    it('processes ticks', () => {
        const SAMPLE_MESSAGE = Buffer.from('040000f9', 'hex')
        expect(() => device.onReceive(SAMPLE_MESSAGE)).not.toThrow()
    })
    it('processes touch moves', () => {
        const SAMPLE_MESSAGE = Buffer.from('094d0000007300e215', 'hex')
        const FOLLOW_MESSAGE = Buffer.from('094d0000007000e515', 'hex')
        const fn = jest.fn()
        device.on('touchmove', fn)
        device.onReceive(SAMPLE_MESSAGE)
        device.onReceive(FOLLOW_MESSAGE)
        expect(fn).toHaveBeenCalledWith(expect.objectContaining({
            changedTouches: [expect.objectContaining({ x: 112, y: 229 })],
        }))
    })
    it('processes screen touchends', () => {
        const SAMPLE_MESSAGE = Buffer.from('096d000001bf004c12', 'hex')
        const fn = jest.fn()
        device.on('touchend', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith({
            touches: [],
            changedTouches: [expect.objectContaining({ x: 447, y: 76 })],
        })
    })
    it('processes screen and key targets from touch events', () => {
        const fn = jest.fn()
        device.on('touchstart', fn)
        device.onReceive(Buffer.from('094d00000022008f13', 'hex'))
        expect(fn).toHaveBeenCalledWith(expect.objectContaining({
            changedTouches: [expect.objectContaining({ target: { screen: 'center', key: 5 } })],
        }))
        device.onReceive(Buffer.from('094d00000067004816', 'hex'))
        expect(fn).toHaveBeenCalledWith(expect.objectContaining({
            changedTouches: [expect.objectContaining({ target: { screen: 'center', key: 0 } })],
        }))
        device.onReceive(Buffer.from('094d000000c8008011', 'hex'))
        expect(fn).toHaveBeenCalledWith(expect.objectContaining({
            changedTouches: [expect.objectContaining({ target: { screen: 'center', key: 5 } })],
        }))
    })
    it('processes multiple simultaneous touches', () => {
        const touchstart = jest.fn()
        const touchmove = jest.fn()
        const touchend = jest.fn()
        device.on('touchstart', touchstart)
        device.on('touchmove', touchmove)
        device.on('touchend', touchend)

        // Multiple starts
        const TOUCH_1_START = Buffer.from('094d000001bf004c01', 'hex')
        const TOUCH_2_START = Buffer.from('094d00000002000102', 'hex')
        device.onReceive(TOUCH_1_START)
        expect(touchstart).toHaveBeenCalledWith({
            touches: [expect.objectContaining({ id: 1 })],
            changedTouches: [expect.objectContaining({ id: 1 })],
        })
        device.onReceive(TOUCH_2_START)
        expect(touchstart).toHaveBeenCalledWith({
            touches: [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })],
            changedTouches: [expect.objectContaining({ id: 2 })],
        })

        // Independent moves
        const TOUCH_1_MOVE = Buffer.from('094d000001bf004f01', 'hex')
        const TOUCH_2_MOVE = Buffer.from('094d00000004000802', 'hex')
        device.onReceive(TOUCH_2_MOVE)
        expect(touchmove).toHaveBeenCalledWith({
            touches: [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })],
            changedTouches: [expect.objectContaining({ id: 2 })],
        })
        device.onReceive(TOUCH_1_MOVE)
        expect(touchmove).toHaveBeenCalledWith({
            touches: [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })],
            changedTouches: [expect.objectContaining({ id: 1 })],
        })

        // Remove one touch
        const TOUCH_1_REMOVE = Buffer.from('096d000001bf004f01', 'hex')
        device.onReceive(TOUCH_1_REMOVE)
        expect(touchend).toHaveBeenCalledWith({
            touches: [expect.objectContaining({ id: 2 })],
            changedTouches: [expect.objectContaining({ id: 1 })],
        })
    })
    it('processes version information', () => {
        const VERSION_PACKET = Buffer.from('0c070201052000ff00000000', 'hex')
        expect(device.onReceive(VERSION_PACKET)).toEqual('1.5.32')
    })
    it('processes serial information', () => {
        const SERIAL_PACKET = Buffer.from('1f03014c444c31313031303133303030333936373030313338413030303120', 'hex')
        expect(device.onReceive(SERIAL_PACKET)).toEqual('LDL1101013000396700138A0001')
    })
    it('ignores unknown messages', () => {
        const SAMPLE_MESSAGE = Buffer.from('ffffffffffffff', 'hex')
        expect(() => device.onReceive(SAMPLE_MESSAGE)).not.toThrow()
    })
})

describe('Connection Management', () => {
    it('connects to serial first if both connection types are available', async() => {
        const serialDiscovery = jest.spyOn(SerialConnection, 'discover').mockImplementation(() => [
            { connectionType: SerialConnection, path: '/dev/test1' }
        ])
        const serialConnect = jest.spyOn(SerialConnection.prototype, 'connect').mockImplementation(function() {
            this.emit('connect', { address: this.path })
        })
        const wsDiscovery = jest.spyOn(WSConnection, 'discover').mockImplementation(() => [
            { connectionType: WSConnection, host: '128.0.0.1' }
        ])
        device = new LoupedeckLiveS()
        const fn = jest.fn()
        device.on('connect', fn)
        await device.connect()
        expect(fn).toHaveBeenCalledWith({ address: '/dev/test1' })
        serialDiscovery.mockRestore()
        serialConnect.mockRestore()
        wsDiscovery.mockRestore()
        device.close()
    })
    it('connects to serial if path explicitly set', () => {
        device = new LoupedeckLiveS({ path: '/dev/test2' })
        expect(device.connection).toBeInstanceOf(SerialConnection)
        device.close()
    })
    it('connects to websocket if host explicitly set', () => {
        device = new LoupedeckLiveS({ host: '255.255.255.255' })
        expect(device.connection).toBeInstanceOf(WSConnection)
        device.close()
    })
    it('attempts reconnect if device not found', async() => {
        const serialDiscovery = jest.spyOn(SerialConnection, 'discover').mockImplementation(() => [])
        const wsDiscovery = jest.spyOn(WSConnection, 'discover').mockImplementation(() => [])
        const fn = jest.fn()
        device = new LoupedeckLiveS({ autoConnect: false, reconnectInterval: 20 })
        device.on('disconnect', fn)
        const connect = jest.spyOn(device, 'connect')
        await expect(device.connect()).rejects.toMatch(/no devices found/i)
        await delay(40)
        expect(connect.mock.calls.length).toBeGreaterThanOrEqual(2)
        expect(fn.mock.calls[0][0].message).toMatch(/no devices found/i)
        serialDiscovery.mockRestore()
        wsDiscovery.mockRestore()
        device.close()
    })
    it('attempts reconnect on error', async() => {
        device = new LoupedeckLiveS({ autoConnect: false, reconnectInterval: 20 })
        const connect = jest.spyOn(device, 'connect').mockImplementation(() => Promise.reject('some error'))
        device.onDisconnect('some error')
        await delay(40)
        expect(connect).toHaveBeenCalled()
        device.close()
    })
    it('does not attempt reconnect if closed before reconnect time', async() => {
        device = new LoupedeckLiveS({ autoConnect: false, reconnectInterval: 20 })
        const connect = jest.spyOn(device, 'connect').mockImplementation(() => {})
        device.onDisconnect('some error')
        device.onDisconnect()
        await delay(40)
        expect(connect).not.toHaveBeenCalled()
    })
    it('does not attempt reconnect if reconnect interval not set', async() => {
        device = new LoupedeckLiveS({ autoConnect: false, reconnectInterval: false })
        const connect = jest.spyOn(device, 'connect').mockImplementation(() => {})
        device.onDisconnect('some error')
        await delay(100)
        expect(connect).not.toHaveBeenCalled()
    })
    it('ignores commands if connection not open', () => {
        device = new LoupedeckLiveS({ path: '/dev/test3', autoConnect: false })
        device.connection = { send: () => {}, isReady: () => false, close: () => {} }
        const sender = jest.spyOn(device.connection, 'send')
        device.send('test', Buffer.from([0xff]))
        expect(sender).not.toHaveBeenCalled()
        device.close()
    })
    it('can list connection options', async() => {
        jest.spyOn(SerialConnection, 'discover').mockImplementation(() => [
            { connectionType: SerialConnection, path: '/dev/test1' },
            { connectionType: SerialConnection, path: '/dev/test2' },
        ])
        jest.spyOn(WSConnection, 'discover').mockImplementation(() => [
            { connectionType: WSConnection, host: '128.0.0.1' }
        ])
        const options = await LoupedeckLiveS.list()
        expect(options.length).toBe(3)
    })
    it('can filter connection options', async() => {
        jest.spyOn(SerialConnection, 'discover').mockImplementation(() => [
            { connectionType: SerialConnection, path: '/dev/test1' },
            { connectionType: SerialConnection, path: '/dev/test2' },
        ])
        jest.spyOn(WSConnection, 'discover').mockImplementation(() => [
            { connectionType: WSConnection, host: '128.0.0.1' }
        ])
        const options = await LoupedeckLiveS.list({ ignoreWebsocket: true })
        expect(options.length).toBe(2)
        const options2 = await LoupedeckLiveS.list({ ignoreSerial: true })
        expect(options2.length).toBe(1)
    })
    it('returns same connection if multiple connects are attempted', async() => {
        const serialDiscovery = jest.spyOn(SerialConnection, 'discover').mockImplementation(() => [
            { connectionType: SerialConnection, path: '/dev/test1' }
        ])
        let slowSerialConnection
        const serialConnect = jest.spyOn(SerialConnection.prototype, 'connect').mockImplementation(function() {
            slowSerialConnection = this
        })
        device = new LoupedeckLiveS({ autoConnect: false })
        const fn = jest.fn()
        device.on('connect', fn)
        // Try initial connect
        const connect1 = device.connect()
        await delay(40)
        expect(fn).not.toHaveBeenCalled()

        // Try another connect
        const connect2 = device.connect()

        // Make the connection work
        slowSerialConnection.emit('connect', { address: this.path })

        // Both promises should resolve
        await expect(connect1).resolves.toBe(undefined)
        await expect(connect2).resolves.toBe(undefined)

        serialDiscovery.mockRestore()
        serialConnect.mockRestore()
        device.close()
    })
})

describe('Edge Cases', () => {
    beforeEach(() => {
        device = new LoupedeckLiveS({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('prevents transaction IDs of zero', () => {
        device.transactionID = 0xff
        device.send(0xffff, Buffer.alloc(0))
        expect(device.transactionID).not.toBe(0)
    })
})