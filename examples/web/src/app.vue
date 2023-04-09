<template>
    <h1>Loupedeck WebSerial Example</h1>
    <button v-if="!connected" @click="request" type="button">
        Connect Device
    </button>
    <div class="force">
        Force device (for debugging):
        <select v-model="forceDevice">
            <option value="">
                None
            </option>
            <option v-for="type of DEVICE_TYPES" :key="type" :value="type.name">
                {{ type.name }}
            </option>
        </select>
    </div>
    <p class="info" v-if="deviceInfo">
        {{ deviceInfo.type }} connected with serial {{ deviceInfo.serial }} and firmware {{ deviceInfo.version }}
    </p>
    <div v-if="deviceInfo" :class="['device', deviceInfo.id]">
        <div class="buttons">
            <loupedeck-button
                v-for="idx of deviceInfo.buttons.slice(0, 8)"
                :key="idx"
                :pressed="state.buttons[idx]"
                :color="idx === 0 ? '#0f0' : '#666'"
            />
        </div>
        <loupedeck-knob
            v-for="key of deviceInfo.knobs"
            :key="key"
            :class="key"
            :pressed="state.buttons[key]"
            :rotation="state[key]"
        />
        <div class="square-buttons left" v-if="deviceInfo.buttons.length > 8">
            <loupedeck-button-square
                v-for="idx of deviceInfo.buttons.slice(8, 14)"
                :key="idx"
                :pressed="state.buttons[idx]"
            />
        </div>
        <div class="square-buttons right" v-if="deviceInfo.buttons.length > 8">
            <loupedeck-button-square
                v-for="idx of deviceInfo.buttons.slice(14)"
                :key="idx"
                :pressed="state.buttons[idx]"
            />
        </div>
        <loupedeck-knob-ct
            v-if="deviceInfo.id === 'LoupedeckCT'"
            :rotation="state.knobCT"
        />
        <div class="screen">
            <div v-for="idx in (deviceInfo.columns * deviceInfo.rows)" :key="idx" />
            <div v-if="deviceInfo.displays.left" class="left" />
            <div v-if="deviceInfo.displays.right" class="right" />
            <canvas width="480" height="270" ref="screenCanvas" />
        </div>
    </div>
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue'

import { Buffer } from 'buffer'
window.Buffer = Buffer

import { discover, LoupedeckLive, LoupedeckLiveS, LoupedeckCT } from 'loupedeck'

import loupedeckButton from './components/loupedeck-button.vue'
import loupedeckButtonSquare from './components/loupedeck-button-square.vue'
import loupedeckKnob from './components/loupedeck-knob.vue'
import loupedeckKnobCt from './components/loupedeck-knob-ct.vue'

const DEVICE_TYPES = [
    LoupedeckCT,
    LoupedeckLive,
    LoupedeckLiveS,
]

const connected = ref(false)
const deviceInfo = ref()
const state = reactive({
    buttons: {
        0: false,
        1: false,
        2: false,
        3: false,
        4: false,
        5: false,
        6: false,
        7: false,
        knobTL: false,
        knobCL: false,
        knobBL: false,
        knobTR: false,
        knobCR: false,
        knobBR: false,
    },
    knobCT: 0,
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
        if (touch.target.screen === 'knob') continue
        screenCtx.beginPath()
        screenCtx.arc(touch.x, touch.y, 16, 0, 2 * Math.PI)
        screenCtx.fill()
    }
}

function touchstart({ touches, changedTouches: [touch] }) {
    // Color key when touched
    const colors = ['#f66', '#f95', '#fb4', '#fd6', '#ff9', '#be9', '#9e9', '#9db', '#9cc', '#88c', '#c9c', '#d89']
    if (touch.target.key !== undefined) {
        device.drawKey(touch.target.key, (ctx, w, h) => {
            ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]
            ctx.fillRect(0, 0, w, h)
        })
    }
    render({ touches })
}

let device
async function request() {
    try {
        device = await discover()
    } catch (e) {
        return console.error(e.message)
    }

    device.on('connect', async() => {
        connected.value = true
        // Load device info
        const info = Object.assign({}, device)
        Object.assign(info, await device.getInfo())
        info.id = device.constructor.name
        deviceInfo.value = info
        await nextTick()
        screenCtx = screenCanvas.value.getContext('2d')
    })

    device.on('disconnect', () => {
        connected.value = false
        deviceInfo.value = null
    })

    device.on('down', ({ id }) => {
        state.buttons[id] = true
    })
    device.on('up', ({ id }) => {
        state.buttons[id] = false
    })
    device.on('rotate', ({ id, delta }) => {
        state[id] += delta
    })
    device.on('touchstart', touchstart)
    device.on('touchmove', render)
    device.on('touchend', render)
}
request()

