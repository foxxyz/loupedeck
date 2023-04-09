<template>
    <div :class="['loupedeck button square', { pressed }]" :style="{ '--color': color, '--label': `'${label}'` }" />
</template>

<script setup>
defineProps({
    label: {
        type: String,
        default: '',
    },
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
.loupedeck.button.square
    position: relative
    aspect-ratio: 1
    border-radius: 10%
    border: outset 2px #333
    background: #444
    &.pressed
        background: #777
        &:after
            background: #777
    &:before
        content: var(--label)
        display: block
        opacity: .7
        position: absolute
        padding: .5em
        right: 0
        bottom: 0
        color: var(--color)
</style>