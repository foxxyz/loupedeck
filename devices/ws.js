const { networkInterfaces } = require('os')
const WebSocket = require('ws')

const LoupedeckBase = require('./base')

class LoupedeckWSDevice extends LoupedeckBase {
    constructor({ host, autoConnect = true } = {}) {
        super()
        this.host = host
        // Connect automatically if desired
        if (autoConnect) this.connect().catch(console.error)
    }
    // Automatically find Loupedeck IP by scanning network interfaces
    static autoDiscover() {
        const interfaces = Object.values(networkInterfaces()).flat()
        const iface = interfaces.find(i => i.address.startsWith('100.127'))
        if (!iface) throw new Error('No Loupedeck devices found!')
        return iface.address.replace(/.2$/, '.1')
    }
    connect() {
        this.address = `ws://${this.host}`
        this.connection = new WebSocket(this.address)
        this.connection.on('open', this.onConnect.bind(this))
        this.connection.on('message', this.onReceive.bind(this))
        this.connection.on('close', this.onDisconnect.bind(this))
        return new Promise(res => {
            this._connectionResolver = res
        })
    }
    _send(buff) {
        this.connection.send(buff)
    }
}

module.exports = LoupedeckWSDevice