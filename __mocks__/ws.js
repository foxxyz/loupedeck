import EventEmitter from 'node:events'

// Stand-in for a real WebSocket
export class MockSocket extends EventEmitter {
    constructor(url) {
        super()
        this.url = url
        // Simulate connection attempt
        this.timeout = setTimeout(() => {
            if (!this.url.startsWith('ws://')) {
                const err = new Error(`connect ECONNREFUSED ${url}`)
                this.emit('error', err)
                this.emit('close', 1006)
            } else {
                this.opened = true
                this.emit('open')
            }
        }, 10)
    }
    close(code = 1000) {
        clearTimeout(this.timeout)
        // Like `ws`, closing before the handshake completes is an error
        if (!this.opened) {
            this.emit('error', new Error('WebSocket was closed before the connection was established'))
            code = 1006
        }
        this.emit('close', code)
    }
    // eslint-disable-next-line class-methods-use-this
    send() {
        // do nothing
    }
    terminate() {
        clearTimeout(this.timeout)
        this.emit('close', 1006)
    }
}
