
const WSConnection = require('./connections/ws')
const SerialConnection = require('./connections/serial')

async function listDevices({ ignoreSerial, ignoreWebsocket } = {}) {
    const ps = []

    if (!ignoreSerial) ps.push(SerialConnection.discover())
    if (!ignoreWebsocket) ps.push(WSConnection.discover())

    // Run them in parallel
    const rawDevices = await Promise.all(ps)

    return rawDevices.flat()
}

module.exports = listDevices