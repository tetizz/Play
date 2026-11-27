import test from 'node:test'
import assert from 'node:assert/strict'
import { createStockfishClient } from '../src/lib/stockfishClient.js'

test('Stockfish starts the pinned 19 lite module worker and keeps its array contract on startup failure', async () => {
  let createdWorker
  const client = createStockfishClient({
    workerFactory: (url, options) => {
      createdWorker = { url, options }
      throw new Error('worker unavailable')
    },
  })

  assert.deepEqual(
    await client.bestMoves('8/8/8/8/8/8/8/K6k w - - 0 1'),
    [],
  )
  assert.equal(createdWorker.url.endsWith('stockfish/stockfish-19-worker.js?variant=lite'), true)
  assert.deepEqual(createdWorker.options, { type: 'module' })
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

test('Stockfish clamps and rounds strength to the advertised range on every search', async () => {
  const worker = new FakeStockfishWorker()
  const client = createStockfishClient({ workerFactory: () => worker })
  const fen = '8/8/8/8/8/8/8/K6k w - - 0 1'
  const first = client.bestMove(fen, { elo: 4000 })
  await nextTurn()
  worker.emit('option name UCI_Elo type spin default 1320 min 1320 max 3190')
  worker.emit('readyok')
  await nextTurn()
  assert.equal(worker.commands.includes('setoption name UCI_Elo value 3190'), true)
  worker.emit('bestmove a1a2')
  await first

  for (const [requested, expected] of [[500, 1320], [2200.8, 2201]]) {
    const result = client.bestMove(fen, { elo: requested })
    await nextTurn()
    assert.equal(worker.commands.includes(`setoption name UCI_Elo value ${expected}`), true)
    worker.emit('bestmove a1a2')
    await result
  }
  const review = client.analyze(fen)
  await nextTurn()
  assert.equal(worker.commands.at(-4), 'setoption name UCI_LimitStrength value false')
  worker.emit('bestmove a1a2')
  await review
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

test('late messages from a cancelled worker cannot finish a replacement search', async () => {
  const workers = [new FakeStockfishWorker(), new FakeStockfishWorker()]
  let nextWorker = 0
  const client = createStockfishClient({ workerFactory: () => workers[nextWorker++] })
  const first = client.bestMove('8/8/8/8/8/8/8/K6k w - - 0 1')
  workers[0].emit('readyok')
  await nextTurn()
  client.cancelAll()
  assert.equal(await first, null)

  const replacement = client.bestMove('8/8/8/8/8/8/8/1K5k w - - 0 1')
  workers[1].emit('readyok')
  await nextTurn()
  workers[0].emit('info depth 8 score cp 900 pv a1a2')
  workers[0].emit('bestmove a1a2')
  workers[1].emit('info depth 8 score cp 20 pv b1b2')
  workers[1].emit('bestmove b1b2')

  assert.equal(await replacement, 'b1b2')
  client.destroy()
})

test('a late error from a cancelled worker cannot terminate its replacement', async () => {
  const workers = [new FakeStockfishWorker(), new FakeStockfishWorker()]
  let nextWorker = 0
  const client = createStockfishClient({ workerFactory: () => workers[nextWorker++] })
  const first = client.bestMove('8/8/8/8/8/8/8/K6k w - - 0 1')
  workers[0].emit('readyok')
  await nextTurn()
  client.cancelAll()
  assert.equal(await first, null)

  const replacement = client.bestMove('8/8/8/8/8/8/8/1K5k w - - 0 1')
  workers[1].emit('readyok')
  await nextTurn()
  workers[0].onerror(new Error('late failure'))
  workers[1].emit('bestmove b1b2')

  assert.equal(await replacement, 'b1b2')
  assert.equal(workers[1].terminated, false)
  client.destroy()
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
