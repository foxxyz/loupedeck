import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { MagicByteLengthParser } from '../parser.js'

describe('MagicByteLengthParser', () => {
    it('transforms data by magic byte', () => {
        const parser = new MagicByteLengthParser({ magicByte: 0x32 })
        const fn = mock.fn()
        parser.on('data', fn)
        parser.write(Buffer.from([0x32, 0x01, 0x88, 0x32]))
        parser.write(Buffer.from([0x03, 0xff, 0x32, 0xff, 0x32, 0x02, 0xaa]))
        parser.write(Buffer.from([0xab]))
        assert.equal(fn.mock.calls.length, 3)
        assert.deepEqual(fn.mock.calls[0].arguments[0], Buffer.from([0x88]))
        assert.deepEqual(fn.mock.calls[1].arguments[0], Buffer.from([0xff, 0x32, 0xff]))
        assert.deepEqual(fn.mock.calls[2].arguments[0], Buffer.from([0xaa, 0xab]))
    })
    it('handles zero length indicators', () => {
        const parser = new MagicByteLengthParser({ magicByte: 0x11 })
        const fn = mock.fn()
        parser.on('data', fn)
        parser.write(Buffer.from([0x11, 0x00, 0x11, 0x11]))
        parser.write(Buffer.alloc(0x11).fill(0xff))
        assert.equal(fn.mock.calls.length, 1)
        assert.deepEqual(fn.mock.calls[0].arguments[0], Buffer.alloc(0x11).fill(0xff))
    })
    it('flushes on end', () => {
        const parser = new MagicByteLengthParser({ magicByte: 0xff })
        const fn = mock.fn()
        parser.on('data', fn)
        parser.write(Buffer.from([0xff, 0x03, 0x00]))
        assert.equal(fn.mock.calls.length, 0)
        parser.end()
        assert.deepEqual(fn.mock.calls[0].arguments[0], Buffer.from([0xff, 0x03, 0x00]))
    })
})
