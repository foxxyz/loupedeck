import EventEmitter from 'node:events'

const WS_UPGRADE_HEADER = `GET /index.html
HTTP/1.1
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Key: 123abc

`
const WS_UPGRADE_RESPONSE = `HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: PLOTDYCXHOTMeouth==

`

// Stand-in for a Loupedeck serial device
export class SerialPort extends EventEmitter {
    static list() {
        return [
            {
                path: '/dev/cu.usbmodem-222',
                manufacturer: 'Apple',
                serialNumber: 'G4429927',
                locationId: '14100001',
                vendorId: '8aaa',
                productId: '52b5'
            },
            {
                path: '/dev/cu.usbmodem-333',
                manufacturer: 'Loupedeck',
                serialNumber: 'LDD12345678',
                locationId: '14100000',
                vendorId: '2ec2',
                productId: '0004'
            }
        ]
    }
    constructor({ path }) {
        super()
        this.path = path
        this.isOpen = false
        // Simulate connection attempt
        this.timeout = setTimeout(() => {
            this.isOpen = true
            this.emit('open')
        }, 10)
    }
    close() {
        clearTimeout(this.timeout)
        this.emit('close')
    }
    // eslint-disable-next-line class-methods-use-this
    pipe() {
        // do nothing
    }
    write(buff) {
        if (buff.toString() === WS_UPGRADE_HEADER) this.emit('data', Buffer.from(WS_UPGRADE_RESPONSE))
    }
}
