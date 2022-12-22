const { LoupedeckLive, LoupedeckLiveS } = require('./device')
const { HAPTIC } = require('./constants')
const { discover, listDevices } = require('./discovery')

module.exports = {
    discover,
    listDevices,
    LoupedeckLive,
    LoupedeckLiveS,
    HAPTIC
}