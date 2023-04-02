<template>
    <div :class="['loupedeck knobct', { pressed }]" :style="{ transform: `rotate(${rotation * DEG_PER_UNIT}deg)` }" />
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
.loupedeck.knobct
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
        width: 84%
        height: 84%
        margin-left: calc(-42% - 2px)
        margin-top: calc(-42% - 2px)
        position: absolute
        left: 50%
        top: 50%
        background: #000
        border: solid 2px #222
        border-radius: 100%
</style>