#!/usr/bin/env node
import { discover } from '../../index.js'

let loupedeck
while (!loupedeck) {
    try {
        loupedeck = await discover()
    } catch (e) {
        console.error(`${e}. Reattempting in 3 seconds...`)
        await new Promise(res => setTimeout(res, 3000))
    }
}
let brightness = 1
let vibration = 0

loupedeck.on('connect', async({ address }) => {
    console.info(`✅ Connected to ${loupedeck.type} at ${address}`)
    const { serial, version } = await loupedeck.getInfo()
    console.info(`Device serial number ${serial}, software version ${version}`)
    loupedeck.setBrightness(1)
    await drawKeyColors(loupedeck)
    cycleColors(loupedeck)
})

loupedeck.on('disconnect', err => {
    console.info(`Connection to Loupedeck lost (${err?.message}). Reconnecting in ${loupedeck.reconnectInterval / 1000}s...`)
})

loupedeck.on('down', ({ id }) => {
    console.log(`Button ${id} pressed`)
    if (id === 0) drawKeyColors(loupedeck)
})

loupedeck.on('up', ({ id }) => {
    console.log(`Button ${id} released`)
})

loupedeck.on('rotate', ({ id, delta }) => {
    console.log(`Knob ${id} rotated ${delta > 0 ? 'right' : 'left'}`)
    // Control brightness with top right knob
    if (id === 'knobCL') {
        brightness = Math.min(1, Math.max(0, brightness + delta * 0.1))
        console.log(`Setting brightness level ${Math.round(brightness * 100)}%`)
        loupedeck.setBrightness(brightness)
    }
    // Test vibrations with top left knob
    if (id === 'knobTL') {
        vibration = Math.min(0xff, Math.max(0, vibration + delta))
        console.log(`Testing vibration #${vibration}`)
        loupedeck.vibrate(vibration)
    }
    // Rotate graphic with CT dial (Loupedeck CT only)
    if (id === 'knobCT') {
        rotation += delta * Math.PI / 20 // 40 ticks per rotation
        loupedeck.drawScreen('knob', drawGrid)
    }
})

loupedeck.on('touchstart', ({ changedTouches: [touch] }) => {
    console.log(`Touch #${touch.id} started: x: ${touch.x}, y: ${touch.y}`)
    // Clear key when touched
    if (touch.target.key !== undefined) {
        loupedeck.drawKey(touch.target.key, (ctx, w, h) => {
            ctx.fillStyle = 'black'
            ctx.fillRect(0, 0, w, h)
        })
    }
})

loupedeck.on('touchmove', ({ changedTouches: [touch] }) => {
    console.log(`Touch #${touch.id} moved: x: ${touch.x}, y: ${touch.y}`)
})

loupedeck.on('touchend', ({ changedTouches: [touch] }) => {
    console.log(`Touch #${touch.id} ended: x: ${touch.x}, y: ${touch.y}`)
})

// Cycle through random button colors
function cycleColors(device) {
    let idx = 0
    setInterval(() => {
        const id = device.buttons[idx]
        const r = Math.round(Math.random() * 255)
        const g = Math.round(Math.random() * 255)
        const b = Math.round(Math.random() * 255)
        device.setButtonColor({ id, color: `rgba(${r}, ${g}, ${b})` })
        idx = (idx + 1) % device.buttons.length
    }, 100)
}

let rotation = Math.PI
function drawGrid(ctx, w, h) {
    const half = w / 2
    ctx.save()
    ctx.translate(half, half)
    ctx.rotate(rotation)
    ctx.fillStyle = '#f66'
    ctx.fillRect(-half, -half, half, half)
    ctx.fillStyle = '#fd6'
    ctx.fillRect(0, -half, half, half)
    ctx.fillStyle = '#9e9'
    ctx.fillRect(-half, 0, half, half)
    ctx.fillStyle = '#88c'
    ctx.fillRect(0, 0, half, half)
    ctx.restore()
}

// Draw solid colors on each key screen
async function drawKeyColors(device) {
    const colors = ['#f66', '#f95', '#fb4', '#fd6', '#ff9', '#be9', '#9e9', '#9db', '#9cc', '#88c', '#c9c', '#d89']
    for (let i = 0; i < device.rows * device.columns; i++) {
        await device.drawKey(i, (ctx, w, h) => {
            ctx.fillStyle = colors[i % colors.length]
            ctx.fillRect(0, 0, w, h)
        })
    }
    // Only applicable for Loupedeck Live/CT
    if (device.displays.left) {
        await device.drawScreen('left', (ctx, w, h) => {
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, w, h)
        })
    }
    // Only applicable for Loupedeck Live/CT
    if (device.displays.right) {
        await device.drawScreen('right', (ctx, w, h) => {
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, w, h)
        })
    }
    // Only applicable for Loupedeck CT
    if (device.displays.knob) {
        await device.drawScreen('knob', drawGrid)
    }
}
