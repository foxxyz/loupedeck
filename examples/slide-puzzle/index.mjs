#!/usr/bin/env node
import { LoupedeckDevice } from '../../index.js'
import { createCanvas, loadImage } from 'canvas'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const device = await LoupedeckDevice.discover()

device.on('connect', async({ address }) => {
    console.info(`✅ Connected to ${device.type} at ${address}`)
    const { serial, version } = await device.getInfo()
    console.info(`Device serial number ${serial}, software version ${version}`)
})

device.on('disconnect', err => {
    console.info(`Connection to Loupedeck lost (${err?.message}). Reconnecting in ${device.reconnectInterval / 1000}s...`)
})

class SlidePuzzle {
    constructor({ image, rows = 3, columns = 4, offset = [0, 0] }) {
        this.onStart = () => {}
        this.onWin = () => {}
        this.outcome = null
        this.sourceImageFile = image
        this.selectedTile = null
        this.rows = rows
        this.columns = columns
        this.offset = offset
    }
    end(outcome) {
        this.outcome = outcome
        this.onWin()
    }
    async init() {
        this.sourceImage = await loadImage(this.sourceImageFile)
        const tiles = []
        for(let column = 0; column < this.columns; column++) {
            for(let row = 0; row < this.rows; row++) {
                if (row === this.rows - 1 && column === this.columns - 1) continue
                tiles.push(new Tile({
                    sourceImage: this.sourceImage,
                    sx: column * 90,
                    sy: row * 90,
                    row,
                    column,
                    correctRow: row,
                    correctColumn: column,
                    bounds: [
                        [this.offset[0], this.offset[0] + this.columns * 90],
                        [0, this.rows * 90],
                    ]
                }))
            }
        }
        this.tiles = tiles
    }
    async moveTile(direction, preHook, postHook) {
        // Game is done, no more moving
        if (this.outcome) return
        // No tile selected, find tile that can move in the given direction
        if (!this.selectedTile) this.selectedTile = this.tiles.find(t => t.canMoveIn(direction, this.tiles))
        // Still no tile to be moved
        if (!this.selectedTile) return
        // Tile can't move in this direction
        if (!this.selectedTile.canMoveIn(direction, this.tiles)) return
        // Ready to move, run pre-move hook
        await preHook(this.selectedTile)
        // Move tile
        this.selectedTile.x += direction[0]
        this.selectedTile.y += direction[1]
        // Run post-move hook
        await postHook(this.selectedTile)

        // If aligned with grid, deselect
        if ((this.selectedTile.x - this.offset[0]) % 90 === 0 && this.selectedTile.y % 90 === 0) {
            this.selectedTile.column = Math.floor(this.selectedTile.x / 90)
            this.selectedTile.row = Math.floor(this.selectedTile.y / 90)
            this.selectedTile = null
            // Check if player won
            if (this.tiles.every(t => t.inPlace())) this.end('win')
        }
    }
    shuffle() {
        const shuffled = []
        for(let column = 0; column < this.columns; column++) {
            for(let row = 0; row < this.rows; row++) {
                if (row === this.rows - 1 && column === this.columns - 1) continue
                const randomIndex = Math.floor(Math.random() * this.tiles.length)
                const tile = this.tiles[randomIndex]
                tile.column = column
                tile.row = row
                this.tiles.splice(randomIndex, 1)
                shuffled.push(tile)
            }
        }
        this.tiles = shuffled
    }
    start() {
        this.outcome = null
        this.shuffle()
        this.onStart()
    }
}

