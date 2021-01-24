// ...it really does seem to go up to 11
const BRIGHTNESS_LEVELS = 11

const BUTTONS = {
    0x01: 'knobTL',
    0x02: 'knobCL',
    0x03: 'knobBL',
    0x04: 'knobTR',
    0x05: 'knobCR',
    0x06: 'knobBR',
    0x07: 'circle',
    0x08: '1',
    0x09: '2',
    0x0a: '3',
    0x0b: '4',
    0x0c: '5',
    0x0d: '6',
    0x0e: '7'
}

// How long without ticks until a connection is considered "timed out"
const CONNECTION_TIMEOUT = 3000

const DISPLAYS = {
    center: { id: Buffer.from('\x00A'), width: 360, height: 270 }, // "A"
    left: { id: Buffer.from('\x00L'), width: 60, height: 270 }, // "L"
    right: { id: Buffer.from('\x00R'), width: 60, height: 270 }, // "R"
}

const HEADERS = {
    CONFIRM:         0x0302,
    TICK:            0x0400,
    SET_BRIGHTNESS:  0x0409,
    SET_VIBRATION:   0x041b,
    BUTTON_PRESS:    0x0500,
    KNOB_ROTATE:     0x0501,
    DRAW:            0x050f,
    SET_COLOR:       0x0702,
    TOUCH:           0x094d,
    TOUCH_END:       0x096d,
    WRITE_FRAMEBUFF: 0xff10
}

const HAPTIC = {
    SHORT:       0x01,
    MEDIUM:      0x0a,
    LONG:        0x0f,
    LOW:         0x31,
    SHORT_LOW:   0x32,
    SHORT_LOWER: 0x33,
    LOWER:       0x40,
    LOWEST:      0x41,
    DESCEND_SLOW:0x46,
    DESCEND_MED: 0x47,
    DESCEND_FAST:0x48,
    ASCEND_SLOW: 0x52,
    ASCEND_MED:  0x53,
    ASCEND_FAST: 0x58,
    REV_SLOWEST: 0x5e,
    REV_SLOW:    0x5f,
    REV_MED:     0x60,
    REV_FAST:    0x61,
    REV_FASTER:  0x62,
    REV_FASTEST: 0x63,
    RISE_FALL:   0x6a,
    BUZZ:        0x70,
    RUMBLE5:     0x77, // lower frequencies in descending order
    RUMBLE4:     0x78,
    RUMBLE3:     0x79,
    RUMBLE2:     0x7a,
    RUMBLE1:     0x7b,
    VERY_LONG:   0x76, // 10 sec high freq (!)
}

// How long until trying to reconnect after a disconnect
const RECONNECT_INTERVAL = 3000

module.exports = {
    BRIGHTNESS_LEVELS,
    BUTTONS,
    CONNECTION_TIMEOUT,
    DISPLAYS,
    HEADERS,
    HAPTIC,
    RECONNECT_INTERVAL
}