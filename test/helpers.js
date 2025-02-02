import assert from 'node:assert/strict'

export function assertIsPixelBuffer(received, { displayID, x, y, width, height }) {
    assert(received.readUInt16BE(0) === 0xff10, `Header should be 0xff10, found 0x${received.readUInt16BE().toString(16)}`)
    assert(received.readUInt16BE(3) === displayID, `Display ID should be ${displayID}, but found 0x${received.readUInt16BE(3).toString(16)}`)
    assert(received.readUInt16BE(5) === x, `X coordinate should be ${x}, but found ${received.readUInt16BE(3)}`)
    assert(received.readUInt16BE(7) === y, `Y coordinate should be ${y}, but found ${received.readUInt16BE(5)}`)
    assert(received.readUInt16BE(9) === width, `Width should be ${width}, but found ${received.readUInt16BE(9)}`)
    assert(received.readUInt16BE(11) === height, `Height should be ${height}, but found ${received.readUInt16BE(11)}`)
    const correctLength = 13 + width * height * 2
    assert(received.length === correctLength, `Buffer length should be ${correctLength}, but found ${received.length}`)
}

export const delay = ms => new Promise(res => setTimeout(res, ms))
