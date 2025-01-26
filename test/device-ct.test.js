import assert from 'node:assert/strict'
import { beforeEach, describe, it, mock } from 'node:test'
import { assertIsPixelBuffer, delay } from './helpers.js'

import { MockSocket } from '../__mocks__/ws.js'
import { MockSerialPort } from '../__mocks__/serialport.js'
mock.module('ws', { defaultExport: MockSocket })
mock.module('serialport', {
    namedExports: { SerialPort: MockSerialPort }
})
const SerialConnection = (await import('../connections/serial.js')).default
const WSConnection = (await import('../connections/ws.js')).default
const { LoupedeckCT } = await import('../index.js')

let device

describe('Commands', () => {
    beforeEach(() => {
        device = new LoupedeckCT({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('retrieves device information', async() => {
        const sender = mock.method(device.connection, 'send')
        const promise = device.getInfo()
        assert.deepEqual(sender.mock.calls[0].arguments[0], Buffer.from('030301', 'hex'))
        device.onReceive(Buffer.from('1f03014c444c31313031303133303030333936373030313338413030303120', 'hex'))
        await delay(20)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('030702', 'hex'))
        device.onReceive(Buffer.from('0c0702000208000900000000', 'hex'))
        assert.deepEqual(await promise, {
            version: '0.2.8',
            serial: 'LDL1101013000396700138A0001'
        })
    })
    it('rejects retrieving device information if not connected', async() => {
        device.connection = { send: () => {}, isReady: () => false }
        const promise = device.getInfo()
        await assert.rejects(promise, /not connected/i)
    })
    it('sets brightness', () => {
        const sender = mock.method(device.connection, 'send')
        device.setBrightness(0)
        assert.deepEqual(sender.mock.calls[0].arguments[0], Buffer.from('04090100', 'hex'))
        device.setBrightness(1)
        // 0x0b should be max brightness
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('0409020a', 'hex'))
    })
    it('sets button color', () => {
        const sender = mock.method(device.connection, 'send')
        device.setButtonColor({ id: 'enter', color: 'red' })
        assert.deepEqual(sender.mock.calls[0].arguments[0], Buffer.from('07020112ff0000', 'hex'))
    })
    it('errors on unknown button passed', () => {
        assert.throws(() => device.setButtonColor({ id: 'triangle', color: 'blue' }), /Invalid button/i)
    })
    it('vibrates short by default', () => {
        const sender = mock.method(device.connection, 'send')
        device.vibrate()
        assert.deepEqual(sender.mock.calls[0].arguments[0], Buffer.from('041b0101', 'hex'))
    })
    it('vibrates a specific pattern', () => {
        const sender = mock.method(device.connection, 'send')
        device.vibrate(0x56)
        assert.deepEqual(sender.mock.calls[0].arguments[0], Buffer.from('041b0156', 'hex'))
    })
})
describe('Drawing (Callback API)', () => {
    beforeEach(() => {
        device = new LoupedeckCT({ autoConnect: false })
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
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004c, x: 0, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004c', 'hex'))
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
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x0052, x: 0, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f020052', 'hex'))
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
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x0041, x: 0, y: 0, width: 360, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f020041', 'hex'))
    })
    it('writes pixels to knob display', async() => {
        const sender = mock.method(device.connection, 'send')
        device.drawScreen('knob', (ctx, w, h) => {
            ctx.fillStyle = '#00f' // blue
            ctx.fillRect(0, 0, w, h)
        })
        // Color format is 5-6-5 16-bit RGB (Big endian!)
        // so last 5 bits for full blue is 0x001f
        const pixels = '001f'.repeat(240 * 240)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x0057, x: 0, y: 0, width: 240, height: 240 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f020057', 'hex'))
    })
    it('writes pixels to a specific key area', async() => {
        const sender = mock.method(device.connection, 'send')
        device.drawKey(6, (ctx, w, h) => {
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 0, w, h)
        })
        const pixels = 'ffff'.repeat(90 * 90)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x0041, x: 180, y: 90, width: 90, height: 90 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f020041', 'hex'))
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
        device = new LoupedeckCT({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('writes pixels to left display', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(60 * 270).fill([0x00, 0xf8])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('left', buffer)
        const hex = '00f8'.repeat(60 * 270)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004c, x: 0, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004c', 'hex'))
    })
    it('writes pixels to right display', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(60 * 270).fill([0xe0, 0x07])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('right', buffer)
        // Color format is 5-6-5 16-bit RGB
        // so middle 6 bits for full green is 0x07e0, or 0xe007 in LE
        const hex = 'e007'.repeat(60 * 270)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x0052, x: 0, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f020052', 'hex'))
    })
    it('writes pixels to center display', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(360 * 270).fill([0x1f, 0x00])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('center', buffer)
        // Color format is 5-6-5 16-bit RGB
        // so last 5 bits for full blue is 0x001f, or 0x1f00 in LE
        const hex = '1f00'.repeat(360 * 270)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x0041, x: 0, y: 0, width: 360, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f020041', 'hex'))
    })
    it('writes pixels to knob display', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(240 * 240).fill([0x00, 0x1f])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('knob', buffer)
        // Color format is 5-6-5 16-bit RGB (Big endian!)
        // so last 5 bits for full blue is 0x001f
        const hex = '001f'.repeat(240 * 240)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x0057, x: 0, y: 0, width: 240, height: 240 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f020057', 'hex'))
    })
    it('writes pixels to a specific key area', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(90 * 90 * 2).fill(0xff)
        const buffer = Buffer.from(pixels)
        device.drawKey(6, buffer)
        const hex = 'ffff'.repeat(90 * 90)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x0041, x: 180, y: 90, width: 90, height: 90 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f020041', 'hex'))
    })
    it('reports an error if the buffer is the wrong size', async() => {
        const pixels = Array(30).fill(0xff)
        const buffer = Buffer.from(pixels)
        await assert.rejects(() => device.drawScreen('left', buffer), /expected buffer length of 32400, got 30/i)
    })
})

