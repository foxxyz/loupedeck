import { jest } from '@jest/globals'
import * as serialport from '../__mocks__/serialport.js'
jest.unstable_mockModule('serialport', () => serialport)
const { SerialPort } = await import('serialport')
const SerialConnection = (await import('../connections/serial.js')).default

let connection

describe('v0.2.X Connection', () => {
    it('auto-discovers valid connections', async() => {
        expect(await SerialConnection.discover()).toEqual([{ connectionType: SerialConnection, path: '/dev/cu.usbmodem-333', productId: 0x0004, serialNumber: 'LDD12345678', vendorId: 0x2ec2 }])
    })
    it('connects via direct instantiation', async() => {
        connection = new SerialConnection({ path: '/dev/fake-path' })
        const fn = jest.fn()
        connection.on('connect', fn)
        await connection.connect()
        expect(fn).toHaveBeenCalledWith({ address: '/dev/fake-path' })
        connection.close()
    })
    it('prepends small outgoing messages', async() => {
        connection = new SerialConnection()
        await connection.connect()
        const sender = jest.spyOn(connection.connection, 'write')
        const TEST_MESSAGE = Buffer.from([0x88])
        connection.send(TEST_MESSAGE)
        expect(sender).toHaveBeenCalledTimes(2)
        expect(sender).toHaveBeenCalledWith(Buffer.from([0x82, 0x81, 0x00, 0x00, 0x00, 0x00]))
        expect(sender).toHaveBeenCalledWith(TEST_MESSAGE)
        connection.close()
    })
    it('prepends large outgoing messages', async() => {
        connection = new SerialConnection()
        await connection.connect()
        const sender = jest.spyOn(connection.connection, 'write')
        const TEST_MESSAGE = Buffer.alloc(4000).fill(0xff)
        connection.send(TEST_MESSAGE)
        expect(sender).toHaveBeenCalledTimes(2)
        expect(sender).toHaveBeenCalledWith(Buffer.from([0x82, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0f, 0xa0, 0x00, 0x00, 0x00, 0x00]))
        expect(sender).toHaveBeenCalledWith(TEST_MESSAGE)
        connection.close()
    })
    it('reports ready to receive', async() => {
        connection = new SerialConnection()
        expect(connection.isReady()).toBe(false)
        await connection.connect()
        expect(connection.isReady()).toBe(true)
        connection.close()
    })
    it('reports on connection failure', async() => {
        const mockWriter = jest.spyOn(SerialPort.prototype, 'write').mockImplementation(function() {
            this.emit('data', 'nonsense')
        })
        connection = new SerialConnection()
        await expect(connection.connect()).rejects.toMatch(/Invalid handshake/)
        mockWriter.mockRestore()
    })
    it('reports connection errors', async() => {
        const logger = jest.spyOn(console, 'error')
        connection = new SerialConnection()
        await connection.connect()
        const mockWriter = jest.spyOn(connection.connection, 'write').mockImplementation(function() {
            this.emit('error', new Error('write error'))
        })
        connection.send(Buffer.from([0xff]))
        expect(logger).toHaveBeenCalledWith(expect.stringMatching(/write error/))
        connection.close()
        mockWriter.mockRestore()
    })
})