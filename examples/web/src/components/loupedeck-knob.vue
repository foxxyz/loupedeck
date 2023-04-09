<template>
    <div :class="['loupedeck knob', { pressed }]" :style="{ transform: `rotate(${rotation * DEG_PER_UNIT}deg)` }" />
</template>

<script setup>
defineProps({
    pressed: {
        type: Boolean,
        default: false
    },
    rotation: {
        type: Number,
        default: 0
    }
})

// Encoder seems to have 30 indents per full revolution,
// so 360 / 30 = 12 degrees per tick
const DEG_PER_UNIT = 12
</script>

<style lang="sass">
.loupedeck.knob
    aspect-ratio: 1
    border-radius: 100%
    background: radial-gradient(#000, #777)
    border: solid 2px #111
    &.pressed
        background: #ffffff33
    &:before
        content: ''
        display: block
        width: 10%
        background: #aaa
        height: 20%
        left: 50%
        top: 0
        position: absolute
        margin-left: -5%
    &:after
        content: ''
        display: block
        width: 70%
        height: 70%
        margin-left: calc(-35% - 2px)
        margin-top: calc(-35% - 2px)
        position: absolute
        left: 50%
        top: 50%
        background: #444
        border: solid 2px #222
        border-radius: 100%
</style>