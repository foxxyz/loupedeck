const { Transform } = require('stream')

// Parser to split incoming serial data by a magic byte sequence
// followed by a length
class MagicByteLengthParser extends Transform {
    constructor({ magicByte, ...args }) {
        super(args)
        this.delimiter = magicByte
        this.buffer = Buffer.alloc(0)
    }
    _transform(chunk, encoding, cb) {
        let data = Buffer.concat([this.buffer, chunk])
        let position
        while ((position = data.indexOf(this.delimiter)) !== -1) {
            // We need to at least be able to read the length byte
            if (data.length < position + 2) break
            const nextLength = data[position + 1]
            // Make sure we have enough bytes to meet this length
            const expectedEnd = position + nextLength + 2
            if (data.length < expectedEnd) break
            this.push(data.slice(position + 2, expectedEnd))
            data = data.slice(expectedEnd)
        }
        this.buffer = data
        cb()
    }
    _flush(cb) {
        this.push(this.buffer)
        this.buffer = Buffer.alloc(0)
        cb()
    }
}

module.exports = MagicByteLengthParser