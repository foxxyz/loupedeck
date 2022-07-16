jest.mock('os', () => ({ networkInterfaces: jest.fn() }))
const WSConnection = require('../connections/ws')
const os = require('os')

const delay = ms => new Promise(res => setTimeout(res, ms))

let connection

describe('v0.1.X Connection', () => {
    it('auto-discovers valid connections', async() => {
        os.networkInterfaces.mockReturnValue([{ address: '255.255.255.255' }])
        expect(await WSConnection.discover()).toEqual([])
        os.networkInterfaces.mockReturnValue([{ address: '100.127.80.1' }])
        expect(await WSConnection.discover()).toEqual([{ type: WSConnection, host: '100.127.80.1' }])
    })
    it('connects via direct instantiation', async() => {
        connection = new WSConnection({ host: '127.0.0.1' })
        const fn = jest.fn()
        connection.on('connect', fn)
        await connection.connect()
        expect(fn).toHaveBeenCalledWith({ address: 'ws://127.0.0.1' })
        connection.close()
    })
    it('keeps connection alive when ticks received', async() => {
        connection = new WSConnection()
        const fn = jest.fn()
        connection.on('disconnect', fn)
        connection.connectionTimeout = 20
        const connect = jest.spyOn(connection, 'connect')
        await connection.connect()
        for(let i = 0; i < 8; i++) {
            await delay(10)
            connection.onReceive()
        }
        expect(fn).not.toHaveBeenCalled()
        expect(connect).toHaveBeenCalledTimes(1)
    })
    it('disconnects on timeout', async() => {
        connection = new WSConnection()
        const fn = jest.fn()
        connection.on('disconnect', fn)
        connection.connectionTimeout = 20
        await connection.connect()
        await delay(80)
        expect(fn.mock.calls[0][0].message).toMatch(/connection timeout/i)
    })
    it('delegates messages', async() => {
        connection = new WSConnection()
        await connection.connect()
        const sender = jest.spyOn(connection.connection, 'send')
        const TEST_MESSAGE = Buffer.from([0x88])
        connection.send(TEST_MESSAGE)
        expect(sender).toHaveBeenCalledWith(TEST_MESSAGE)
        connection.close()
    })
    it('reports ready to receive', async() => {
        connection = new WSConnection()
        expect(connection.isReady()).toBe(false)
        await connection.connect()
        expect(connection.isReady()).toBe(true)
        connection.close()
    })
    it('can close even when not connection', () => {
        connection = new WSConnection()
        connection.close()
        expect(connection.connection).toBe(undefined)
    })
})