<template>
    <h1>Loupedeck WebSerial Example</h1>
    <button v-if="!connected" @click="request" type="button">
        Connect Device
    </button>
    <p class="info" v-if="deviceInfo.type">
        {{ deviceInfo.type }} connected with serial {{ deviceInfo.serial }} and firmware {{ deviceInfo.version }}
    </p>
    <div v-if="deviceInfo.type === 'Loupedeck Live S'" class="loupedecklives">
        <loupedeck-button :pressed="state.buttons[0]" color="#0f0" />
        <loupedeck-button :pressed="state.buttons[1]" color="#666" />
        <loupedeck-button :pressed="state.buttons[2]" color="#666" />
        <loupedeck-button :pressed="state.buttons[3]" color="#666" />
        <loupedeck-knob :pressed="state.buttons.knobTL" :rotation="state.knobTL" />
        <loupedeck-knob :pressed="state.buttons.knobCL" :rotation="state.knobCL" />
        <div class="screen">
            <div v-for="idx in 15" :key="idx" />
            <canvas width="480" height="270" ref="screenCanvas" />
        </div>
    </div>
    <div v-else-if="deviceInfo.type" class="loupedeck">
        <h3>Test</h3>
    </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'

import { Buffer } from 'buffer'
window.Buffer = Buffer

import { discover } from 'loupedeck'

import loupedeckButton from './components/loupedeck-button.vue'
import loupedeckKnob from './components/loupedeck-knob.vue'

const connected = ref(false)
const deviceInfo = reactive({
    serial: null,
    version: null,
    type: null
})
const state = reactive({
    buttons: {
        0: false,
        1: false,
        2: false,
        3: false,
        knobTL: false,
        knobCL: false,
    },
    knobTL: 0,
    knobCL: 0,
    knobBL: 0,
    knobTR: 0,
    knobCR: 0,
    knobBR: 0,
})

const screenCanvas = ref()
let screenCtx
function render({ touches }) {
    if (!screenCtx) return
    screenCtx.clearRect(0, 0, screenCtx.canvas.width, screenCtx.canvas.height)
    screenCtx.fillStyle = '#ffffff88'
    for (const touch of touches) {
        screenCtx.beginPath()
        screenCtx.arc(touch.x, touch.y, 16, 0, 2 * Math.PI)
        screenCtx.fill()
    }
}

async function request() {
    let device
    try {
        device = await discover()
    } catch (e) {
        return console.error(e.message)
    }

    device.on('connect', async() => {
        connected.value = true
        // Load device info
        deviceInfo.type = device.type
        Object.assign(deviceInfo, await device.getInfo())
        screenCtx = screenCanvas.value.getContext('2d')
    })

    console.log(device)

    device.on('down', ({ id }) => {
        state.buttons[id] = true
    })
    device.on('up', ({ id }) => {
        state.buttons[id] = false
    })
    device.on('rotate', ({ id, delta }) => {
        state[id] += delta
    })
    device.on('touchstart', render)
    device.on('touchmove', render)
    device.on('touchend', render)
}
request()
</script>

<style lang="sass">
body
    background: linear-gradient(to bottom, #000, #333)
    color: #eee
    font-size: 16px
    font-family: sans-serif
    min-height: 100vh
    padding: 1rem 2rem

.loupedecklives
    //background: url(./images/loupedeck-live-s.png)
    background-color: #444
    max-width: 50rem
    background-size: 100%
    width: 100%
    background-repeat: no-repeat
    aspect-ratio: 1.76
    position: relative
    container-type: size
    border-radius: 8% / calc(8% * 1.76)

    @container (min-width: 0px)
        .screen
            border-radius: 2cqw
            padding: 1.5cqw 3cqw
            > div
                width: calc((100% - 5cqw - 10px) / 5)
                aspect-ratio: 1
                margin: .5cqw
                background: #222
                border-radius: 1cqw
                border: inset 1px gray

    .button
        position: absolute
        width: 7.8%
        &:nth-child(1)
            left: 4.5%
            top: 71%
        &:nth-child(2)
            right: 4.5%
            top: 15%
        &:nth-child(3)
            right: 4.5%
            top: 43%
        &:nth-child(4)
            right: 4.5%
            top: 71%
    .knob
        width: 11%
        position: absolute
        &:nth-child(5)
            left: 3.2%
            top: 13%
        &:nth-child(6)
            left: 3.2%
            top: 41%

    .screen
        width: 66%
        aspect-ratio: 1.7
        background: black
        position: absolute
        left: 50%
        margin-left: -33%
        top: 12%
        border: inset 3px gray
        flex-wrap: wrap
        display: flex
        align-items: center
        box-sizing: border-box
        canvas
            position: absolute
            top: 0
            left: 0
            width: 100%
            height: 100%
        > div
            aspect-ratio: 1
            background: #222
            border: inset 1px gray
</style>