describe('Message Parsing', () => {
    beforeEach(() => {
        device = new LoupedeckCT({ autoConnect: false })
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
        assert.deepEqual(fn.mock.calls[0].arguments[0], { id: 2 })
    })
    it('processes button releases', () => {
        const SAMPLE_MESSAGE = Buffer.from('0500000701', 'hex')
        const fn = mock.fn()
        device.on('up', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.deepEqual(fn.mock.calls[0].arguments[0], { id: 0 })
    })
    it('processes clockwise knob turns', () => {
        const SAMPLE_MESSAGE = Buffer.from('0501000101', 'hex')
        const fn = mock.fn()
        device.on('rotate', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.deepEqual(fn.mock.calls[0].arguments[0], { id: 'knobTL', delta: 1 })
    })
    it('processes counter-clockwise knob turns', () => {
        const SAMPLE_MESSAGE = Buffer.from('05010000ff', 'hex')
        const fn = mock.fn()
        device.on('rotate', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.deepEqual(fn.mock.calls[0].arguments[0], { id: 'knobCT', delta: -1 })
    })
    it('processes initial main screen touches', () => {
        const SAMPLE_MESSAGE = Buffer.from('094d0000007300e213', 'hex')
        const fn = mock.fn()
        device.on('touchstart', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.deepEqual(fn.mock.calls[0].arguments[0].changedTouches[0], {
            id: 19,
            target: {
                key: 8,
                screen: 'center'
            },
            x: 115,
            y: 226,
        })
    })
    it('processes initial knob screen touches', () => {
        const SAMPLE_MESSAGE = Buffer.from('095200000096008e00', 'hex')
        const fn = mock.fn()
        device.on('touchstart', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.deepEqual(fn.mock.calls[0].arguments[0].changedTouches[0], {
            id: 0,
            x: 150,
            y: 142,
            target: { screen: 'knob' },
        })
    })
    it('processes ticks', () => {
        const SAMPLE_MESSAGE = Buffer.from('040000f9', 'hex')
        assert.doesNotThrow(() => device.onReceive(SAMPLE_MESSAGE))
    })
    it('processes touch moves', () => {
        const SAMPLE_MESSAGE = Buffer.from('094d0000007300e215', 'hex')
        const FOLLOW_MESSAGE = Buffer.from('094d0000007000e515', 'hex')
        const fn = mock.fn()
        device.on('touchmove', fn)
        device.onReceive(SAMPLE_MESSAGE)
        device.onReceive(FOLLOW_MESSAGE)
        assert.deepEqual(fn.mock.calls[0].arguments[0].changedTouches[0], {
            id: 21,
            x: 112,
            y: 229,
            target: {
                key: 8,
                screen: 'center'
            }
        })
    })
    it('processes main screen touchends', () => {
        const SAMPLE_MESSAGE = Buffer.from('096d000001bf004c12', 'hex')
        const fn = mock.fn()
        device.on('touchend', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.deepEqual(fn.mock.calls[0].arguments[0].changedTouches[0], {
            id: 18,
            target: { screen: 'right' },
            x: 447,
            y: 76,
        })
    })
    it('processes knob screen touchends', () => {
        const SAMPLE_MESSAGE = Buffer.from('097200000096008e00', 'hex')
        const fn = mock.fn()
        device.on('touchend', fn)
        device.onReceive(SAMPLE_MESSAGE)
        assert.deepEqual(fn.mock.calls[0].arguments[0].changedTouches[0], {
            id: 0,
            target: { screen: 'knob' },
            x: 150,
            y: 142,
        })
    })
    it('processes screen and key targets from touch events', () => {
        const fn = mock.fn()
        device.on('touchstart', fn)
        device.onReceive(Buffer.from('094d00000022008f13', 'hex'))
        assert.deepEqual(fn.mock.calls[0].arguments[0].changedTouches[0].target, {
            screen: 'left',
        })
        device.onReceive(Buffer.from('094d00000067004816', 'hex'))
        assert.deepEqual(fn.mock.calls[1].arguments[0].changedTouches[0].target, {
            screen: 'center', key: 0,
        })
        device.onReceive(Buffer.from('094d000000c8008011', 'hex'))
        assert.deepEqual(fn.mock.calls[2].arguments[0].changedTouches[0].target, {
            screen: 'center', key: 5,
        })
        device.onReceive(Buffer.from('094d0000017500d21a', 'hex'))
        assert.deepEqual(fn.mock.calls[3].arguments[0].changedTouches[0].target, {
            screen: 'center', key: 11,
        })
        device.onReceive(Buffer.from('094d000001c200b8ff', 'hex'))
        assert.deepEqual(fn.mock.calls[4].arguments[0].changedTouches[0].target, {
            screen: 'right',
        })
    })
    it('processes multiple simultaneous touches', () => {
        const touchstart = mock.fn()
        const touchmove = mock.fn()
        const touchend = mock.fn()
        device.on('touchstart', touchstart)
        device.on('touchmove', touchmove)
        device.on('touchend', touchend)
        let ev

        // Multiple starts
        const TOUCH_1_START = Buffer.from('094d000001bf004c01', 'hex')
        const TOUCH_2_START = Buffer.from('094d00000002000102', 'hex')
        device.onReceive(TOUCH_1_START)
        ev = touchstart.mock.calls[0].arguments[0]
        assert.equal(ev.touches.length, 1)
        assert.equal(ev.changedTouches[0].id, 1)

        device.onReceive(TOUCH_2_START)
        ev = touchstart.mock.calls[1].arguments[0]
        assert.equal(ev.touches.length, 2)
        assert.equal(ev.changedTouches[0].id, 2)

        // Independent moves
        const TOUCH_1_MOVE = Buffer.from('094d000001bf004f01', 'hex')
        const TOUCH_2_MOVE = Buffer.from('094d00000004000802', 'hex')
        device.onReceive(TOUCH_2_MOVE)
        ev = touchmove.mock.calls[0].arguments[0]
        assert.equal(ev.touches.length, 2)
        assert.equal(ev.changedTouches[0].id, 2)

        device.onReceive(TOUCH_1_MOVE)
        ev = touchmove.mock.calls[1].arguments[0]
        assert.equal(ev.touches.length, 2)
        assert.equal(ev.changedTouches[0].id, 1)

        // Remove one touch
        const TOUCH_1_REMOVE = Buffer.from('096d000001bf004f01', 'hex')
        device.onReceive(TOUCH_1_REMOVE)
        ev = touchend.mock.calls[0].arguments[0]
        assert.equal(ev.touches.length, 1)
        assert.equal(ev.changedTouches[0].id, 1)
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
        assert.doesNotThrow(() => device.onReceive(SAMPLE_MESSAGE))
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
        device = new LoupedeckCT()
        const fn = mock.fn()
        device.on('connect', fn)
        await device.connect()
        assert.deepEqual(fn.mock.calls[0].arguments[0], { address: '/dev/test1' })
        serialDiscovery.mock.restore()
        serialConnect.mock.restore()
        wsDiscovery.mock.restore()
        device.close()
    })
    it('connects to serial if path explicitly set', () => {
        device = new LoupedeckCT({ path: '/dev/test2' })
        assert(device.connection instanceof SerialConnection)
        device.close()
    })
    it('connects to websocket if host explicitly set', () => {
        device = new LoupedeckCT({ host: '255.255.255.255' })
        assert(device.connection instanceof WSConnection)
        device.close()
    })
    it('attempts reconnect if device not found', async() => {
        const serialDiscovery = mock.method(SerialConnection, 'discover', () => [])
        const wsDiscovery = mock.method(WSConnection, 'discover', () => [])
        const fn = mock.fn()
        device = new LoupedeckCT({ autoConnect: false, reconnectInterval: 20 })
        device.on('disconnect', fn)
        const connect = mock.method(device, 'connect')
        await assert.rejects(() => device.connect(), /no devices found/i)
        await delay(40)
        assert(connect.mock.calls.length >= 2)
        assert.match(fn.mock.calls[0].arguments[0].message, /no devices found/i)
        serialDiscovery.mock.restore()
        wsDiscovery.mock.restore()
        device.close()
    })
    it('attempts reconnect on error', async() => {
        device = new LoupedeckCT({ autoConnect: false, reconnectInterval: 20 })
        const connect = mock.method(device, 'connect', () => Promise.reject('some error'))
        device.onDisconnect('some error')
        await delay(40)
        assert(connect.mock.calls.length > 0)
        device.close()
    })
    it('does not attempt reconnect if closed before reconnect time', async() => {
        device = new LoupedeckCT({ autoConnect: false, reconnectInterval: 20 })
        const connect = mock.method(device, 'connect', () => {})
        device.onDisconnect('some error')
        device.onDisconnect()
        await delay(40)
        assert.equal(connect.mock.calls.length, 0)
    })
    it('does not attempt reconnect if reconnect interval not set', async() => {
        device = new LoupedeckCT({ autoConnect: false, reconnectInterval: false })
        const connect = mock.method(device, 'connect', () => {})
        device.onDisconnect('some error')
        await delay(100)
        assert.equal(connect.mock.calls.length, 0)
    })
    it('ignores commands if connection not open', () => {
        device = new LoupedeckCT({ path: '/dev/test3', autoConnect: false })
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
        const options = await LoupedeckCT.list()
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
        const options = await LoupedeckCT.list({ ignoreWebsocket: true })
        assert.equal(options.length, 2)
        const options2 = await LoupedeckCT.list({ ignoreSerial: true })
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
        device = new LoupedeckCT({ autoConnect: false })
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
        assert.equal(await connect1, undefined)
        assert.equal(await connect2, undefined)

        serialDiscovery.mock.restore()
        serialConnect.mock.restore()
        device.close()
    })
})

describe('Edge Cases', () => {
    beforeEach(() => {
        device = new LoupedeckCT({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('prevents transaction IDs of zero', () => {
        device.transactionID = 0xff
        device.send(0xffff, Buffer.alloc(0))
        assert(device.transactionID !== 0)
    })
})