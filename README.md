Loupedeck: Node.js Interface
============================

![tests](https://github.com/foxxyz/loupedeck/workflows/tests/badge.svg?branch=master)

Unofficial Node.js API for [Loupedeck Live](https://loupedeck.com/products/loupedeck-live/), [Loupedeck Live S](https://loupedeck.com/products/loupedeck-live-s/), [Loupedeck CT](https://loupedeck.com/us/products/loupedeck-ct/) and [Razer Stream](https://www.razer.com/streaming-accessories/razer-stream-controller) controllers.

![Loupedeck Live Interface](/docs/live-front-small.png?raw=true)
![Loupedeck Live S Interface](/docs/live-s-front-small.png?raw=true)
![Loupedeck CT Interface](/docs/ct-front-small.png?raw=true)

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

 * Node 14+
 * Loupedeck Live, Loupedeck Live S, Loupedeck CT or Razer Stream Controller (RSC)

This library has been tested with firmware versions 0.1.3, 0.1.79, 0.2.5 and 0.2.8. Other versions may work.

Installation
------------

```shell
npm install loupedeck
```

By default, `loupedeck` uses RGB565 (16-bit) buffers for drawing (with small exceptions, see below). To enable a more pleasant API that allows for drawing using [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) callbacks, also install `canvas`:

```shell
npm install canvas
```

Usage Examples
--------------

_Note: Ensure Loupedeck software is not running as it may conflict with this library_

### Automatic Discovery

```javascript
import { discover } from 'loupedeck'

// Detects and opens first connected device
const device = await discover()

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

### Manual Instantiation

```javascript
import { LoupedeckLiveS } from 'loupedeck'

const device = new LoupedeckLiveS({ path: '/dev/tty.usbmodem101', autoConnect: false })
await device.connect()
console.info('Connection successful!')

device.on('down', ({ id }) => {
    console.info(`Button pressed: ${id}`)
})
```

For all examples, see the [`examples` folder](/examples/). Running some examples requires `canvas` to be installed (see above).

📝 API Docs
-----------

### `discover() : Promise<LoupedeckDevice>`

Find the first connected Loupedeck device and return it.

Returns an instance of `LoupedeckLive`, `LoupedeckLiveS`, `LoupedeckCT`, `RazerStreamController`, or throws an `Error` in case none or unsupported devices are found.

### Class `LoupedeckLive`

Implements and supports all methods from the [`LoupedeckDevice` interface](#interface-loupedeckdevice).

#### `new LoupedeckLive({ path : String?, host : String?, autoConnect : Boolean? })`

Create a new Loupedeck Live device interface.

Most use-cases should omit the `host`/`path` parameter, unless you're using multiple devices or know specifically which IP or device path you want to connect to. Either use `path` OR `host`, never both.

 - `path`: **(Firmware 0.2.X only)** Serial device path (example: `/dev/cu.ttymodem-1332` or `COM2`) (default: autodiscover)
 - `host`: **(Firmware 0.1.X only)** Host or IP address to connect to (example: `127.100.1.1`) (default: autodiscover)
 - `autoConnect`: Automatically connect during construction. (default: `true`) _Set to `false` if you'd prefer to call [`connect()`](#deviceconnect--promise). yourself._
 - `reconnectInterval`: How many milliseconds to wait before attempting a reconnect after a failed connection (default: `3000`) _Set to `false` to turn off automatic reconnects._

### Class `LoupedeckCT`

Same interface as [`LoupedeckLive`](#class-loupedecklive).

### Class `LoupedeckLiveS`

Same interface as [`LoupedeckLive`](#class-loupedecklive).

### Class `RazerStreamController`

Same interface as [`LoupedeckLive`](#class-loupedecklive).

### Interface `LoupedeckDevice`

Shared device interface. Do not instantiate this manually, use one of the above classes instead or the [`discover()` function](#discover--promiseloupedeckdevice).

All incoming messages are emitted as action events and can be subscribed to via `device.on()`.

### `LoupedeckDevice.list({ ignoreSerial : Boolean?, ignoreWebsocket : Boolean?} = {}) : Promise<Array>`

Static method to scan for and return a list of all detected devices. This includes ones which are already opened.

 - `ignoreSerial`: Ignore devices which operate over serial (Firmware 0.2.X) (default: false)
 - `ignoreWebsocket`: Ignore devices which operate over websocket (Firmware 0.1.X) (default: false)
 
Device info can be directly passed on to the constructor below.

#### Event: `'connect'`

Emitted when connection to the device succeeds. Includes an info object containing:

 - `address`: Connection address (E.G. serial path or websocket address)
 
#### Event: `'disconnect'`

Emitted when a device disconnects for any reason. First argument for the event is an `Error` object in case of an abnormal disconnect (otherwise `undefined`).

#### Event: `'down'`

Emitted when a button or knob is pressed down.

Arguments:
 - `id`: Button ID ([see `constants.js` for possible IDs](/constants.js#L3))

#### Event: `'rotate'`

Emitted when a knob is rotated.

Arguments:
 - `id`: Button ID ([see `constants.js` for possible IDs](/constants.js#L3))
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
 - `id`: Button ID ([see `constants.js` for possible IDs](/constants.js#L3))
 
#### `device.close() : Promise`

Close device connection.

Returns Promise which resolves once the device has been closed.

#### `device.connect() : Promise`

Manually connect. Resolves on success.

#### `device.drawBuffer({ id : String, width : Number, height : Number, x? : Number, y? : Number, autoRefresh? : Boolean }, buffer : Buffer) : Promise`

Draw graphics to a particular area using a RGB16-565 pixel buffer.

Lower-level method if [`drawKey()`](#devicedrawkeykey--number-buffercallback--bufferfunction--promise) or [`drawScreen()`](#devicedrawscreenscreenid--string-buffercallback--bufferfunction--promise) don't meet your needs.

 - `id`: Screen to write to [`left`, `center`, `right`, `knob`] _(`left` and `right` available on Loupedeck Live / RSC only)_ _(`knob` available on Loupedeck CT only)_
 - `width`: Width of area to draw
 - `height`: Height of area to draw
 - `x`: Starting X offset (default: `0`)
 - `y`: Starting Y offset (default: `0`)
 - `autoRefresh`: Whether to refresh the screen after drawing (default: `true`)
 - `buffer`: RGB16-565 Buffer. Should be `width * height * 2` bytes long, with each pixel represented by 2 bytes (5 bits red, 6 bits green, 5 bits blue) in little-endian (LE). _Note: Loupedeck CT knob screen is the only exception, it uses big-endian (BE)_
 
Returns a Promise which resolves once the command has been acknowledged by the device.

#### `device.drawCanvas({ id : String, width : Number, height : Number, x? : Number, y? : Number, autoRefresh? : Boolean }, callback : Function) : Promise`

Draw graphics to a particular area using the [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D). Requires [`canvas`](https://www.npmjs.com/package/canvas) to be installed.

Lower-level method if [`drawKey()`](#devicedrawkeykey--number-buffercallback--bufferfunction--promise) or [`drawScreen()`](#devicedrawscreenscreenid--string-buffercallback--bufferfunction--promise) don't meet your needs.

 - `id`: Screen to write to [`left`, `center`, `right`, `knob`] _(`left` and `right` available on Loupedeck Live / RSC only)_ _(`knob` available on Loupedeck CT only)_
 - `width`: Width of area to draw
 - `height`: Height of area to draw
 - `x`: Starting X offset (default: `0`)
 - `y`: Starting Y offset (default: `0`)
 - `autoRefresh`: Whether to refresh the screen after drawing (default: `true`)
 - `callback`: Function to handle draw calls. Receives the following arguments:
     1. `context`: [2d canvas graphics context](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
     2. `width`: Width of drawing area
     3. `height`: Height of drawing area
     
Returns a Promise which resolves once the command has been acknowledged by the device.

#### `device.drawKey(key : Number, buffer/callback : Buffer/Function) : Promise`

Draw graphics to a specific key.

Second argument can be either a RGB16-565 buffer or a callback. Width and height of callback will be `90`, as keys are 90x90px.

 - `key`: Key index to write to ([0-11] on _Loupedeck Live/Loupedeck CT/RSC_, [0-14] on _Loupedeck Live S_)
 - `buffer`: RGB16-565 Buffer
 - `callback`: Function to handle draw calls. Receives the following arguments:
     1. `context`: [2d canvas graphics context](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
     2. `width`: Width of drawing area
     3. `height`: Height of drawing area

Returns a Promise which resolves once the command has been acknowledged by the device.

#### `device.drawScreen(screenID : String, buffer/callback : Buffer/Function) : Promise`

Draw graphics to a specific screen. Screen sizes are as follows:

Loupedeck CT:
 * `left`: 60x270px
 * `center`: 360x270px
 * `right`: 60x270px
 * `knob`: 240x240px _(Note: uses big-endian byte order!)_

Loupedeck Live / Razer Stream Controller:
 * `left`: 60x270px
 * `center`: 360x270px
 * `right`: 60x270px

Loupedeck Live S:
 * `center`: 480x270px
 
 Second argument can be either a RGB16-565 buffer or a callback. 

 - `screenID`: Screen to write to [`left`, `center`, `right`, `knob`] _(`left` and `right` available on Loupedeck Live and Razer Stream Controller only)_ _(`knob` available on Loupedeck CT only)_
 - `buffer`: RGB16-565 Buffer (BE for `knob`, LE otherwise)
 - `callback`: Function to handle draw calls. Receives the following arguments:
     1. `context`: [2d canvas graphics context](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
     2. `width`: Width of drawing area
     3. `height`: Height of drawing area
     
Returns a Promise which resolves once the command has been acknowledged by the device.

#### `device.getInfo() : Promise`

Request device information. Returns a promise resolving to object containing:

 - `serial`: Device serial number
 - `version`: Firmware version
 
If the device is not connected, the promise will reject.

#### `device.setBrightness(brightness : Number) : Promise`

Set screen brightness.

 - `brightness`: Float between (0, 1) (`0` would turn the screen off, `1` for full brightness)
 
Returns a Promise which resolves once the command has been acknowledged by the device.

#### `device.setButtonColor({ id : String, color : String }) : Promise`

Set a button LED to a particular color.

 - `id`: Button ID (possible choices: 0-7 on _Loupedeck Live/CT/RSC_, 0-4 on _Loupedeck Live S_, [see `BUTTONS` for _Loupedeck CT_ square buttons](/constants.js#L19))
 - `color`: Any [valid CSS color string](https://github.com/colorjs/color-parse#parsed-strings)

Returns a Promise which resolves once the command has been acknowledged by the device.

#### `device.vibrate(pattern? : byte) : Promise`

Make device vibrate.

 - `pattern`: A valid vibration pattern ([see `HAPTIC` for valid patterns](/constants.js#L57)) (default: `HAPTIC.SHORT`)
 
Returns a Promise which resolves once the command has been acknowledged by the device.

### Touch Objects

Touch objects are emitted in the [`touchstart`](#event-touchstart), [`touchmove`](#event-touchmove), and [`touchend`](#event-touchend) events and have the following properties:

 + `id`: Unique touch identifier
 + `x`: Screen X-coordinate ([0, 480])
 + `y`: Screen Y-coordinate ([0, 270])
 + `target`:
     * `screen`: Identifier of screen this touch was detected on ([`left`, `center`, `right`, `knob`]) (`center` only on _Loupedeck Live S_, `knob` only on _Loupedeck CT_)
     * `key`: Index of key touched ([0-11] on _Loupedeck Live/CT/RSC_, [0-14] on _Loupedeck Live S_)

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
