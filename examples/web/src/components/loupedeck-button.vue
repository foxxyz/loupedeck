<template>
    <div :class="['loupedeck button', { pressed }]" :style="`--color: ${color}`" />
</template>

<script setup>
defineProps({
    color: {
        type: String,
        default: 'grey'
    },
    pressed: {
        type: Boolean,
        default: false
    }
})
</script>

<style lang="sass">
.loupedeck.button
    aspect-ratio: 1
    border-radius: 100%
    border: outset 2px #333
    background: #444
    &.pressed
        background: #777
        &:after
            background: #777
    &:before
        content: ''
        display: block
        opacity: .7
        width: 50%
        height: 50%
        margin-left: -25%
        margin-top: -25%
        position: absolute
        left: 50%
        top: 50%
        background: var(--color)
        border-radius: 100%
        box-shadow: 0 0 .5em var(--color)
    &:after
        content: ''
        display: block
        width: 40%
        height: 40%
        margin-left: -20%
        margin-top: -20%
        position: absolute
        left: 50%
        top: 50%
        background: #444
        border-radius: 100%
</style>