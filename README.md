Loupedeck: Node.js Interface
============================

Unofficial Node.js API for Loupedeck Live devices.

**Alpha version: Partial Functionality**

Supports:

 * Reading button presses
 * Reading knob turns
 * Reading touch events
 * Setting button colors

Not supported yet:

 * Writing touchscreen graphics

Requirements
------------

 * Node 10+

Installation
------------

```shell
npm install loupedeck
```

Usage Examples
--------------

```javascript
const { openLoupedeck } = require('loupedeck')

// Detects and opens first connected device
const device = openLoupedeck()

// Observe connect events
device.on('connect', () => {
    console.info('Connection successful!')
})

// React to button presses
device.on('down', ({ id }) => {
    console.info(`Button pressed: ${id}`)
})

// React to knob turns
device.on('rotate', ({ id, delta }) => {
    console.info(`Knob ${id} rotated: ${delta}`)
})
```

For a longer example, see [`example.js`](/example.js).

License
-------

MIT
