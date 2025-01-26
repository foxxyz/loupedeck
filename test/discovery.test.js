import { discover, LoupedeckLive, LoupedeckLiveS } from '../index.js'
import { jest } from '@jest/globals'
import { SerialPort } from 'serialport'

describe('Device Discovery', () => {
    it('reports if no devices found', async() => {
        const spy = mock.method(SerialPort, 'list', () => [
            {
                path: '/dev/cu.usbmodem-222',
                manufacturer: 'Apple',
                serialNumber: 'G4429927',
                locationId: '14100001',
                vendorId: '8aaa',
                productId: '52b5'
            }
        ])
        await assert.equal(discover()).rejects.toThrow(/no devices found/i)
        spy.mock.restore()
    })
    it('can auto-discover a Loupedeck Live device', async() => {
        const spy = mock.method(SerialPort, 'list', () => [
            {
                path: '/dev/cu.usbmodem-333',
                manufacturer: 'Loupedeck',
                serialNumber: 'LDD12345678',
                locationId: '14100002',
                vendorId: '2ec2',
                productId: '0004'
            }
        ])
        const device = await discover({ autoConnect: false })
        assert.equal(device).toBeInstanceOf(LoupedeckLive)
        spy.mock.restore()
    })
    it('can auto-discover a Loupedeck Live S device', async() => {
        const spy = mock.method(SerialPort, 'list', () => [
            {
                path: '/dev/cu.usbmodem-444',
                manufacturer: 'Loupedeck',
                serialNumber: 'LDD12345678',
                locationId: '14100000',
                vendorId: '2ec2',
                productId: '0006'
            }
        ])
        const device = await discover({ autoConnect: false })
        assert.equal(device).toBeInstanceOf(LoupedeckLiveS)
        spy.mock.restore()
    })
    it('errors on unknown devices', async() => {
        const spy = mock.method(SerialPort, 'list', () => [
            {
                path: '/dev/cu.usbmodem-444',
                manufacturer: 'Loupedeck',
                serialNumber: 'LDD12345678',
                locationId: '14100000',
                vendorId: '2ec2',
                productId: '000d'
            }
        ])
        await assert.equal(discover()).rejects.toThrow(/not yet supported/i)
        spy.mock.restore()
    })
})
