const LoupedeckSerialDevice = require('./serial')
const LoupedeckWSDevice = require('./ws')

class LoupedeckDevice {
    constructor({ path, host, autoConnect = true } = {}) {
        // Return specific type if path or host specified
        if (path) return new LoupedeckSerialDevice({ path, autoConnect })
        if (host) return new LoupedeckWSDevice({ host, autoConnect })
        try {
            const host = LoupedeckWSDevice.autoDiscover()
            return new LoupedeckWSDevice({ host, autoConnect })
        }
        catch(e) {
            return new LoupedeckSerialDevice({ autoConnect })
        }
    }
}

module.exports = {
    LoupedeckDevice
}