// Force override (for debugging)
const forceDevice = ref('')
watch(forceDevice, value => {
    const deviceType = DEVICE_TYPES.find(t => t.name === value)
    if (!deviceType) {
        connected.value = false
        deviceInfo.value = null
        return
    }
    connected.value = true
    device = new deviceType({ autoConnect: false })
    const info = Object.assign({
        id: value,
        serial: 'TESTING',
        version: 'TESTING'
    }, device)
    deviceInfo.value = info
})
</script>

<style lang="sass">
body
    background: linear-gradient(to bottom, #000, #333)
    color: #eee
    font-size: 16px
    font-family: sans-serif
    min-height: 100vh
    padding: 1rem 2rem

.device
    background-color: #444
    max-width: 50rem
    background-size: 100%
    width: 100%
    background-repeat: no-repeat
    aspect-ratio: 1.48
    position: relative
    container-type: size
    border-radius: 8% / calc(8% * 1.48)
    .button
        width: 7.8%
    .buttons
        display: flex
    .knob
        width: 9%
    .screen
        width: 66%
        background: black
        position: absolute
        left: 50%
        margin-left: -33%
        top: 10%
        border: inset 3px gray
        flex-wrap: wrap
        display: flex
        align-items: center
        box-sizing: border-box
        canvas
            position: absolute
            top: 0
            left: 0
            height: 100%
            width: 100%

.LoupedeckLive, .LoupedeckCT
    @container (min-width: 0px)
        .screen
            border-radius: 2cqw
            padding: 1.5cqw 3cqw
            > div
                width: calc((100% - 5cqw) / 4)
                aspect-ratio: 1
                margin: .5cqw
                background: #222
                border-radius: 1cqw
                border: inset 1px gray

    .buttons
        position: absolute
        top: 74%
        width: 100%
        display: flex
        justify-content: space-evenly
        .button
            width: 7.8%

    .knob
        width: 9%
        position: absolute
        &.knobTL
            left: 3.2%
            top: 8%
        &.knobCL
            left: 3.2%
            top: 32%
        &.knobBL
            left: 3.2%
            top: 55%
        &.knobTR
            right: 3.2%
            top: 8%
        &.knobCR
            right: 3.2%
            top: 32%
        &.knobBR
            right: 3.2%
            top: 55%

    .screen
        padding: 2% 9%
        > div
            aspect-ratio: 1
            background: #222
            border: inset 1px gray
            &.left, &.right
                position: absolute
            &.left
                top: 4%
                left: 1.5%
                height: 88%
                width: 10%
            &.right
                top: 4%
                right: 1.5%
                height: 88%
                width: 10%

.LoupedeckCT
    background-size: cover
    aspect-ratio: 0.96
    border-radius: 8% / calc(8% * 0.96)
    .knob
        &.knobTL
            left: 3.2%
            top: 6%
        &.knobCL
            left: 3.2%
            top: 21%
        &.knobBL
            left: 3.2%
            top: 36%
        &.knobTR
            right: 3.2%
            top: 6%
        &.knobCR
            right: 3.2%
            top: 21%
        &.knobBR
            right: 3.2%
            top: 36%
    .knobct
        position: absolute
        bottom: 6%
        left: 33%
        width: 33%
    .screen
        top: 7%
    .square-buttons
        position: absolute
        bottom: 0
        padding: 5cqw 4cqw
        width: 25%
        display: flex
        flex-wrap: wrap
        .button
            width: 11cqw
            margin: .3cqw
        &.left
            left: 0
        &.right
            right: 0
    .buttons
        top: 48%

.LoupedeckLiveS
    aspect-ratio: 1.76
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
        position: absolute !important
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
        &.knobTL
            left: 3.2%
            top: 13%
        &.knobCL
            left: 3.2%
            top: 41%

    .screen
        aspect-ratio: 1.7
        top: 12%
        > div
            aspect-ratio: 1
            background: #222
            border: inset 1px gray

.force
    position: absolute
    opacity: .3
    right: 0
    top: 0
    padding: 1rem
    color: gray
    font-size: .7em
    select
        background: gray
</style>
