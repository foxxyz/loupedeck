import assert from 'node:assert/strict'
import { beforeEach, describe, it, mock } from 'node:test'
import { assertIsPixelBuffer, delay } from './helpers.js'

import { MockSocket } from '../__mocks__/ws.js'
import { MockSerialPort } from '../__mocks__/serialport.js'
mock.module('ws', { defaultExport: MockSocket })
mock.module('serialport', {
    namedExports: { SerialPort: MockSerialPort }
})
import { RazerStreamControllerX } from '../index.js'

let device

describe('Commands', () => {
    beforeEach(() => {
        device = new RazerStreamControllerX({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('retrieves device information', async() => {
        const sender = mock.method(device.connection, 'send')
        const promise = device.getInfo()
        assert.deepEqual(sender.mock.calls[0].arguments[0], Buffer.from('030301', 'hex'))
        device.onReceive(Buffer.from('1f03015055323532344c303637303032313020202020202020202020202020', 'hex'))
        await delay(20)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('030702', 'hex'))
        device.onReceive(Buffer.from('0c0702000217000000000000', 'hex'))
        assert.deepEqual(await promise, {
            version: '0.2.23',
            serial: 'PU2524L06700210'
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
    it('cannot set button color', () => {
        assert.throws(() => device.setButtonColor({ id: 'triangle', color: 'blue' }), /Setting key color not available on this device/)
    })
    it('cannot vibrate', () => {
        assert.throws(() => device.vibrate(), /Vibration not available on this device/)
    })
    it('emits a `touchstart` and a `down` event when a key is pressed', () => {
        const touchListener = mock.fn()
        const downListener = mock.fn()
        device.on('touchstart', touchListener)
        device.on('down', downListener)
        device.onReceive(Buffer.from('0500002900', 'hex'))
        assert.deepEqual(downListener.mock.calls[0].arguments[0], { id: 14 })
        assert.deepEqual(touchListener.mock.calls[0].arguments[0], {
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
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 0, y: 0, width: 480, height: 288 })
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
        const pixels = 'ffff'.repeat(96 * 96)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 96, y: 96, width: 96, height: 96 })
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
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 0, y: 0, width: 480, height: 288 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to a specific key area', async() => {
        const sender = mock.method(device.connection, 'send')
        const pixels = Array(96 * 96 * 2).fill(0xff)
        const buffer = Buffer.from(pixels)
        device.drawKey(6, buffer)
        const hex = 'ffff'.repeat(96 * 96)
        assertIsPixelBuffer(sender.mock.calls[0].arguments[0], { displayID: 0x004d, x: 96, y: 96, width: 96, height: 96 })
        assert.equal(sender.mock.calls[0].arguments[0].slice(13).toString('hex'), hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        assert.deepEqual(sender.mock.calls[1].arguments[0], Buffer.from('050f02004d', 'hex'))
    })
    it('reports an error if the buffer is the wrong size', async() => {
        const pixels = Array(30).fill(0xff)
        const buffer = Buffer.from(pixels)
        await assert.rejects(device.drawScreen('center', buffer), /expected buffer length of 276480, got 30/i)
    })
})
