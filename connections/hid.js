import { Emitter as EventEmitter } from 'strict-event-emitter'
import { openSync, readSync, closeSync, constants } from 'fs'
import { readdir, readFile } from 'fs/promises'
import path from 'path'

const VENDOR_IDS = [
    0x2ec2, // Loupedeck
    0x1532, // Razer
]

// HID Report ID mapping for Razer Stream Controller
const HID_REPORT_MAPPING = {
    BUTTON_PRESS: 0x02,
    KNOB_ROTATE: 0x03,
}

export default class LoupedeckHIDConnection extends EventEmitter {
    constructor({ path: hidPath } = {}) {
        super()
        this.hidPath = hidPath
        this.fd = null
        this.isConnected = false
        this.readBuffer = Buffer.alloc(512)
        this.pollInterval = null
        this.transactionID = 0
    }

    // Discover HID devices on Linux
    static async discover() {
        const results = []

        // Only run on Linux
        if (process.platform !== 'linux') return results

        try {
            const hidrawDir = '/sys/class/hidraw'
            const entries = await readdir(hidrawDir, { withFileTypes: true })

            for (const entry of entries) {
                // Skip directories but process symlinks (which report isDirectory: false)
                if (entry.isDirectory()) continue

                const device = await this.checkDevice(entry.name, hidrawDir)
                if (device) results.push(device)
            }
        } catch {
            // /sys/class/hidraw might not exist
        }

        return results
    }

    static async checkDevice(deviceName, hidrawDir) {
        try {
            const hidPath = path.join(hidrawDir, deviceName)
            const infoPath = path.join(hidPath, 'device', 'uevent')

            const content = await readFile(infoPath, 'utf-8')

            let vendorId
            let productId

            for (const line of content.split('\n')) {
                if (line.startsWith('HID_ID=')) {
                    // Format: HID_ID=0003:00001532:00000D09
                    // We need the vendor (1532) and product (D09)
                    const parts = line.split('=')[1].split(':')
                    if (parts.length >= 3) {
                        vendorId = parseInt(parts[1], 16)
                        productId = parseInt(parts[2], 16)
                    }
                }
            }

            if (!vendorId || !VENDOR_IDS.includes(vendorId)) return null

            return {
                connectionType: this,
                path: `/dev/${deviceName}`,
                vendorId,
                productId,
            }
        } catch {
            // Skip devices we can't read
            return null
        }
    }

    close() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval)
            this.pollInterval = null
        }

        if (this.fd !== null) {
            try {
                closeSync(this.fd)
            } catch {
                // Already closed
            }
            this.fd = null
        }

        this.isConnected = false
        this.emit('disconnect')
    }

    connect() {
        if (process.platform !== 'linux') {
            throw new Error('HID connection only supported on Linux')
        }

        try {
            // Open the HID device
            this.fd = openSync(this.hidPath, constants.O_RDONLY | constants.O_NONBLOCK)
            this.isConnected = true

            // Start polling for HID reports
            this.startPolling()

            this.emit('connect', { address: this.hidPath })
            return Promise.resolve()
        } catch (err) {
            this.isConnected = false
            return Promise.reject(new Error(`Failed to open HID device ${this.hidPath}: ${err.message}`))
        }
    }

    startPolling() {
        // Poll every 10ms for HID reports
        this.pollInterval = setInterval(() => {
            if (!this.isConnected || this.fd === null) return

            try {
                const bytesRead = readSync(this.fd, this.readBuffer, 0, 512)
                if (bytesRead > 0) {
                    this.processHIDReport(this.readBuffer.slice(0, bytesRead))
                }
            } catch (err) {
                // EAGAIN means no data available, which is expected
                if (err.code !== 'EAGAIN' && err.code !== 'EWOULDBLOCK') {
                    console.error('HID read error:', err.message)
                    this.close()
                }
            }
        }, 10)
    }

    processHIDReport(report) {
        if (report.length < 3) return

        const reportId = report[0]

        // Convert HID report to device protocol format
        // Device expects: [msgLength, command, transactionID, ...data]
        let command = null
        let data = null

        if (reportId === HID_REPORT_MAPPING.BUTTON_PRESS) {
            // Button report: [0x02, buttonId, state]
            const buttonId = report[1]
            const state = report[2]

            command = 0x00 // BUTTON_PRESS command (correct value)
            data = Buffer.alloc(2)
            data[0] = buttonId
            data[1] = state
        } else if (reportId === HID_REPORT_MAPPING.KNOB_ROTATE) {
            // Knob report: [0x03, knobId, direction]
            const knobId = report[1]
            const direction = report[2]

            command = 0x01 // KNOB_ROTATE command (correct value)
            data = Buffer.alloc(2)
            data[0] = knobId
            data[1] = direction
        }

        if (command !== null && data !== null) {
            // Build message: [msgLength, command, transactionID, ...data]
            // msgLength includes msgLength byte (1) + command (1) + transactionID (1) + data.length
            const msgLength = 3 + data.length
            const message = Buffer.alloc(msgLength)
            message[0] = msgLength
            message[1] = command
            message[2] = this.transactionID++
            data.copy(message, 3)

            this.emit('message', message)
        }
    }

    isReady() {
        return this.isConnected && this.fd !== null
    }

    static send() {
        // HID is read-only for input reports on Linux
        // Command sending would require write access and proper HID protocol
    }
}
