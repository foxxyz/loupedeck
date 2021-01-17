const { LoupedeckDevice } = require('..')

let device
describe('Messages', () => {
    beforeAll(async() => {
        device = new LoupedeckDevice({ ip: '255.255.255.255' })
    })
    it('processes button presses', async() => {
        const SAMPLE_MESSAGE = Buffer.from('0500000900', 'hex')
        const fn = jest.fn()
        device.on('down', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith({ id: '2' })
    })
    it('processes button releases', async() => {
        const SAMPLE_MESSAGE = Buffer.from('0500000701', 'hex')
        const fn = jest.fn()
        device.on('up', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith({ id: 'circle' })
    })
    it('processes clockwise knob turns', async() => {
        const SAMPLE_MESSAGE = Buffer.from('0501000101', 'hex')
        const fn = jest.fn()
        device.on('rotate', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith({ id: 'knobTL', delta: 1 })
    })
    it('processes counter-clockwise knob turns', async() => {
        const SAMPLE_MESSAGE = Buffer.from('05010005ff', 'hex')
        const fn = jest.fn()
        device.on('rotate', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith({ id: 'knobCR', delta: -1 })
    })
    it('processes screen touches', async() => {
        const SAMPLE_MESSAGE = Buffer.from('094d0000007300e213', 'hex')
        const fn = jest.fn()
        device.on('touch', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith({ x: 115, y: 226 })
    })
    it('processes screen touchends', async() => {
        const SAMPLE_MESSAGE = Buffer.from('096d000001bf004c12', 'hex')
        const fn = jest.fn()
        device.on('touchend', fn)
        device.onReceive(SAMPLE_MESSAGE)
        expect(fn).toHaveBeenCalledWith({ x: 447, y: 76 })
    })
})

