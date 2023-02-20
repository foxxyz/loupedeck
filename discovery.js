const { LoupedeckDevice, LoupedeckLive, LoupedeckLiveS } = require('./device')

const USB_PRODUCT_IDS = {
    4: LoupedeckLive,
    6: LoupedeckLiveS,
}

async function discover() {
    const devices = await LoupedeckDevice.list()
    if (devices.length === 0) throw new Error('No devices found')
    const { productId, ...args } = devices[0]
    const deviceType = USB_PRODUCT_IDS[parseInt(productId)]
    if (!deviceType) throw new Error(`Device with product ID ${productId} not yet supported! Please file an issue at https://github.com/foxxyz/loupedeck/issues`)
    const device = new deviceType(args)
    return device
}

module.exports = {
    discover
}