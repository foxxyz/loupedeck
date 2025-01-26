import assert from 'node:assert/strict'
import { beforeEach, describe, it, mock } from 'node:test'
import { assertIsPixelBuffer, delay } from './helpers.js'
import { RazerStreamController } from '../index.js'
 
let device

describe('Commands', () => {
    beforeEach(() => {
        device = new RazerStreamController({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('retrieves device information', async() => {
        const sender = mock.method(device.connection, 'send')
        const promise = device.getInfo()
        assert.deepEqual(sender.mock.calls[0].arguments[0], Buffer.from('030301', 'hex'))
        device.onReceive(Buffer.from('1f0301525a32313031303133303030333936373030313338413030303120', 'hex'))
        await delay(20)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('030702', 'hex'))
        device.onReceive(Buffer.from('0c0702000208050000000000', 'hex'))
        assert.deepEqual(await promise, {
            version: '0.2.8',
            serial: 'RZ2101013000396700138A0001'
        })
    })
    it('rejects retrieving device information if not connected', async() => {
        device.connection = { send: () => {}, isReady: () => false }
        const promise = device.getInfo()
        assert.rejects(promise, /not connected/i)
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
        device.setButtonColor({ id: 4, color: 'red' })
        assert.deepEqual(sender.mock.calls[0].arguments[0], Buffer.from('0702010bff0000', 'hex'))
    })
    it('errors on unknown button passed', () => {
        assert.throws(() => device.setButtonColor({ id: 'triangle', color: 'blue' }), /Invalid button/)
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
        device = new RazerStreamController({ autoConnect: false })
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
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 0, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
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
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 420, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
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
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 60, y: 0, width: 360, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to a specific key area', async() => {
        const sender = mock.method(device.connection, 'send')
        device.drawKey(6, (ctx, w, h) => {
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 0, w, h)
        })
        const pixels = 'ffff'.repeat(90 * 90)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 180 + 60, y: 90, width: 90, height: 90 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
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
        device = new RazerStreamController({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('writes pixels to left display', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(60 * 270).fill([0x00, 0xf8])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('left', buffer)
        const hex = '00f8'.repeat(60 * 270)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 0, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to right display', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(60 * 270).fill([0xe0, 0x07])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('right', buffer)
        // Color format is 5-6-5 16-bit RGB
        // so middle 6 bits for full green is 0x07e0, or 0xe007 in LE
        const hex = 'e007'.repeat(60 * 270)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 420, y: 0, width: 60, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to center display', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(360 * 270).fill([0x1f, 0x00])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('center', buffer)
        // Color format is 5-6-5 16-bit RGB
        // so last 5 bits for full blue is 0x001f, or 0x1f00 in LE
        const hex = '1f00'.repeat(360 * 270)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 60, y: 0, width: 360, height: 270 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to a specific key area', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(90 * 90 * 2).fill(0xff)
        const buffer = Buffer.from(pixels)
        device.drawKey(6, buffer)
        const hex = 'ffff'.repeat(90 * 90)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 180 + 60, y: 90, width: 90, height: 90 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('reports an error if the buffer is the wrong size', async() => {
        const pixels = Array(30).fill(0xff)
        const buffer = Buffer.from(pixels)
        await assert.rejects(device.drawScreen('left', buffer), /expected buffer length of 32400, got 30/i)
    })
})
