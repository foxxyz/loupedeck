<template>
    <h1>Loupedeck Web Serial Example</h1>
    <button v-if="!connected" @click="request" type="button">
        Request Access
    </button>
    <div class="loupedecklives">
        <div :class="['button', { active: state.buttons[0] }]" />
        <div :class="['button', { active: state.buttons[1] }]" />
        <div :class="['button', { active: state.buttons[2] }]" />
        <div :class="['button', { active: state.buttons[3] }]" />
        <div :class="['knob', { active: state.buttons.knobTL }]" :style="{ transform: `rotate(${state.knobTL * DEG_PER_UNIT}deg)` }" />
        <div :class="['knob', { active: state.buttons.knobCL }]" :style="{ transform: `rotate(${state.knobCL * DEG_PER_UNIT}deg)` }" />
        <div class="screen">
            <div v-for="idx in 15" :key="idx" />
        </div>
    </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

import { Buffer } from 'buffer'
window.Buffer = Buffer

import { discover } from 'loupedeck'

// Encoder seems to have 30 indents per full revolution,
// so 360 / 30 = 12 degrees per tick
const DEG_PER_UNIT = 12

const connected = ref(false)
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

async function request() {
    const device = await discover()
    device.on('connect', () => connected.value = true)

    device.on('down', ({ id }) => {
        state.buttons[id] = true
    })
    device.on('up', ({ id }) => {
        state.buttons[id] = false
    })
    device.on('rotate', ({ id, delta }) => {
        state[id] += delta
    })
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

.loupedecklives
    //background: url(./images/loupedeck-live-s.png)
    background-color: #444
    border-radius: 8vw
    background-size: 100%
    width: 100%
    background-repeat: no-repeat
    aspect-ratio: 1.76
    position: relative

    .button
        width: 7.8%
        aspect-ratio: 1
        position: absolute
        border-radius: 100%
        border: solid 2px black
        background: #ffffff22
        &.active
            background: #ffffff88
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
        width: 7.8%
        aspect-ratio: 1
        border-radius: 100%
        background: red
        position: absolute
        &.active
            background: #ffffff88
        &:before
            content: ''
            display: block
            width: 10%
            background: black
            height: 20%
            left: 50%
            top: -10%
            position: absolute
            margin-left: -5%
        &:nth-child(5)
            left: 4.5%
            top: 15%
        &:nth-child(6)
            left: 4.5%
            top: 43%

    .screen
        width: 66%
        aspect-ratio: 1.7
        background: black
        position: absolute
        left: 50%
        margin-left: -33%
        top: 12%
        border: inset 3px gray
        border-radius: 2vw
        flex-wrap: wrap
        display: flex
        align-items: center
        padding: 1.5vw 3vw
        box-sizing: border-box
        > div
            width: calc((100% - 5vw - 10px) / 5)
            aspect-ratio: 1
            margin: .5vw
            background: #222
            border-radius: 1vw
            border: inset 1px gray
</style>
