import { jest } from '@jest/globals'
import { RazerStreamController } from '../index.js'

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
        device = new RazerStreamController({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('retrieves device information', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        const promise = device.getInfo()
        expect(sender).toHaveBeenCalledWith(Buffer.from('030301', 'hex'))
        device.onReceive(Buffer.from('1f0301525a32313031303133303030333936373030313338413030303120', 'hex'))
        await delay(20)
        expect(sender).toHaveBeenCalledWith(Buffer.from('030702', 'hex'))
        device.onReceive(Buffer.from('0c0702000208050000000000', 'hex'))
        await expect(promise).resolves.toEqual({
            version: '0.2.8',
            serial: 'RZ2101013000396700138A0001'
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
        device = new RazerStreamController({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('writes pixels to left display', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        device.drawScreen('left', (ctx, w, h) => {
            ctx.fillStyle = '#f00' // red
            ctx.fillRect(0, 0, w, h)
        })
        // Color format is 5-6-5 16-bit RGB
        // so first 5 bits for full red is 0xf800, or 0x00f8 in LE
        const pixels = '00f8'.repeat(60 * 270)
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 0, y: 0, width: 60, height: 270 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenNthCalledWith(2, Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to right display', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        device.drawScreen('right', (ctx, w, h) => {
            ctx.fillStyle = '#0f0' // green
            ctx.fillRect(0, 0, w, h)
        })
        // Color format is 5-6-5 16-bit RGB
        // so middle 6 bits for full green is 0x07e0, or 0xe007 in LE
        const pixels = 'e007'.repeat(60 * 270)
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 420, y: 0, width: 60, height: 270 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenNthCalledWith(2, Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to center display', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        device.drawScreen('center', (ctx, w, h) => {
            ctx.fillStyle = '#00f' // blue
            ctx.fillRect(0, 0, w, h)
        })
        // Color format is 5-6-5 16-bit RGB
        // so last 5 bits for full blue is 0x001f, or 0x1f00 in LE
        const pixels = '1f00'.repeat(360 * 270)
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 60, y: 0, width: 360, height: 270 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
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
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 180 + 60, y: 90, width: 90, height: 90 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(pixels)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenNthCalledWith(2, Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels without refreshing the screen', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        device.drawCanvas({ id: 'center', width: 10, height: 10, autoRefresh: false }, () => {})
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenCalledTimes(1)
    })
    // TODO: Mock canvas lib
    // it('informs the user if the canvas library is not installed', () => {
    //     jest.mock('canvas', () => {})
    //     expect(() => device.drawKey(6, () => {})).toThrow(/using callbacks requires the `canvas` library/i)
    // })
})
describe('Drawing (Buffer API)', () => {
    beforeEach(() => {
        device = new RazerStreamController({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('writes pixels to left display', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        const pixels = Array(60 * 270).fill([0x00, 0xf8])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('left', buffer)
        const hex = '00f8'.repeat(60 * 270)
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 0, y: 0, width: 60, height: 270 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenNthCalledWith(2, Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to right display', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        const pixels = Array(60 * 270).fill([0xe0, 0x07])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('right', buffer)
        // Color format is 5-6-5 16-bit RGB
        // so middle 6 bits for full green is 0x07e0, or 0xe007 in LE
        const hex = 'e007'.repeat(60 * 270)
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 420, y: 0, width: 60, height: 270 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenNthCalledWith(2, Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to center display', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        const pixels = Array(360 * 270).fill([0x1f, 0x00])
        const buffer = Buffer.from(pixels.flat())
        device.drawScreen('center', buffer)
        // Color format is 5-6-5 16-bit RGB
        // so last 5 bits for full blue is 0x001f, or 0x1f00 in LE
        const hex = '1f00'.repeat(360 * 270)
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 60, y: 0, width: 360, height: 270 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenNthCalledWith(2, Buffer.from('050f02004d', 'hex'))
    })
    it('writes pixels to a specific key area', async() => {
        const sender = jest.spyOn(device.connection, 'send')
        const pixels = Array(90 * 90 * 2).fill(0xff)
        const buffer = Buffer.from(pixels)
        device.drawKey(6, buffer)
        const hex = 'ffff'.repeat(90 * 90)
        expect(sender.mock.calls[0][0]).toBePixelBuffer({ displayID: 0x004d, x: 180 + 60, y: 90, width: 90, height: 90 })
        expect(sender.mock.calls[0][0].slice(13).toString('hex')).toEqual(hex)
        // Confirm write
        device.onReceive(Buffer.from('041001', 'hex'))
        await delay(10)
        expect(sender).toHaveBeenNthCalledWith(2, Buffer.from('050f02004d', 'hex'))
    })
    it('reports an error if the buffer is the wrong size', async() => {
        const pixels = Array(30).fill(0xff)
        const buffer = Buffer.from(pixels)
        await expect(device.drawScreen('left', buffer)).rejects.toThrow(/expected buffer length of 32400, got 30/i)
    })
})
