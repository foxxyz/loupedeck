import { MagicByteLengthParser } from '../parser'
import { jest } from '@jest/globals'

describe('MagicByteLengthParser', () => {
    it('transforms data by magic byte', () => {
        const parser = new MagicByteLengthParser({ magicByte: 0x32 })
        const fn = jest.fn()
        parser.on('data', fn)
        parser.write(Buffer.from([0x32, 0x01, 0x88, 0x32]))
        parser.write(Buffer.from([0x03, 0xff, 0x32, 0xff, 0x32, 0x02, 0xaa]))
        parser.write(Buffer.from([0xab]))
        expect(fn).toHaveBeenCalledTimes(3)
        expect(fn.mock.calls[0][0]).toEqual(Buffer.from([0x88]))
        expect(fn.mock.calls[1][0]).toEqual(Buffer.from([0xff, 0x32, 0xff]))
        expect(fn.mock.calls[2][0]).toEqual(Buffer.from([0xaa, 0xab]))
    })
    it('handles zero length indicators', () => {
        const parser = new MagicByteLengthParser({ magicByte: 0x11 })
        const fn = jest.fn()
        parser.on('data', fn)
        parser.write(Buffer.from([0x11, 0x00, 0x11, 0x11]))
        parser.write(Buffer.alloc(0x11).fill(0xff))
        expect(fn).toHaveBeenCalledTimes(1)
        expect(fn.mock.calls[0][0]).toEqual(Buffer.alloc(0x11).fill(0xff))
    })
    it('flushes on end', () => {
        const parser = new MagicByteLengthParser({ magicByte: 0xff })
        const fn = jest.fn()
        parser.on('data', fn)
        parser.write(Buffer.from([0xff, 0x03, 0x00]))
        expect(fn).not.toHaveBeenCalled()
        parser.end()
        expect(fn).toHaveBeenCalledWith(Buffer.from([0xff, 0x03, 0x00]))
    })
})
