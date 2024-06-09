// Various constants used by the Loupedeck firmware

export const BUTTONS = {
    0x00: 'knobCT',
    0x01: 'knobTL',
    0x02: 'knobCL',
    0x03: 'knobBL',
    0x04: 'knobTR',
    0x05: 'knobCR',
    0x06: 'knobBR',
    0x07: 0,
    0x08: 1,
    0x09: 2,
    0x0a: 3,
    0x0b: 4,
    0x0c: 5,
    0x0d: 6,
    0x0e: 7,
    0x0f: 'home',
    0x10: 'undo',
    0x11: 'keyboard',
    0x12: 'enter',
    0x13: 'save',
    0x14: 'fnL',
    0x15: 'a',
    0x16: 'c',
    0x17: 'fnR',
    0x18: 'b',
    0x19: 'd',
    0x1a: 'e',
    // Below seem to be used only on the Razer Stream Controller X
    0x1b: 0,
    0x1c: 1,
    0x1d: 2,
    0x1e: 3,
    0x1f: 4,
    0x20: 5,
    0x21: 6,
    0x22: 7,
    0x23: 8,
    0x24: 9,
    0x25: 10,
    0x26: 11,
    0x27: 12,
    0x28: 13,
    0x29: 14,
}

// How long without ticks until a connection is considered "timed out"
export const CONNECTION_TIMEOUT = 3000

export const COMMANDS = {
    BUTTON_PRESS: 0x00,
    KNOB_ROTATE: 0x01,
    SET_COLOR: 0x02,
    SERIAL: 0x03,
    RESET: 0x06,
    VERSION: 0x07,
    SET_BRIGHTNESS: 0x09,
    FRAMEBUFF: 0x10,
    SET_VIBRATION: 0x1b,
    MCU: 0x0d,
    DRAW: 0x0f,
    TOUCH: 0x4d,
    TOUCH_CT: 0x52,
    TOUCH_END: 0x6d,
    TOUCH_END_CT: 0x72,
}

// How long until trying to reconnect after a disconnect
export const DEFAULT_RECONNECT_INTERVAL = 3000

export const HAPTIC = {
    SHORT: 0x01,
    MEDIUM: 0x0a,
    LONG: 0x0f,
    LOW: 0x31,
    SHORT_LOW: 0x32,
    SHORT_LOWER: 0x33,
    LOWER: 0x40,
    LOWEST: 0x41,
    DESCEND_SLOW: 0x46,
    DESCEND_MED: 0x47,
    DESCEND_FAST: 0x48,
    ASCEND_SLOW: 0x52,
    ASCEND_MED: 0x53,
    ASCEND_FAST: 0x58,
    REV_SLOWEST: 0x5e,
    REV_SLOW: 0x5f,
    REV_MED: 0x60,
    REV_FAST: 0x61,
    REV_FASTER: 0x62,
    REV_FASTEST: 0x63,
    RISE_FALL: 0x6a,
    BUZZ: 0x70,
    RUMBLE5: 0x77, // lower frequencies in descending order
    RUMBLE4: 0x78,
    RUMBLE3: 0x79,
    RUMBLE2: 0x7a,
    RUMBLE1: 0x7b,
    VERY_LONG: 0x76, // 10 sec high freq (!)
}

// Maximum brightness value
export const MAX_BRIGHTNESS = 10
