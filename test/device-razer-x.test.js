import { jest } from '@jest/globals'
import { RazerStreamControllerX } from '../index.js'

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
        device = new RazerStreamControllerX({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('retrieves device information', async() => {
        const sender = mock.method(device.connection, 'send')
        const promise = device.getInfo()
        assert.equal(sender.mock.calls[0].arguments[0], Buffer.from('030301', 'hex'))
        device.onReceive(Buffer.from('1f03015055323532344c303637303032313020202020202020202020202020', 'hex'))
        await delay(20)
        assert.equal(sender.mock.calls[0].arguments[0], Buffer.from('030702', 'hex'))
        device.onReceive(Buffer.from('0c0702000217000000000000', 'hex'))
        await assert.equal(promise, {
            version: '0.2.23',
            serial: 'PU2524L06700210'
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
    it('cannot set button color', () => {
        assert.equal(() => device.setButtonColor({ id: 'triangle', color: 'blue' })).toThrow(/Setting key color not available on this device/)
    })
    it('cannot vibrate', () => {
        assert.equal(() => device.vibrate()).toThrow(/Vibration not available on this device/)
    })
    it('emits a `touchstart` and a `down` event when a key is pressed', () => {
        const touchListener = mock.fn()
        const downListener = mock.fn()
        device.on('touchstart', touchListener)
        device.on('down', downListener)
        device.onReceive(Buffer.from('0500002900', 'hex'))
        assert.equal(downListener.calls[0].arguments[0], { id: 14 })
        assert.equal(touchListener.calls[0].arguments[0], {
            touches: [{ id: 0, x: 4.5 * 96, y: 2.5 * 96, target: { key: 14 } }],
            changedTouches: [{ id: 0, x: 4.5 * 96, y: 2.5 * 96, target: { key: 14 } }]
        })
    })
})
describe('Drawing (Callback API)', () => {
    beforeEach(() => {
        device = new RazerStreamControllerX({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('writes pixels to main display', async() => {
        const sender = mock.method(device.connection, 'send')
        device.drawScreen('center', (ctx, w, h) => {
            ctx.fillStyle = '#00f' // blue
            ctx.fillRect(0, 0, w, h)
        })
        // Color format is 5-6-5 16-bit RGB
        // so last 5 bits for full blue is 0x001f, or 0x1f00 in LE
        const pixels = '1f00'.repeat(480 * 288)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 0, y: 0, width: 480, height: 288 })
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
        const pixels = 'ffff'.repeat(96 * 96)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 96, y: 96, width: 96, height: 96 })
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
        device = new RazerStreamControllerX({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('writes pixels to center display', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(480 * 288).fill([0x1f, 0x00])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('center', buffer)
        // Color format is 5-6-5 16-bit RGB
        // so last 5 bits for full blue is 0x001f, or 0x1f00 in LE
        const hex = '1f00'.repeat(480 * 288)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 0, y: 0, width: 480, height: 288 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.equal(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to a specific key area', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(96 * 96 * 2).fill(0xff)
        const buffer = Buffer.from(pixels)
        device.drawKey(6, buffer)
        const hex = 'ffff'.repeat(96 * 96)
        assert.equal(sender.mock.calls[0].arguments[0]).toBePixelBuffer({ displayID: 0x004d, x: 96, y: 96, width: 96, height: 96 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.equal(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('reports an error if the buffer is the wrong size', async() => {
        const pixels = Array(30).fill(0xff)
        const buffer = Buffer.from(pixels)
        await assert.equal(device.drawScreen('center', buffer)).rejects.toThrow(/expected buffer length of 276480, got 30/i)
    })
})
