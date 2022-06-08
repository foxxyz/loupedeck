import { EventEmitter } from "events";

/**
 * Function to handle draw calls.
 * @param ctx 2d canvas graphics context (https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D)
 * @param width Width of drawing area
 * @param height Height of drawing area
 */
export type DrawCanvasCallback = (ctx: any, width: number, height: number) => void

export type LoupedeckScreen = 'left' | 'center' | 'right'
export type LoupedeckButtonId = 'circle' | 1 | 2 | 3 | 4 | 5 | 6 | 7
export type LoupedeckKnobId = 'knobTL' | 'knobCL' | 'knobBL' | 'knobTR' | 'knobCR' | 'knobBR'

export interface TouchObject {
    /** Unique touch identifier */
    id: number
    /** Screen X-coordinate */
    x: number
    /** Screen Y-coordinate */
    y: number
    target: {
        /** Identifier of screen this touch was detected on */
        screen: LoupedeckScreen
        /** Index of key touched ([0-11]), if on `center` screen */
        key: number | undefined
    }
}
export interface TouchEventData {
    changedTouches: TouchObject[]
    touches: TouchObject[]
}

export class LoupedeckDevice extends EventEmitter {
    constructor(options: {
        /** **(Firmware 0.2.X only)** Serial device path (example: `/dev/cu.ttymodem-1332` or `COM2`) (default: autodiscover) */
        path?: string,
        /** **(Firmware 0.1.X only)** Host or IP address to connect to (example: `127.100.1.1`) (default: autodiscover) */
        host?: string,
        /** Automatically connect during construction. */
        autoConnect?: boolean = true
    } = {})

    /**
     * Emitted when connection to the device succeeds.
     */
    on(event: 'connect', cb: () => void): this
    /**
     * Emitted when connection to the device disconnects.
     */
    on(event: 'disconnect', cb: () => void): this
    /**
     * Emitted when a button or knob is pressed down.
     */
    on(event: 'down', cb: (data: {
        /** Button ID */
        id: LoupedeckButtonId | LoupedeckKnobId
    }) => void): this
    /**
     * Emitted when a knob is rotated.
     */
    on(event: 'rotate', cb: (data: {
        /** Button ID */
        id: LoupedeckButtonId | LoupedeckKnobId
        /** Rotation direction  */
        delta: -1 | 1
    }) => void): this
    /**
     * Emitted when any part of the screen is touched for the first time.
     */
    on(event: 'touchstart', cb: (data: TouchEventData) => void): this
    /**
     * Emitted when a touch moves across the screen.
     */
    on(event: 'touchmove', cb: (data: TouchEventData) => void): this
    /**
     * Emitted when a touch is no longer detected.
     */
    on(event: 'touchend', cb: (data: TouchEventData) => void): this
    /**
     * Emitted when a button or knob is released.
     */
    on(event: 'up', cb: (data: {
        /** Button ID */
        id: LoupedeckButtonId | LoupedeckKnobId
    }) => void): this

    /**
     * Close device connection.
     */
    close(): void

    /**
     * Manually connect if `autoConnect` set to `false` during construction.
     * Resolves once a connection has been established.
     */
    connect(): Promise<void>

    /**
     * Draw graphics to a particular area. Lower-level method if `drawKey()` or `drawScreen()` don't meet your needs.
     * @param options Drawing options
     * @param cb Function to handle draw calls
     */
    drawCanvas(options: {
        /** Screen to write to */
        id: LoupedeckScreen
        /** Width of area to draw */
        width?: number
        /** Height of area to draw */
        height?: number
        /** Starting X offset */
        x?: number = 0
        /** Starting Y offset */
        y?: number = 0
        /** Whether to refresh the screen after drawing */
        autoRefresh?: boolean = true
    }, cb: DrawCanvasCallback): Promise<void>

    /**
     * Draw graphics to a specific key. Width and height of callback will be `90`, as keys are 90x90px
     * @param index Key index to write to [0-11]
     * @param cb Function to handle draw calls
     */
    drawKey(index: number, cb: DrawCanvasCallback): Promise<void>

    /**
     * Draw graphics to a specific screen
     * @param id Screen to write to
     * @param cb Function to handle draw calls
     */
    drawScreen(id: LoupedeckScreen, cb: DrawCanvasCallback): Promise<void>

    /**
     * Request device information
     */
    getInfo(): Promise<{
        /** Device serial number */
        serial: string,
        /** Firmware version */
        version: string
    }>

    /**
     * Refresh the screen
     * @param id Screen to refresh
     */
    refresh(id: LoupedeckScreen): Promise<void>

    /**
     * Set screen brightness.
     * @param value Number between (0, 1) (`0` would turn the screen off, `1` for full brightness)
     */
    setBrightness(value: number): void

    /**
     * Set a button LED to a particular color
     * @param options 
     */
    setButtonColor(options: {
        /** Button ID */
        id: LoupedeckButtonId,
        /** Any valid CSS color string (https://github.com/colorjs/color-parse#parsed-strings) */
        color: unknown
    }): void

    /**
     * Make device vibrate.
     * @param pattern A valid vibration pattern
     */
    vibrate(pattern: unknown): void
}