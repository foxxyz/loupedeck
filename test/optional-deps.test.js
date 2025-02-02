import assert from 'node:assert/strict'
import { beforeEach, describe, it, mock } from 'node:test'
mock.module('canvas', {})
const { LoupedeckLiveS } = await import('../index.js')

let device
describe('Optional Dependencies', () => {
    beforeEach(() => {
        device = new LoupedeckLiveS({ autoConnect: false })
        device.connection = { send: () => {}, isReady: () => true }
    })
    it('informs the user if the canvas library is not installed', () => {
        assert.throws(() => device.drawKey(6, () => {}), /using callbacks requires the `canvas` library/i)
    })
})