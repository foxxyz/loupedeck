import * as ALL_DEVICES from './device.js'

export async function discover(args) {
    const devices = await ALL_DEVICES.LoupedeckDevice.list()
    if (devices.length === 0) throw new Error('No devices found')
    const { productId, ...connectArgs } = devices[0]
    const deviceType = Object.values(ALL_DEVICES).find(dev => dev.productId === productId)
    if (!deviceType) throw new Error(`Device with product ID ${productId} not yet supported! Please file an issue at https://github.com/foxxyz/loupedeck/issues`)
    const device = new deviceType({ ...args, ...connectArgs })
    return device
}
