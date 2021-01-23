const EventEmitter = require('events')

// Stand-in for a real WebSocket
class MockSocket extends EventEmitter {
    constructor(url) {
        super()
        this.url = url
        // Simulate connection attempt
        setTimeout((() => {
            if (!this.url.startsWith('ws://') ) {
                const err = new Error(`connect ECONNREFUSED ${url}`)
                this.emit('error', err)
                this.close(1006)
            } else {
                this.emit('open')
            }
        }).bind(this), 50)
    }
    close(code) {
        this.emit('close', { code })
    }
    send() {}
}

module.exports = MockSocket