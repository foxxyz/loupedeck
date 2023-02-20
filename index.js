const { LoupedeckCT, LoupedeckLive, LoupedeckLiveS } = require('./device')
const { HAPTIC } = require('./constants')
const { discover } = require('./discovery')

module.exports = {
    discover,
    LoupedeckCT,
    LoupedeckLive,
    LoupedeckLiveS,
    HAPTIC
}