class Tile {
    constructor({ sourceImage, sx, sy, row, column, correctRow, correctColumn, bounds }) {
        this.canvas = createCanvas(90, 90)
        const ctx = this.canvas.getContext('2d')
        ctx.drawImage(sourceImage, sx, sy, 90, 90, 0, 0, 90, 90)
        this.bounds = bounds
        this.row = row
        this.column = column
        this.correctRow = correctRow
        this.correctColumn = correctColumn
    }
    canMoveIn([dx, dy], tiles) {
        const searchPoint = [
            dx > 0 ? this.x + 90 - 1 + dx : dx < 1 ? this.x + dx : 0,
            dy > 0 ? this.y + 90 - 1 + dy : dy < 1 ? this.y + dy : 0,
        ]
        // Can't go outside screen boundaries
        if (searchPoint[0] < this.bounds[0][0] || searchPoint[0] >= this.bounds[0][1] || searchPoint[1] < this.bounds[1][0] || searchPoint[1] >= this.bounds[1][1]) return false
        // Make sure we don't collide with other tiles
        return !tiles.some(t => t.contains(searchPoint))
    }
    contains([x, y]) {
        return x >= this.x && x < this.x + 90 && y >= this.y && y < this.y + 90
    }
    inPlace() {
        return this.row === this.correctRow && this.column === this.correctColumn
    }
    get row() {
        return this._row
    }
    set row(val) {
        this._row = val
        this.y = this.bounds[1][0] + val * 90
    }
    get column() {
        return this._column
    }
    set column(val) {
        this._column = val
        this.x = this.bounds[0][0] + val * 90
    }
}

let winAnimation

await new Promise(res => device.once('connect', res))

const __dirname = dirname(fileURLToPath(import.meta.url))
const imageFile = device.displays.center.width > 360 ? 'undredal.jpg' : 'yumi.jpg'
const game = new SlidePuzzle({
    image: join(__dirname, imageFile),
    rows: device.rows,
    columns: device.columns,
    offset: device.visibleX
})
await game.init()

// Draw tiles on game start
game.onStart = () => {
    clearTimeout(winAnimation)
    device.drawScreen('center', ctx => {
        for(const tile of game.tiles) {
            ctx.drawImage(tile.canvas, tile.x, tile.y)
        }
    })
}

// Animate on game win
game.onWin = () => {
    winAnimation = setTimeout(winRender, 100)
    // Only on Loupedeck Live
    if (device.displays.left) {
        device.drawScreen('left', (ctx, w, h) => {
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, w, h)
        })
    }
    // Only on Loupedeck Live
    if (device.displays.right) {
        device.drawScreen('right', (ctx, w, h) => {
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, w, h)
        })
    }
}

// Draw hearts in random positions
async function winRender() {
    const x = Math.floor(Math.random() * device.displays.center.width)
    const y = Math.floor(Math.random() * device.displays.center.height)
    await device.drawCanvas({ id: 'center', x, y, width: 32, height: 32 }, (ctx, w, h) => {
        // Fill in background
        ctx.drawImage(game.sourceImage, x, y, w, h, 0, 0, w, h)
        ctx.fillStyle = 'red'
        ctx.font = '32px Sans-Serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('♥', 16, 16)
    })
    winAnimation = setTimeout(winRender, 100)
}

// Draw empty square in current position without refreshing screen
function preMove({ x, y }) {
    return device.drawCanvas({ id: 'center', x, y, width: 90, height: 90, autoRefresh: false }, (ctx, w, h) => {
        ctx.fillStyle = 'black'
        ctx.fillRect(0, 0, w, h)
    })
}

// Draw in new location
function postMove({ canvas, x, y }) {
    return device.drawCanvas({ id: 'center', x, y, width: 90, height: 90 }, ctx => {
        ctx.drawImage(canvas, 0, 0)
    })
}

// Move tile on knob rotate
let mutex = false
const MOVE_SPEED = 10
device.on('rotate', async({ id, delta }) => {
    // Use a mutex here since the knob can be rotated much faster than the device
    // can handle draw updates. Ensure we don't try to draw while the device
    // is still busy drawing.
    if (mutex) return
    mutex = true

    // X direction for top knob, Y direction for bottom knob
    const direction = [0, 0]
    if (id[4] === 'T') direction[1] = -delta * MOVE_SPEED
    else direction[0] = delta * MOVE_SPEED

    await game.moveTile(direction, preMove, postMove)

    mutex = false
})

// Reset the game when circle pressed
device.on('down', ({ id }) => {
    if (id === 'circle' && game.outcome === 'win') game.start()
})

game.start()
