import test from 'node:test'
import assert from 'node:assert/strict'
import { createStockfishClient } from '../src/lib/stockfishClient.js'

test('Stockfish bestMoves keeps its array contract when worker startup fails', async () => {
  const client = createStockfishClient({
    workerFactory: () => {
      throw new Error('worker unavailable')
    },
  })

  assert.deepEqual(
    await client.bestMoves('8/8/8/8/8/8/8/K6k w - - 0 1'),
    [],
  )
})

test('Stockfish waits for readyok and returns sanitized final principal variations', async () => {
  const worker = new FakeStockfishWorker()
  const statuses = []
  const client = createStockfishClient({
    workerFactory: () => worker,
    readyTimeoutMs: 200,
  })
  client.onStatus((status) => statuses.push(status))

  const result = client.bestMoves('8/8/8/8/8/8/8/K6k w - - 0 1', {
    count: 2,
    depth: 8,
    moveTime: 100,
  })

  await nextTurn()
  assert.deepEqual(worker.commands.slice(0, 2), ['uci', 'isready'])
  assert.equal(worker.commands.some((command) => command.startsWith('go ')), false)
  worker.emit('uciok')
  await nextTurn()
  assert.equal(worker.commands.some((command) => command.startsWith('go ')), false)
  worker.emit('readyok')
  await nextTurn()
  assert.equal(worker.commands.some((command) => command.startsWith('go ')), true)

  worker.emit('info depth 8 multipv 2 score cp 20 pv a1b1 h1g1')
  worker.emit('info depth 8 multipv 1 score cp 35 pv a1a2 h1g1')
  worker.emit('bestmove a1a2')

  assert.deepEqual(await result, [
    { uci: 'a1a2', score: 35, mate: null, rank: 1, pv: ['a1a2', 'h1g1'] },
    { uci: 'a1b1', score: 20, mate: null, rank: 2, pv: ['a1b1', 'h1g1'] },
  ])
  assert.deepEqual(statuses, ['Stockfish ready', 'Stockfish ready'])
  client.destroy()
})

test('Stockfish limited strength honors the weakened bestmove instead of MultiPV rank one', async () => {
  const worker = new FakeStockfishWorker()
  const client = createStockfishClient({
    workerFactory: () => worker,
    readyTimeoutMs: 200,
  })

  const result = client.bestMoves('8/8/8/8/8/8/8/K6k w - - 0 1', {
    count: 2,
    depth: 8,
    moveTime: 100,
    elo: 2200,
  })

  await nextTurn()
  worker.emit('readyok')
  await nextTurn()
  worker.emit('info depth 8 multipv 1 score cp 35 pv a1a2 h1g1')
  worker.emit('info depth 8 multipv 2 score cp 20 pv a1b1 h1g1')
  worker.emit('bestmove a1b1')

  assert.deepEqual(await result, [
    { uci: 'a1b1', score: 20, mate: null, rank: 1, pv: ['a1b1', 'h1g1'] },
    { uci: 'a1a2', score: 35, mate: null, rank: 2, pv: ['a1a2', 'h1g1'] },
  ])
  assert.equal(
    worker.commands.includes('setoption name UCI_LimitStrength value true'),
    true,
  )
  assert.equal(worker.commands.includes('setoption name UCI_Elo value 2200'), true)
  client.destroy()
})

test('Stockfish limited strength never substitutes a full-strength line when bestmove is missing', async () => {
  const worker = new FakeStockfishWorker()
  const client = createStockfishClient({
    workerFactory: () => worker,
    readyTimeoutMs: 200,
    stopGraceMs: 5,
  })

  const result = client.bestMoves('8/8/8/8/8/8/8/K6k w - - 0 1', {
    count: 2,
    depth: 8,
    moveTime: 40,
    timeout: 5,
    elo: 3000,
  })

  await nextTurn()
  worker.emit('readyok')
  await nextTurn()
  worker.emit('info depth 8 multipv 1 score cp 35 pv a1a2 h1g1')
  worker.emit('info depth 8 multipv 2 score cp 20 pv a1b1 h1g1')

  assert.deepEqual(await result, [])
  assert.equal(worker.commands.includes('setoption name UCI_Elo value 3000'), true)
  client.destroy()
})

test('Stockfish serializes requests enqueued before worker readiness', async () => {
  const worker = new FakeStockfishWorker()
  const client = createStockfishClient({
    workerFactory: () => worker,
    readyTimeoutMs: 200,
  })

  const first = client.bestMoves('8/8/8/8/8/8/8/K6k w - - 0 1', {
    depth: 8,
    moveTime: 100,
  })
  const second = client.bestMoves('8/8/8/8/8/8/8/1K5k w - - 0 1', {
    depth: 8,
    moveTime: 100,
  })

  await nextTurn()
  worker.emit('readyok')
  await nextTurn()
  assert.equal(goCommands(worker).length, 1)

  worker.emit('info depth 8 multipv 1 score cp 35 pv a1a2')
  worker.emit('bestmove a1a2')
  assert.deepEqual(await first, [
    { uci: 'a1a2', score: 35, mate: null, rank: 1, pv: ['a1a2'] },
  ])

  await nextTurn()
  assert.equal(goCommands(worker).length, 2)
  worker.emit('info depth 8 multipv 1 score cp 20 pv b1b2')
  worker.emit('bestmove b1b2')
  assert.deepEqual(await second, [
    { uci: 'b1b2', score: 20, mate: null, rank: 1, pv: ['b1b2'] },
  ])
  client.destroy()
})

test('Stockfish cancellation settles a request waiting for worker readiness', async () => {
  const worker = new FakeStockfishWorker()
  const client = createStockfishClient({
    workerFactory: () => worker,
    readyTimeoutMs: 200,
  })
  const request = client.bestMoves('8/8/8/8/8/8/8/K6k w - - 0 1')

  await nextTurn()
  client.cancelAll()

  assert.deepEqual(await request, [])
  assert.equal(worker.terminated, true)
  assert.equal(goCommands(worker).length, 0)
})

class FakeStockfishWorker {
  constructor() {
    this.commands = []
    this.onmessage = null
    this.onerror = null
    this.terminated = false
  }

  postMessage(command) {
    this.commands.push(command)
  }

  emit(data) {
    this.onmessage?.({ data })
  }

  terminate() {
    this.terminated = true
  }
}

function nextTurn() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function goCommands(worker) {
  return worker.commands.filter((command) => command.startsWith('go '))
}
