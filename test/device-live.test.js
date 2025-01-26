import { jest } from '@jest/globals'
import * as mockWS from '../__mocks__/ws.js'
import * as serialport from '../__mocks__/serialport.js'
jest.unstable_mockModule('ws', () => mockWS)
jest.unstable_mockModule('serialport', () => serialport)
const SerialConnection = (await import('../connections/serial.js')).default
const WSConnection = (await import('../connections/ws.js')).default
const { LoupedeckLive } = await import('../index.js')

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
        device = new LoupedeckLive({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('retrieves device information', async() => {
        const sender = mock.method(device.connection, 'send')
        const promise = device.getInfo()
        assert.equal(sender.mock.calls[0].arguments[0], Buffer.from('030301', 'hex'))
        device.onReceive(Buffer.from('1f03014c444c31313031303133303030333936373030313338413030303120', 'hex'))
        await delay(20)
        assert.equal(sender.mock.calls[0].arguments[0], Buffer.from('030702', 'hex'))
        device.onReceive(Buffer.from('0c070201052000ff00000000', 'hex'))
        await assert.equal(promise, {
            version: '1.5.32',
            serial: 'LDL1101013000396700138A0001'
        })
    })
    it('rejects retrieving device information if not connected', async() => {
        device.connection = { send: () => {}, isReady: () => false }
        const promise = device.getInfo()
        await assert.equal(promise).rejects.toThrow(/not connected/i)
    })
    it('sets brightness', () => {
        const sender = mock.method(device.connection, 'send')
        device.setBrightness(0)
        assert.equal(sender.mock.calls[0].arguments[0], Buffer.from('04090100', 'hex'))
        device.setBrightness(1)
        // 0x0b should be max brightness
        assert.equal(sender.mock.calls[0].arguments[0], Buffer.from('0409020a', 'hex'))
    })
    it('sets button color', () => {
        const sender = mock.method(device.connection, 'send')
        device.setButtonColor({ id: 4, color: 'red' })
        assert.equal(sender.mock.calls[0].arguments[0], Buffer.from('0702010bff0000', 'hex'))
    })
    it('errors on unknown button passed', () => {
        assert.equal(() => device.setButtonColor({ id: 'triangle', color: 'blue' })).toThrow(/Invalid button/)
    })
    it('vibrates short by default', () => {
        const sender = mock.method(device.connection, 'send')
        device.vibrate()
        assert.equal(sender.mock.calls[0].arguments[0], Buffer.from('041b0101', 'hex'))
    })
    it('vibrates a specific pattern', () => {
        const sender = mock.method(device.connection, 'send')
        device.vibrate(0x56)
        assert.equal(sender.mock.calls[0].arguments[0], Buffer.from('041b0156', 'hex'))
    })
})
describe('Drawing (Callback API)', () => {
    beforeEach(() => {
        device = new LoupedeckLive({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('writes pixels to left display', async() => {
        const sender = mock.method(device.connection, 'send')
        device.drawScreen('left', (ctx, w, h) => {
            ctx.fillStyle = '#f00' // red
            ctx.fillRect(0, 0, w, h)
        })
        // Color format is 5-6-5 16-bit RGB
        // so first 5 bits for full red is 0xf800, or 0x00f8 in LE
        const pixels = '00f8'.repeat(60 * 270)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 0, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.equal(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to right display', async() => {
        const sender = mock.method(device.connection, 'send')
        device.drawScreen('right', (ctx, w, h) => {
            ctx.fillStyle = '#0f0' // green
            ctx.fillRect(0, 0, w, h)
        })
        // Color format is 5-6-5 16-bit RGB
        // so middle 6 bits for full green is 0x07e0, or 0xe007 in LE
        const pixels = 'e007'.repeat(60 * 270)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 420, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.equal(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to center display', async() => {
        const sender = mock.method(device.connection, 'send')
        device.drawScreen('center', (ctx, w, h) => {
            ctx.fillStyle = '#00f' // blue
            ctx.fillRect(0, 0, w, h)
        })
        // Color format is 5-6-5 16-bit RGB
        // so last 5 bits for full blue is 0x001f, or 0x1f00 in LE
        const pixels = '1f00'.repeat(360 * 270)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 60, y: 0, width: 360, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.equal(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to a specific key area', async() => {
        const sender = mock.method(device.connection, 'send')
        device.drawKey(6, (ctx, w, h) => {
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 0, w, h)
        })
        const pixels = 'ffff'.repeat(90 * 90)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 180 + 60, y: 90, width: 90, height: 90 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.equal(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels without refreshing the screen', async() => {
        const sender = mock.method(device.connection, 'send')
        device.drawCanvas({ id: 'center', width: 10, height: 10, autoRefresh: false }, () => {})
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.equal(sender.mock.calls.length, 1)
    })
})
describe('Drawing (Buffer API)', () => {
    beforeEach(() => {
        device = new LoupedeckLive({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('writes pixels to left display', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(60 * 270).fill([0x00, 0xf8])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('left', buffer)
        const hex = '00f8'.repeat(60 * 270)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 0, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.equal(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to right display', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(60 * 270).fill([0xe0, 0x07])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('right', buffer)
        // Color format is 5-6-5 16-bit RGB
        // so middle 6 bits for full green is 0x07e0, or 0xe007 in LE
        const hex = 'e007'.repeat(60 * 270)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 420, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.equal(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to center display', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(360 * 270).fill([0x1f, 0x00])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('center', buffer)
        // Color format is 5-6-5 16-bit RGB
        // so last 5 bits for full blue is 0x001f, or 0x1f00 in LE
        const hex = '1f00'.repeat(360 * 270)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 60, y: 0, width: 360, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.equal(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to a specific key area', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(90 * 90 * 2).fill(0xff)
        const buffer = Buffer.from(pixels)
        device.drawKey(6, buffer)
        const hex = 'ffff'.repeat(90 * 90)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 180 + 60, y: 90, width: 90, height: 90 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.equal(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('reports an error if the buffer is the wrong size', async() => {
        const pixels = Array(30).fill(0xff)
        const buffer = Buffer.from(pixels)
        await assert.equal(device.drawScreen('left', buffer)).rejects.toThrow(/expected buffer length of 32400, got 30/i)
    })
})

describe('Message Parsing', () => {
    beforeEach(() => {
        device = new LoupedeckLive({ ip: '255.255.255.255', autoConnect: false })
    })
    it('processes timestamp events', () => {
        const SAMPLE_MESSAGE = Buffer.from('040000ba', 'hex')
        const fn = mock.fn()
        device.on('up', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.equal(fn.mock.calls.length, 0)
    })
    it('processes button presses', () => {
        const SAMPLE_MESSAGE = Buffer.from('0500000900', 'hex')
        const fn = mock.fn()
        device.on('down', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.equal(fn.mock.calls[0].arguments[0], { id: 2 })
    })
    it('processes button releases', () => {
        const SAMPLE_MESSAGE = Buffer.from('0500000701', 'hex')
        const fn = mock.fn()
        device.on('up', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.equal(fn.mock.calls[0].arguments[0], { id: 0 })
    })
    it('processes clockwise knob turns', () => {
        const SAMPLE_MESSAGE = Buffer.from('0501000101', 'hex')
        const fn = mock.fn()
        device.on('rotate', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.equal(fn.mock.calls[0].arguments[0], { id: 'knobTL', delta: 1 })
    })
    it('processes counter-clockwise knob turns', () => {
        const SAMPLE_MESSAGE = Buffer.from('05010005ff', 'hex')
        const fn = mock.fn()
        device.on('rotate', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.equal(fn.mock.calls[0].arguments[0], { id: 'knobCR', delta: -1 })
    })
    it('processes initial screen touches', () => {
        const SAMPLE_MESSAGE = Buffer.from('094d0000007300e213', 'hex')
        const fn = mock.fn()
        device.on('touchstart', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.equal(fn.mock.calls[0].arguments[0], {
            changedTouches: [{ x: 115, y: 226 })],
        }))
    })
    it('processes ticks', () => {
        const SAMPLE_MESSAGE = Buffer.from('040000f9', 'hex')
        assert.equal(() => device.onReceive(SAMPLE_MESSAGE)).not.toThrow()
    })
    it('processes touch moves', () => {
        const SAMPLE_MESSAGE = Buffer.from('094d0000007300e215', 'hex')
        const FOLLOW_MESSAGE = Buffer.from('094d0000007000e515', 'hex')
        const fn = mock.fn()
        device.on('touchmove', fn)
        device.onReceive(SAMPLE_MESSAGE)
        device.onReceive(FOLLOW_MESSAGE)
        assert.equal(fn.mock.calls[0].arguments[0], {
            changedTouches: [{ x: 112, y: 229 })],
        }))
    })
    it('processes screen touchends', () => {
        const SAMPLE_MESSAGE = Buffer.from('096d000001bf004c12', 'hex')
        const fn = mock.fn()
        device.on('touchend', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.equal(fn.mock.calls[0].arguments[0], {
            touches: [],
            changedTouches: [{ x: 447, y: 76 })],
        })
    })
    it('processes screen and key targets from touch events', () => {
        const fn = mock.fn()
        device.on('touchstart', fn)
        device.onReceive(Buffer.from('094d00000022008f13', 'hex'))
        assert.equal(fn.mock.calls[0].arguments[0], {
            changedTouches: [{ target: { screen: 'left', key: undefined } })],
        }))
        device.onReceive(Buffer.from('094d00000067004816', 'hex'))
        assert.equal(fn.mock.calls[0].arguments[0], {
            changedTouches: [{ target: { screen: 'center', key: 0 } })],
        }))
        device.onReceive(Buffer.from('094d000000c8008011', 'hex'))
        assert.equal(fn.mock.calls[0].arguments[0], {
            changedTouches: [{ target: { screen: 'center', key: 5 } })],
        }))
        device.onReceive(Buffer.from('094d0000017500d21a', 'hex'))
        assert.equal(fn.mock.calls[0].arguments[0], {
            changedTouches: [{ target: { screen: 'center', key: 11 } })],
        }))
        device.onReceive(Buffer.from('094d000001c200b8ff', 'hex'))
        assert.equal(fn.mock.calls[0].arguments[0], {
            changedTouches: [{ target: { screen: 'right', key: undefined } })],
        }))
    })
    it('processes multiple simultaneous touches', () => {
        const touchstart = mock.fn()
        const touchmove = mock.fn()
        const touchend = mock.fn()
        device.on('touchstart', touchstart)
        device.on('touchmove', touchmove)
        device.on('touchend', touchend)

        // Multiple starts
        const TOUCH_1_START = Buffer.from('094d000001bf004c01', 'hex')
        const TOUCH_2_START = Buffer.from('094d00000002000102', 'hex')
        device.onReceive(TOUCH_1_START)
        assert.equal(touchstart.calls[0].arguments[0], {
            touches: [{ id: 1 })],
            changedTouches: [{ id: 1 })],
        })
        device.onReceive(TOUCH_2_START)
        assert.equal(touchstart.calls[0].arguments[0], {
            touches: [{ id: 1 }), { id: 2 })],
            changedTouches: [{ id: 2 })],
        })

        // Independent moves
        const TOUCH_1_MOVE = Buffer.from('094d000001bf004f01', 'hex')
        const TOUCH_2_MOVE = Buffer.from('094d00000004000802', 'hex')
        device.onReceive(TOUCH_2_MOVE)
        assert.equal(touchmove.calls[0].arguments[0], {
            touches: [{ id: 1 }), { id: 2 })],
            changedTouches: [{ id: 2 })],
        })
        device.onReceive(TOUCH_1_MOVE)
        assert.equal(touchmove.calls[0].arguments[0], {
            touches: [{ id: 1 }), { id: 2 })],
            changedTouches: [{ id: 1 })],
        })

        // Remove one touch
        const TOUCH_1_REMOVE = Buffer.from('096d000001bf004f01', 'hex')
        device.onReceive(TOUCH_1_REMOVE)
        assert.equal(touchend.calls[0].arguments[0], {
            touches: [{ id: 2 })],
            changedTouches: [{ id: 1 })],
        })
    })
    it('processes version information', () => {
        const VERSION_PACKET = Buffer.from('0c070201052000ff00000000', 'hex')
        assert.equal(device.onReceive(VERSION_PACKET), '1.5.32')
    })
    it('processes serial information', () => {
        const SERIAL_PACKET = Buffer.from('1f03014c444c31313031303133303030333936373030313338413030303120', 'hex')
        assert.equal(device.onReceive(SERIAL_PACKET), 'LDL1101013000396700138A0001')
    })
    it('ignores unknown messages', () => {
        const SAMPLE_MESSAGE = Buffer.from('ffffffffffffff', 'hex')
        assert.equal(() => device.onReceive(SAMPLE_MESSAGE)).not.toThrow()
    })
})

