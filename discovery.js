const ALL_DEVICES = require('./device')

async function discover() {
    const devices = await ALL_DEVICES.LoupedeckDevice.list()
    if (devices.length === 0) throw new Error('No devices found')
    const { productId, ...args } = devices[0]
    const deviceType = Object.values(ALL_DEVICES).find(dev => dev.productId === productId)
    if (!deviceType) throw new Error(`Device with product ID ${productId} not yet supported! Please file an issue at https://github.com/foxxyz/loupedeck/issues`)
    const device = new deviceType(args)
    return device
}

module.exports = {
    discover
}