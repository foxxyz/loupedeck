const DEVICES = require('./device')
const { HAPTIC } = require('./constants')
const { discover } = require('./discovery')

module.exports = {
    discover,
    HAPTIC,
    ...DEVICES,
}