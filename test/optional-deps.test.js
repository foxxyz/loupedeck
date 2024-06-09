import { jest } from '@jest/globals'
jest.unstable_mockModule('canvas', () => ({}))
const { LoupedeckLiveS } = await import('../index.js')

let device
describe('Optional Dependencies', () => {
    beforeEach(() => {
        device = new LoupedeckLiveS({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('informs the user if the canvas library is not installed', () => {
        expect(() => device.drawKey(6, () => {})).toThrow(/using callbacks requires the `canvas` library/i)
    })
})