#!/usr/bin/env node
const { LoupedeckDevice } = require('../..')

const loupedeck = new LoupedeckDevice()

loupedeck.on('connect', async({ address }) => {
    console.info(`✅ Connected to Loupedeck at ${address}`)
    const { serial, version } = await loupedeck.getInfo()
    console.info(`Device serial number ${serial}, software version ${version}`)
    loupedeck.setBrightness(1)
    await drawKeyColors(loupedeck)
    cycleColors(loupedeck)
})

loupedeck.on('disconnect', err => {
    console.info(`Connection to Loupedeck lost (${err.message}). Reconnecting in ${loupedeck.reconnectInterval / 1000}s...`)
})

loupedeck.on('down', ({ id }) => {
    console.log(`Button ${id} pressed`)
    if (id === 'circle') drawKeyColors(loupedeck)
})

loupedeck.on('up', ({ id }) => {
    console.log(`Button ${id} released`)
})

loupedeck.on('rotate', ({ id, delta }) => {
    console.log(`Knob ${id} rotated ${delta > 0 ? 'right' : 'left'}`)
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
    const buttons = ['circle', '1', '2', '3', '4', '5', '6', '7']
    let idx = 0
    setInterval(() => {
        const id = buttons[idx]
        const r = Math.round(Math.random() * 255)
        const g = Math.round(Math.random() * 255)
        const b = Math.round(Math.random() * 255)
        device.setButtonColor({ id, color: `rgba(${r}, ${g}, ${b})` })
        idx = (idx + 1) % buttons.length
    }, 100)
}

// Draw solid colors on each key screen
async function drawKeyColors(device) {
    const colors = ['#f66', '#f95', '#fb4', '#fd6', '#ff9', '#be9', '#9e9', '#9db', '#9cc', '#88c', '#c9c', '#d89']
    for(let i = 0; i < 12; i++) {
        await device.drawKey(i, (ctx, w, h) => {
            ctx.fillStyle = colors[i]
            ctx.fillRect(0, 0, w, h)
        })
    }
    await device.drawScreen('left', (ctx, w, h) => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, w, h)
    })
    await device.drawScreen('right', (ctx, w, h) => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, w, h)
    })
}
