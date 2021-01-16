#!/usr/bin/env node
const { openLoupedeck } = require('.')

const loupedeck = openLoupedeck()

loupedeck.on('connect', ({ url }) => {
    console.info(`✅ Connected to Loupedeck at ${url}`)
})

loupedeck.on('down', ({ id }) => {
    console.log(`Button ${id} pressed`)
})

loupedeck.on('up', ({ id }) => {
    console.log(`Button ${id} released`)
})

loupedeck.on('rotate', ({ id, delta }) => {
    console.log(`Knob ${id} rotated ${delta > 0 ? 'right' : 'left'}`)
})

loupedeck.on('touch', ({ x, y }) => {
    console.log(`Touch detected: x: ${x}, y: ${y}`)
})

// Cycle through random button colors
loupedeck.on('connect', () => {
    const buttons = ['circle', '1', '2', '3', '4', '5', '6', '7']
    let idx = 0
    setInterval(() => {
        const id = buttons[idx]
        const r = Math.round(Math.random() * 255)
        const g = Math.round(Math.random() * 255)
        const b = Math.round(Math.random() * 255)
        loupedeck.setColor({ id, r, g, b })
        idx = (idx + 1) % buttons.length
    }, 100)
})