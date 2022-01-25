const EventEmitter = require('events')

// Stand-in for a real WebSocket
class MockSocket extends EventEmitter {
    constructor(url) {
        super()
        this.url = url
        // Simulate connection attempt
        this.timeout = setTimeout(() => {
            if (!this.url.startsWith('ws://') ) {
                const err = new Error(`connect ECONNREFUSED ${url}`)
                this.emit('error', err)
                this.close(1006)
            }
            else {
                this.emit('open')
            }
        }, 10)
    }
    close(code = 1000) {
        clearTimeout(this.timeout)
        this.emit('close', code)
    }
    send() {}
    terminate() {
        clearTimeout(this.timeout)
        this.emit('close', 1006)
    }
}

module.exports = MockSocket