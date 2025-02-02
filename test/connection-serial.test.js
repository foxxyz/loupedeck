import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { MockSerialPort } from '../__mocks__/serialport.js'
mock.module('serialport', {
    namedExports: { SerialPort: MockSerialPort }
})
const { SerialPort } = await import('serialport')
const SerialConnection = (await import('../connections/serial.js')).default

let connection

describe('v0.2.X Connection', () => {
    it('auto-discovers valid connections', async() => {
        assert.deepEqual(await SerialConnection.discover(), [{ connectionType: SerialConnection, path: '/dev/cu.usbmodem-333', productId: 0x0004, serialNumber: 'LDD12345678', vendorId: 0x2ec2 }])
    })
    it('connects via direct instantiation', async() => {
        connection = new SerialConnection({ path: '/dev/fake-path' })
        const fn = mock.fn()
        connection.on('connect', fn)
        await connection.connect()
        assert.deepEqual(fn.mock.calls[0].arguments[0], { address: '/dev/fake-path' })
        connection.close()
    })
    it('prepends small outgoing messages', async() => {
        connection = new SerialConnection()
        await connection.connect()
        const sender = mock.method(connection.connection, 'write')
        const TEST_MESSAGE = Buffer.from([0x88])
        connection.send(TEST_MESSAGE)
        assert.equal(sender.mock.calls.length, 2)
        assert.deepEqual(sender.mock.calls[0].arguments[0], Buffer.from([0x82, 0x81, 0x00, 0x00, 0x00, 0x00]))
        assert.equal(sender.mock.calls[1].arguments[0], TEST_MESSAGE)
        connection.close()
    })
    it('prepends large outgoing messages', async() => {
        connection = new SerialConnection()
        await connection.connect()
        const sender = mock.method(connection.connection, 'write')
        const TEST_MESSAGE = Buffer.alloc(4000).fill(0xff)
        connection.send(TEST_MESSAGE)
        assert.equal(sender.mock.calls.length, 2)
        assert.deepEqual(sender.mock.calls[0].arguments[0], Buffer.from([0x82, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0f, 0xa0, 0x00, 0x00, 0x00, 0x00]))
        assert.equal(sender.mock.calls[1].arguments[0], TEST_MESSAGE)
        connection.close()
    })
    it('reports ready to receive', async() => {
        connection = new SerialConnection()
        assert.equal(connection.isReady(), false)
        await connection.connect()
        assert.equal(connection.isReady(), true)
        connection.close()
    })
    it('reports on connection failure', async() => {
        const mockWriter = mock.method(SerialPort.prototype, 'write', function() {
            this.emit('data', 'nonsense')
        })
        connection = new SerialConnection()
        await assert.rejects(() => connection.connect(), /Invalid handshake/i)
        mockWriter.mock.restore()
    })
    it('reports connection errors', async() => {
        const logger = mock.method(console, 'error')
        connection = new SerialConnection()
        await connection.connect()
        const mockWriter = mock.method(connection.connection, 'write', function() {
            this.emit('error', new Error('write error'))
        })
        connection.send(Buffer.from([0xff]))
        assert.match(logger.mock.calls[0].arguments[0], /write error/i)
        connection.close()
        mockWriter.mock.restore()
    })
})