Loupedeck: Node.js Interface
============================

![tests](https://github.com/foxxyz/loupedeck/workflows/tests/badge.svg?branch=master)

Unofficial Node.js API for Loupedeck Live controllers.

![Loupedeck Live Interface](https://github.com/foxxyz/loupedeck/blob/master/docs/device-front-small.png?raw=true)

**⚠️ Beta version: API is subject to change**

Supports:

 * Reading button presses
 * Reading knob turns
 * Reading touch events
 * Setting button colors
 * Setting screen brightness
 * Vibrating device
 * Writing screen graphics

Requirements
------------

 * Node 11+

Installation
------------

```shell
npm install loupedeck
```

Usage Examples
--------------

_Note: Ensure Loupedeck software is not running as it may conflict with this library_

```javascript
const { LoupedeckDevice } = require('loupedeck')

// Detects and opens first connected device
const device = new LoupedeckDevice()

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

### Class `LoupedeckDevice`

Main device class.

All incoming messages are emitted as action events and can be subscribed to via `device.on()`.

#### `new LoupedeckDevice({ host : String?, autoConnect : Boolean? })`

Create a new Loupdeck device interface.

Most use-cases should omit the `host` parameter, unless you're using multiple devices or know specifically which IP you want to connect to.

 - `host`: Host or IP address to connect to (example: `127.100.1.1`) (default: autodiscover)
 - `autoConnect`: Automatically connect during construction. (default: `true`) _Set to `false` if you'd prefer to call [`connect()`](#deviceconnect--promise). yourself._

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

#### Event: `'touchstart'`

Emitted when any part of the screen is touched for the first time.

Arguments:
 - `changedTouches`: Array of new [touches](#touch-objects) created during this event
 - `touches`: Array of all currently held [touches](#touch-objects) on screen

#### Event: `'touchmove'`

Emitted when a touch moves across the screen.

Arguments:
 - `changedTouches`: Array of [touches](#touch-objects) changed during this event
 - `touches`: Array of all currently held [touches](#touch-objects) on screen

#### Event: `'touchend'`

Emitted when a touch is no longer detected.

Arguments:
 - `changedTouches`: Array of [touches](#touch-objects) removed during this event
 - `touches`: Array of all currently held [touches](#touch-objects) on screen (if any)

#### Event: `'up'`

Emitted when a button or knob is released.

Arguments:
 - `id`: Button ID (see [`device.js`](https://github.com/foxxyz/loupedeck/blob/master/device.js#L5) for valid button names)

#### `device.connect() : Promise`

Manually connect if `autoConnect` set to `false` during [construction](#new-loupedeckdevice-host--string-autoconnect--boolean-). Resolves once a connection has been established.

#### `device.drawKey(key : Number, callback : Function)`

Draw graphics to a specific key. Width and height of callback will be `90`, as keys are 90x90px.

 - `key`: Key index to write to [0-11]
 - `callback`: Function to handle draw calls. Receives the following arguments:
     + `context`: [2d canvas graphics context](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
     + `width`: Width of drawing area
     + `height`: Height of drawing area

#### `device.drawScreen(screenID : String, callback : Function)`

Draw graphics to a specific screen. Screen sizes are as follows:

 * `left`: 60x270px
 * `center`: 360x270px
 * `right`: 60x60px

 - `key`: Screen to write to [`left`, `center`, `right`]
 - `callback`: Function to handle draw calls. Receives the following arguments:
     + `context`: [2d canvas graphics context](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
     + `width`: Width of drawing area
     + `height`: Height of drawing area

#### `device.setBrightness(brightness : Number)`

Set screen brightness.

 - `brightness`: Number between (0, 1) (`0` would turn the screen off, `1` for full brightness)

#### `device.setColor({ id : String, color : String })`

Set a button LED to a particular color.

 - `id`: Button ID (see [`device.js`](https://github.com/foxxyz/loupedeck/blob/master/device.js#L5) for valid button names)
 - `color`: Any valid CSS color string

#### `device.vibrate(pattern? : byte)`

Make device vibrate.

 - `pattern`: A valid vibration pattern ([see `HAPTIC` for valid patterns](https://github.com/foxxyz/loupedeck/blob/master/device.js#L37)) (default: `HAPTIC.SHORT`)

### Touch Objects

Touch objects are emitted in the [`touchstart`](#event-touchstart), [`touchmove`](#event-touchmove), and [`touchend`](#event-touchend) events and have the following properties:

 + `id`: Unique touch identifier
 + `x`: Screen X-coordinate ([0, 480])
 + `y`: Screen Y-coordinate ([0, 270])
 + `target`:
     * `screen`: Identifier of screen this touch was detected on ([`left`, `center`, `right`])
     * `key`: Index of key touched ([0-11]) (`undefined` if not on `center` screen)

Contributing & Tests
--------------------

1. Install development dependencies: `npm install`
2. Run tests: `npm test`

Thanks
------

Big thanks go out to [Max Maischein's earlier work in Perl](https://github.com/Corion/HID-LoupedeckCT) on this topic.

License
-------

MIT