describe('Connection Management', () => {
    it('connects to serial first if both connection types are available', async() => {
        const serialDiscovery = mock.method(SerialConnection, 'discover', () => [
            { connectionType: SerialConnection, path: '/dev/test1' }
        ])
        const serialConnect = mock.method(SerialConnection.prototype, 'connect', function() {
            this.emit('connect', { address: this.path })
        })
        const wsDiscovery = mock.method(WSConnection, 'discover', () => [
            { connectionType: WSConnection, host: '128.0.0.1' }
        ])
        device = new LoupedeckLive()
        const fn = mock.fn()
        device.on('connect', fn)
        await device.connect()
        assert.equal(fn.mock.calls[0].arguments[0], { address: '/dev/test1' })
        serialDiscovery.mock.restore()
        serialConnect.mock.restore()
        wsDiscovery.mock.restore()
        device.close()
    })
    it('connects to serial if path explicitly set', () => {
        device = new LoupedeckLive({ path: '/dev/test2' })
        assert(device.connection instanceof SerialConnection)
        device.close()
    })
    it('connects to websocket if host explicitly set', () => {
        device = new LoupedeckLive({ host: '255.255.255.255' })
        assert(device.connection instanceof WSConnection)
        device.close()
    })
    it('attempts reconnect if device not found', async() => {
        const serialDiscovery = mock.method(SerialConnection, 'discover', () => [])
        const wsDiscovery = mock.method(WSConnection, 'discover', () => [])
        const fn = mock.fn()
        device = new LoupedeckLive({ autoConnect: false, reconnectInterval: 20 })
        device.on('disconnect', fn)
        const connect = mock.method(device, 'connect')
        await assert.equal(device.connect()).rejects.toMatch(/no devices found/i)
        await delay(40)
        assert.equal(connect.mock.calls.length).toBeGreaterThanOrEqual(2)
        assert.equal(fn.mock.calls[0][0].message).toMatch(/no devices found/i)
        serialDiscovery.mock.restore()
        wsDiscovery.mock.restore()
        device.close()
    })
    it('attempts reconnect on error', async() => {
        device = new LoupedeckLive({ autoConnect: false, reconnectInterval: 20 })
        const connect = mock.method(device, 'connect', () => Promise.reject('some error'))
        device.onDisconnect('some error')
        await delay(40)
        assert.equal(connect.mock.calls.length, 0)
        device.close()
    })
    it('does not attempt reconnect if closed before reconnect time', async() => {
        device = new LoupedeckLive({ autoConnect: false, reconnectInterval: 20 })
        const connect = mock.method(device, 'connect', () => {})
        device.onDisconnect('some error')
        device.onDisconnect()
        await delay(40)
        assert.equal(connect.mock.calls.length, 0)
    })
    it('does not attempt reconnect if reconnect interval not set', async() => {
        device = new LoupedeckLive({ autoConnect: false, reconnectInterval: false })
        const connect = mock.method(device, 'connect', () => {})
        device.onDisconnect('some error')
        await delay(100)
        assert.equal(connect.mock.calls.length, 0)
    })
    it('ignores commands if connection not open', () => {
        device = new LoupedeckLive({ path: '/dev/test3', autoConnect: false })
        device.connection = { send: () => {}, isReady: () => false, close: () => {} }
        const sender = mock.method(device.connection, 'send')
        device.send('test', Buffer.from([0xff]))
        assert.equal(sender.mock.calls.length, 0)
        device.close()
    })
    it('can list connection options', async() => {
        mock.method(SerialConnection, 'discover', () => [
            { connectionType: SerialConnection, path: '/dev/test1' },
            { connectionType: SerialConnection, path: '/dev/test2' },
        ])
        mock.method(WSConnection, 'discover', () => [
            { connectionType: WSConnection, host: '128.0.0.1' }
        ])
        const options = await LoupedeckLive.list()
        assert.equal(options.length, 3)
    })
    it('can filter connection options', async() => {
        mock.method(SerialConnection, 'discover', () => [
            { connectionType: SerialConnection, path: '/dev/test1' },
            { connectionType: SerialConnection, path: '/dev/test2' },
        ])
        mock.method(WSConnection, 'discover', () => [
            { connectionType: WSConnection, host: '128.0.0.1' }
        ])
        const options = await LoupedeckLive.list({ ignoreWebsocket: true })
        assert.equal(options.length, 2)
        const options2 = await LoupedeckLive.list({ ignoreSerial: true })
        assert.equal(options2.length, 1)
    })
    it('returns same connection if multiple connects are attempted', async() => {
        const serialDiscovery = mock.method(SerialConnection, 'discover', () => [
            { connectionType: SerialConnection, path: '/dev/test1' }
        ])
        let slowSerialConnection
        const serialConnect = mock.method(SerialConnection.prototype, 'connect', function() {
            slowSerialConnection = this
        })
        device = new LoupedeckLive({ autoConnect: false })
        const fn = mock.fn()
        device.on('connect', fn)
        // Try initial connect
        const connect1 = device.connect()
        await delay(40)
        assert.equal(fn.mock.calls.length, 0)

        // Try another connect
        const connect2 = device.connect()

        // Make the connection work
        slowSerialConnection.emit('connect', { address: slowSerialConnection.path })

        // Both promises should resolve
        await assert.equal(connect1, undefined)
        await assert.equal(connect2, undefined)

        serialDiscovery.mock.restore()
        serialConnect.mock.restore()
        device.close()
    })
})

describe('Edge Cases', () => {
    beforeEach(() => {
        device = new LoupedeckLive({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('prevents transaction IDs of zero', () => {
        device.transactionID = 0xff
        device.send(0xffff, Buffer.alloc(0))
        assert.equal(device.transactionID).not.toBe(0)
    })
})