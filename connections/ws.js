const EventEmitter = require('events')
const { networkInterfaces } = require('os')
const WebSocket = require('ws')

const {
    CONNECTION_TIMEOUT,
} = require('../constants')

const DISCONNECT_CODES = {
    NORMAL: 1000,
    TIMEOUT: 1006,
}

class LoupedeckWSConnection extends EventEmitter {
    constructor({ host } = {}) {
        super()
        this.host = host
        // Track last interaction time
        this.lastTick = Date.now()
        // How long until declaring a timed out connetion
        this.connectionTimeout = CONNECTION_TIMEOUT
    }
    // Automatically find Loupedeck IP by scanning network interfaces
    static discover() {
        const interfaces = Object.values(networkInterfaces()).flat()
        const iface = interfaces.find(i => i.address.startsWith('100.127'))
        if (!iface) return
        return { host: iface.address.replace(/.2$/, '.1') }
    }
    checkConnected() {
        this._keepAliveTimer = setTimeout(this.checkConnected.bind(this), this.connectionTimeout * 2)
        if (Date.now() - this.lastTick > this.connectionTimeout) this.connection.terminate()
    }
    close() {
        clearTimeout(this._reconnectTimer)
        if (!this.connection) return
        this.connection.close()
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
    isReady() {
        return this.connection !== undefined && this.connection.readyState === this.connection.OPEN
    }
    onConnect() {
        this.emit('connect', { address: this.address })
        this._keepAliveTimer = setTimeout(this.checkConnected.bind(this), this.connectionTimeout * 2)
        this._connectionResolver()
    }
    onDisconnect(errCode) {
        let error = null
        switch(errCode) {
            case DISCONNECT_CODES.TIMEOUT:
                error = new Error('Connection timeout - was the device disconnected?')
        }
        clearTimeout(this._keepAliveTimer)
        this.emit('disconnect', error)
    }
    onReceive(buff) {
        this.lastTick = Date.now()
        this.emit('message', buff)
    }
    send(buff) {
        this.connection.send(buff)
    }
}

module.exports = LoupedeckWSConnection