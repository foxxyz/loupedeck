Loupedeck: Node.js Interface
============================

Unofficial Node.js API for Loupedeck Live controllers.

![Loupedeck Live Interface](https://github.com/foxxyz/loupedeck/blob/master/docs/device-front-small.png?raw=true)

**⚠️ Alpha version: Partial Functionality**

Supports:

 * Reading button presses
 * Reading knob turns
 * Reading touch events
 * Setting button colors
 * Setting screen brightness

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

📝 API Docs
-----------

#### `openLoupeDeck() : LoupedeckDevice`

Helper method to automatically discover and connect to a Loupedeck.

_Note: Ensure Loupedeck software is not running as it may conflict with this library_

### Class `LoupedeckDevice`

Main device class.

All incoming messages are emitted as action events and can be subscribed to via `device.on()`.

#### `new LoupedeckDevice({ ip : String })`

Create a new Loupdeck device interface. You should not need to call this constructor manually unless you want to connect to multiple devices, or want to specify the IP manually. For all other use-cases, use [`openLoupedeck`](#openloupedeck--loupedeckdevice)

 - `ip`: IP address to connect to (example: `127.100.1.1`)

#### Event: `'connect'`

Emitted when connection to the device succeeds.

#### Event: `'down'`

Emitted when a button or knob is pressed down.

Arguments:
 - `id`: Button ID (see [`device.js`](https://github.com/foxxyz/loupedeck/blob/master/device.js#L5) for valid button names)

#### Event: `'rotate'`

Emitted when a knob is rotated.

Arguments:
 - `id`: Button ID (see [`device.js`](https://github.com/foxxyz/loupedeck/blob/master/device.js#L5) for valid button names)
 - `delta`: Rotation direction, `-1` for counter-clockwise, `1` for clockwise.

#### Event: `'touch'`

Emitted when any part of the center screen is touched.

Arguments:
 - `x`: Screen X-coordinate ([0, 472])
 - `y`: Screen Y-coordinate ([0, 270])

#### Event: `'touchend'`

Emitted when a touch is no longer detected.

Arguments:
 - `x`: Screen X-coordinate ([0, 472])
 - `y`: Screen Y-coordinate ([0, 270])

#### Event: `'up'`

Emitted when a button or knob is released.

Arguments:
 - `id`: Button ID (see [`device.js`](https://github.com/foxxyz/loupedeck/blob/master/device.js#L5) for valid button names)

#### `device.setBrightness(brightness : Number)`

Set screen brightness.

 - `brightness`: Number between (0, 1) (`0` would turn the screen off, `1` for full brightness)

#### `device.setColor({ id : String, r : Number, g : Number, b : Number })`

Set a button LED to a particular color.

 - `id`: Button ID (see [`device.js`](https://github.com/foxxyz/loupedeck/blob/master/device.js#L5) for valid button names)
 - `r`: Red color component (0-255)
 - `g`: Green color component (0-255)
 - `b`: Blue color component (0-255)

Contributing & Tests
--------------------

1. Install development dependencies: `npm install`
2. Run tests: `npm test`

License
-------

MIT
