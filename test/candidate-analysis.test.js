import assert from 'node:assert/strict'
import test from 'node:test'
import { Chess } from 'chess.js'
import { analyzeCandidatesWithRetry } from '../src/lib/candidateAnalysis.js'

const position = () => new Chess('r3k2r/p1ppqpb1/bn2pnp1/2pP4/1p2P3/2N2N2/PPQBBPPP/R3K2R w KQkq - 0 1')
const policy = { depth: 14, moveTime: 420, timeout: 2600 }
const score = (uci) => [...uci].reduce((sum, character) => sum + character.charCodeAt(0), 0)
const lines = (options) => options.searchMoves.map((uci, index) => ({ uci, score: score(uci), rank: index + 1 }))

test('normal budget preserves every legal move, stable ranks and original search limits', async () => {
  const game = position(), requests = []
  const client = { bestMoves: async (_fen, options) => { requests.push(options); return lines(options) } }
  const result = await analyzeCandidatesWithRetry(client, null, game, policy, true, { timeoutMs: 10000 })
  const legal = game.moves({ verbose: true }).map(move => move.from + move.to + (move.promotion || ''))
  assert.deepEqual([...result.map(line => line.uci)].sort(), [...legal].sort())
  assert.equal(result.length, legal.length)
  assert.deepEqual(result.map(line => line.rank), result.map((_, index) => index + 1))
  for (const request of requests) {
    assert.equal(request.depth, 14)
    assert.equal(request.moveTime, Math.max(100, Math.floor(420 / Math.ceil(legal.length / 16))))
    assert.equal(request.timeout, 2200)
  }
})

test('cancellation after first chunk stops later chunks and discards all partial candidates', async () => {
  let cancelled = false, calls = 0, stops = 0
  const client = { bestMoves: async (_fen, options) => { calls++; cancelled = true; return lines(options) }, cancelAll: () => { stops++ } }
  await assert.rejects(analyzeCandidatesWithRetry(client, client, position(), policy, true,
    { isCancelled: () => cancelled }), error => error.code === 'cancelled')
  assert.equal(calls, 1)
  assert.equal(stops, 1)
})

test('aborting an active stalled request settles once and never starts the retry client', async () => {
  const controller = new AbortController()
  let started, stopped = 0, retries = 0
  const active = new Promise(resolve => { started = resolve })
  const client = { bestMoves: () => { started(); return new Promise(() => {}) }, cancelAll: () => { stopped++ } }
  const result = analyzeCandidatesWithRetry(client, { bestMoves: async () => { retries++; return [] } }, position(), policy, true, { signal: controller.signal })
  await active; controller.abort()
  await assert.rejects(result, error => error.code === 'cancelled')
  assert.equal(stopped, 1)
  assert.equal(retries, 0)
})

test('a deadline bounds stalled work and an expired operation makes no engine call', async () => {
  let calls = 0, stops = 0
  const client = { bestMoves: () => { calls++; return new Promise(() => {}) }, cancelAll: () => { stops++ } }
  await assert.rejects(analyzeCandidatesWithRetry(client, client, position(), policy, true, { timeoutMs: 35 }), error => error.code === 'deadline')
  assert.equal(calls, 1)
  assert.equal(stops, 1)
  await assert.rejects(analyzeCandidatesWithRetry(client, client, position(), policy, true, { deadlineMs: 100, now: () => 100 }), error => error.code === 'deadline')
  assert.equal(calls, 1)
})

test('primary and retry share one remaining deadline rather than fresh per-chunk budgets', async () => {
  let now = 0, calls = 0, retried = 0
  const primary = { bestMoves: async () => { now = 900; throw new Error('first unavailable') } }
  const retry = { bestMoves: async (_fen, options) => { retried++; assert.ok(options.timeout <= 100); now += 60; calls++; return lines(options) }, cancelAll() {} }
  await assert.rejects(analyzeCandidatesWithRetry(primary, retry, position(), policy, true, { deadlineMs: 1000, now: () => now }), error => error.code === 'deadline')
  assert.equal(calls, 2)
  assert.equal(retried, 2)
})

test('missing legal-move coverage is retried in full and never published as a completed set', async () => {
  let primaryCalls = 0, retryCalls = 0
  const partial = { bestMoves: async (_fen, options) => { primaryCalls++; return lines(options).slice(1) } }
  const complete = { bestMoves: async (_fen, options) => { retryCalls++; return lines(options) } }
  const game = position()
  const result = await analyzeCandidatesWithRetry(partial, complete, game, policy, true)
  assert.equal(primaryCalls, 1)
  assert.equal(result.length, game.moves().length)
  assert.equal(retryCalls, Math.ceil(result.length / 16))
  await assert.rejects(analyzeCandidatesWithRetry(partial, partial, game, policy, true), error => error.code === 'incomplete')
})
