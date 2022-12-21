const { LoupedeckDevice, LoupedeckLive, LoupedeckLiveS } = require('..')

const { SerialPort } = require('serialport')

describe('Device Discovery', () => {
    it('reports if no devices found', async() => {
        const spy = jest.spyOn(SerialPort, 'list').mockImplementation(() => [
            {
                path: '/dev/cu.usbmodem-222',
                manufacturer: 'Apple',
                serialNumber: 'G4429927',
                locationId: '14100001',
                vendorId: '8aaa',
                productId: '52b5'
            }
        ])
        await expect(LoupedeckDevice.discover()).rejects.toThrow(/no devices found/i)
        spy.mockRestore()
    })
    it('can auto-discover a Loupedeck Live device', async() => {
        const device = await LoupedeckDevice.discover()
        expect(device).toBeInstanceOf(LoupedeckLive)
    })
    it('can auto-discover a Loupedeck Live S device', async() => {
        const spy = jest.spyOn(SerialPort, 'list').mockImplementation(() => [
            {
                path: '/dev/cu.usbmodem-444',
                manufacturer: 'Loupedeck',
                serialNumber: 'LDD12345678',
                locationId: '14100000',
                vendorId: '2ec2',
                productId: '0006'
            }
        ])
        const device = await LoupedeckDevice.discover()
        expect(device).toBeInstanceOf(LoupedeckLiveS)
        spy.mockRestore()
    })
    it('errors on unknown devices', async() => {
        const spy = jest.spyOn(SerialPort, 'list').mockImplementation(() => [
            {
                path: '/dev/cu.usbmodem-444',
                manufacturer: 'Loupedeck',
                serialNumber: 'LDD12345678',
                locationId: '14100000',
                vendorId: '2ec2',
                productId: '000d'
            }
        ])
        await expect(LoupedeckDevice.discover()).rejects.toThrow(/not yet supported/i)
        spy.mockRestore()
    })
})
