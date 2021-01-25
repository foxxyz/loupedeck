#!/usr/bin/env node
const { LoupedeckDevice } = require('../..')
const { createCanvas, loadImage } = require('canvas')

const loupedeck = new LoupedeckDevice()

loupedeck.on('connect', async({ address }) => {
    console.info(`✅ Connected to Loupedeck at ${address}`)
    const { serial, version } = await loupedeck.getInfo()
    console.info(`Device serial number ${serial}, software version ${version}`)
})

loupedeck.on('disconnect', err => {
    console.info(`Connection to Loupedeck lost (${err.message}). Reconnecting in ${loupedeck.reconnectInterval / 1000}s...`)
})

class SlidePuzzle {
    constructor({ image, rows = 3, columns = 4 }) {
        this.onStart = () => {}
        this.onWin = () => {}
        this.outcome = null
        this.sourceImageFile = image
        this.selectedTile = null
        this.rows = rows
        this.columns = columns
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
                    correctColumn: column
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
        if (this.selectedTile.x % 90 === 0 && this.selectedTile.y % 90 === 0) {
            this.selectedTile.column = Math.floor(this.selectedTile.x / 90)
            this.selectedTile.row = Math.floor(this.selectedTile.y / 90)
            this.selectedTile = null
            // Check if player won
            if (this.tiles.every(t => t.inPlace())) this.end('win')
        }
    }
    shuffle() {
        const shuffled = []
        for(let column = 0; column < 4; column++) {
            for(let row = 0; row < 3; row++) {
                if (row === 2 && column === 3) continue
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
    constructor({ sourceImage, sx, sy, row, column, correctRow, correctColumn }) {
        this.canvas = createCanvas(90, 90)
        const ctx = this.canvas.getContext('2d')
        ctx.drawImage(sourceImage, sx, sy, 90, 90, 0, 0, 90, 90)
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
        if (searchPoint[0] < 0 || searchPoint[0] >= 360 || searchPoint[1] < 0 || searchPoint[1] >= 270) return false
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
        this.y = val * 90
    }
    get column() {
        return this._column
    }
    set column(val) {
        this._column = val
        this.x = val * 90
    }
}

const connect = new Promise(res => loupedeck.once('connect', res))

let winAnimation

async function run() {
    const game = new SlidePuzzle({ image: './yumi.jpg' })
    await game.init()

    const device = await connect
    console.log('connecto')

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
        device.drawScreen('left', (ctx, w, h) => {
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, w, h)
        })
        device.drawScreen('right', (ctx, w, h) => {
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, w, h)
        })
    }

    // Draw hearts in random positions
    async function winRender() {
        const x = Math.floor(Math.random() * 360)
        const y = Math.floor(Math.random() * 270)
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
    loupedeck.on('rotate', async({ id, delta }) => {
        // Use a mutex here since the knob can be rotated much faster than the device
        // can handle draw updates. Ensure we don't try to draw while the device
        // is still busy drawing.
        if (mutex) return
        mutex = true

        // X direction for left knobs, Y direction for right knobs
        const direction = [0, 0]
        if (id.endsWith('R')) direction[1] = -delta * MOVE_SPEED
        else direction[0] = delta * MOVE_SPEED

        await game.moveTile(direction, preMove, postMove)

        mutex = false
    })

    // Reset the game when circle pressed
    loupedeck.on('down', async({ id }) => {
        if (id === 'circle' && game.outcome === 'win') game.start()
    })

    game.start()
}

run()