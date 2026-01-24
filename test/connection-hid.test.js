import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

// Mock fs module for HID device discovery
const mockReadFile = mock.fn(() => Promise.resolve(
    'HID_ID=0003:00001532:00000d09\nHID_NAME="Razer Stream Controller X"\n'
))

const mockReaddir = mock.fn(() => Promise.resolve([
    { name: 'hidraw0', isDirectory: () => false },
    { name: 'hidraw6', isDirectory: () => false },
]))

mock.module('fs/promises', {
    namedExports: {
        readdir: mockReaddir,
        readFile: mockReadFile,
    }
})

const HIDConnection = (await import('../connections/hid.js')).default

test('HID Connection - Discovery', async t => {
    await t.test('discovers HID devices on Linux', async() => {
        const devices = await HIDConnection.discover()
        assert(Array.isArray(devices))
        assert.equal(devices.length, 2)
        assert.equal(devices[0].connectionType, HIDConnection)
        assert.equal(devices[0].path, '/dev/hidraw0')
        assert.equal(devices[0].vendorId, 0x1532)
        assert.equal(devices[0].productId, 0x0d09)
    })

    await t.test('returns empty array on non-Linux platforms', async() => {
        const originalPlatform = process.platform
        Object.defineProperty(process, 'platform', {
            value: 'darwin',
            configurable: true,
        })
        try {
            const devices = await HIDConnection.discover()
            assert.equal(devices.length, 0)
        } finally {
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
                configurable: true,
            })
        }
    })

    await t.test('filters by Loupedeck and Razer vendor IDs', async() => {
        const devices = await HIDConnection.discover()
        assert(devices.some(d => d.vendorId === 0x1532))
    })
})

test('HID Connection - Lifecycle', async t => {
    await t.test('constructs with HID path', () => {
        const connection = new HIDConnection({ path: '/dev/hidraw6' })
        assert.equal(connection.hidPath, '/dev/hidraw6')
        assert.equal(connection.isConnected, false)
        assert.equal(connection.fd, null)
        connection.close()
    })

    await t.test('reports not ready before connection', () => {
        const connection = new HIDConnection({ path: '/dev/hidraw6' })
        assert.equal(connection.isReady(), false)
        connection.close()
    })
})

test('HID Connection - Report Processing', async t => {
    await t.test('processes button press reports', () => {
        const connection = new HIDConnection({ path: '/dev/hidraw6' })
        const messages = []
        connection.on('message', msg => {
            messages.push(msg)
        })

        const pressReport = Buffer.from([0x02, 0x1B, 0x01])
        connection.processHIDReport(pressReport)

        assert.equal(messages.length, 1)
        assert.equal(messages[0][0], 0x01)
        assert.equal(messages[0][1], 0x1B)
        assert.equal(messages[0][2], 0x01)

        const releaseReport = Buffer.from([0x02, 0x1B, 0x00])
        connection.processHIDReport(releaseReport)

        assert.equal(messages.length, 2)
        assert.equal(messages[1][0], 0x01)
        assert.equal(messages[1][1], 0x1B)
        assert.equal(messages[1][2], 0x00)

        connection.close()
    })

    await t.test('processes knob rotate reports', () => {
        const connection = new HIDConnection({ path: '/dev/hidraw6' })
        const messages = []
        connection.on('message', msg => {
            messages.push(msg)
        })

        const rotateReport = Buffer.from([0x03, 0x00, 0x01])
        connection.processHIDReport(rotateReport)

        assert.equal(messages.length, 1)
        assert.equal(messages[0][0], 0x02)
        assert.equal(messages[0][1], 0x00)
        assert.equal(messages[0][2], 0x01)

        connection.close()
    })

    await t.test('ignores reports with insufficient length', () => {
        const connection = new HIDConnection({ path: '/dev/hidraw6' })
        const messages = []
        connection.on('message', () => {
            messages.push('unexpected')
        })

        const shortReport = Buffer.from([0x02])
        connection.processHIDReport(shortReport)

        assert.equal(messages.length, 0)

        connection.close()
    })

    await t.test('ignores unknown report IDs', () => {
        const connection = new HIDConnection({ path: '/dev/hidraw6' })
        const messages = []
        connection.on('message', () => {
            messages.push('unexpected')
        })

        const unknownReport = Buffer.from([0xFF, 0x00, 0x00])
        connection.processHIDReport(unknownReport)

        assert.equal(messages.length, 0)

        connection.close()
    })
})

test('HID Connection - API Interface', async t => {
    await t.test('has send method', () => {
        assert.equal(typeof HIDConnection.send, 'function')
    })

    await t.test('has proper event emitter interface', () => {
        const connection = new HIDConnection({ path: '/dev/hidraw6' })
        assert.equal(typeof connection.on, 'function')
        assert.equal(typeof connection.emit, 'function')
        assert.equal(typeof connection.once, 'function')
        connection.close()
    })
})
