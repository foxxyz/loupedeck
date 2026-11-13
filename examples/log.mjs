#!/usr/bin/env node
// Example script demonstrating HID device connection
// This script discovers and connects to Loupedeck/Razer devices via HID on Linux
// Run with `node examples/log.mjs`

import { LoupedeckDevice } from '../index.js'

async function main() {
    console.info('Loupedeck HID Device Discovery and Connection')
    console.info('==============================================\n')

    try {
        // Discover all available devices (including HID on Linux)
        console.info('Discovering devices...')
        const devices = await LoupedeckDevice.list()

        if (devices.length === 0) {
            console.info('No Loupedeck/Razer devices found.')
            console.info('\nOn Linux, make sure to run the setup script:')
            console.info('  sudo ./setup-hid.sh')
            process.exit(1)
        }

        console.info(`Found ${devices.length} device(s):\n`)

        devices.forEach((device, index) => {
            console.info(`Device ${index + 1}:`)
            console.info(`  Type: ${device.connectionType.name}`)
            console.info(`  Vendor ID: 0x${device.vendorId.toString(16).toUpperCase()}`)
            console.info(`  Product ID: 0x${device.productId.toString(16).toUpperCase()}`)
            if (device.path) {
                console.info(`  Path: ${device.path}`)
            }
            if (device.host) {
                console.info(`  Host: ${device.host}`)
            }
            console.info()
        })

        // Connect to the first device
        console.info('Connecting to first device...')
        const device = new LoupedeckDevice()

        device.on('connect', ({ address }) => {
            console.info(`✓ Connected to device at ${address}`)
        })

        device.on('disconnect', () => {
            console.info('✗ Device disconnected')
            process.exit(0)
        })

        device.on('down', ({ id }) => {
            console.info(`→ Button ${id} pressed`)
        })

        device.on('up', ({ id }) => {
            console.info(`← Button ${id} released`)
        })

        device.on('rotate', ({ id, delta }) => {
            console.info(`⟲ Knob ${id} rotated: ${delta > 0 ? 'right' : 'left'}`)
        })

        device.on('touchmove', ({ x, y }) => {
            console.info(`↻ Touch at: ${x}, ${y}`)
        })

        device.on('error', err => {
            console.error(`✗ Error: ${err.message}`)
            process.exit(1)
        })

        console.info('\nListening for device events...')
        console.info('(Press Ctrl+C to exit)\n')

        // Keep the script running
        await new Promise(() => {})
    } catch (err) {
        console.error(`✗ Error: ${err.message}`)
        process.exit(1)
    }
}

main()
