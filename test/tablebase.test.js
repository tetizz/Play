import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import {
  createTablebaseClient,
  isTablebaseEligible,
  selectTablebaseDecision,
} from '../src/lib/tablebaseClient.js'

const PROMOTION_TABLEBASE = {
  category: 'win',
  moves: [
    { uci: 'a7a8q', category: 'loss', dtm: -12, dtz: -9, checkmate: false },
    { uci: 'a7a8b', category: 'loss', dtm: -32, dtz: -32, checkmate: false },
    { uci: 'a7a8n', category: 'loss', dtm: -44, dtz: -44, checkmate: false },
  ],
}

test('tablebase eligibility is limited to positions the exact service supports', () => {
  assert.equal(isTablebaseEligible('7k/P7/8/8/8/8/8/6BK w - - 0 1'), true)
  assert.equal(isTablebaseEligible(new Chess().fen()), false)
  assert.equal(isTablebaseEligible('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), false)
})

test('an exact winning underpromotion is preferred when it creates bishop and knight', () => {
  const game = new Chess('7k/P7/8/8/8/8/8/6BK w - - 0 1')
  const decision = selectTablebaseDecision(game, PROMOTION_TABLEBASE, {
    preferBishopKnightObjective: true,
  })
  assert.equal(decision.move.promotion, 'n')
  assert.equal(decision.source, 'tablebase-objective')
  assert.equal(decision.exact, true)
  assert.equal(decision.line.dtm, -44)
})

test('an exact tablebase win offers surplus material before bishop and knight mate', () => {
  const game = new Chess('7k/8/8/8/8/8/K5R1/1BN5 w - - 0 1')
  const decision = selectTablebaseDecision(game, {
    category: 'win',
    moves: [
      { uci: 'c1b3', category: 'loss', checkmate: false, dtm: -5, dtz: -1 },
      { uci: 'g2g8', category: 'loss', checkmate: false, dtm: -41, dtz: -1 },
    ],
  }, {
    preferBishopKnightObjective: true,
  })
  assert.equal(decision.move.san, 'Rg8+')
  assert.equal(decision.source, 'tablebase-objective')
})

test('an exact tablebase win advances the pawn needed for the bishop and knight objective', () => {
  const game = new Chess('7k/8/P7/8/8/8/K7/1B6 w - - 0 1')
  const decision = selectTablebaseDecision(game, {
    category: 'win',
    moves: [
      { uci: 'b1c2', category: 'loss', checkmate: false, dtm: -15, dtz: -1 },
      { uci: 'a6a7', category: 'loss', checkmate: false, dtm: -31, dtz: 0 },
    ],
  }, {
    preferBishopKnightObjective: true,
  })
  assert.equal(decision.move.san, 'a7')
  assert.equal(decision.source, 'tablebase-objective')
})

test('without the special objective the tablebase chooses the shortest exact mate', () => {
  const game = new Chess('7k/P7/8/8/8/8/8/6BK w - - 0 1')
  const decision = selectTablebaseDecision(game, PROMOTION_TABLEBASE)
  assert.equal(decision.move.promotion, 'q')
  assert.equal(decision.source, 'tablebase-mate')
  assert.equal(decision.line.dtm, -12)
})

test('the tablebase disengages the bishop-knight objective when the route is impossible', () => {
  const game = new Chess('7k/8/8/8/8/8/8/Q6K w - - 0 1')
  const decision = selectTablebaseDecision(game, {
    category: 'win',
    moves: [
      { uci: 'a1a8', category: 'loss', dtm: -1, dtz: -1, checkmate: true },
      { uci: 'a1a7', category: 'loss', dtm: -7, dtz: -1, checkmate: false },
    ],
  }, {
    preferBishopKnightObjective: true,
  })
  assert.equal(decision.move.san, 'Qa8+')
  assert.equal(decision.source, 'tablebase-mate')
})

test('the tablebase still takes the only exact win when a personality filter dislikes it', () => {
  const game = new Chess('7k/8/5N2/8/8/8/K1B3R1/8 w - - 0 1')
  const decision = selectTablebaseDecision(game, {
    category: 'win',
    moves: [
      { uci: 'g2g8', category: 'loss', dtm: -1, dtz: -1, checkmate: true },
    ],
  }, {
    preferBishopKnightObjective: true,
  })
  assert.equal(decision.move.san, 'Rg8#')
  assert.equal(decision.source, 'tablebase-mate')
  assert.equal(decision.exact, true)
})

test('drawn and cursed tablebase positions do not claim a forced mate', () => {
  const game = new Chess('7k/P7/8/8/8/8/8/6BK w - - 0 1')
  assert.equal(selectTablebaseDecision(game, { category: 'draw', moves: [] }), null)
  assert.equal(selectTablebaseDecision(game, {
    category: 'cursed-win',
    moves: [{ uci: 'a7a8n', category: 'blessed-loss', dtm: -44 }],
  }), null)
})

test('the tablebase client caches successful probes and can be cancelled safely', async () => {
  let calls = 0
  const payload = { category: 'win', moves: [] }
  const client = createTablebaseClient({
    fetchImpl: async () => {
      calls += 1
      return { ok: true, json: async () => payload }
    },
  })
  const fen = '7k/P7/8/8/8/8/8/6BK w - - 0 1'
  assert.equal(await client.probe(fen), payload)
  assert.equal(await client.probe(fen), payload)
  assert.equal(calls, 1)
  client.cancelAll()
})

test('concurrent exact-FEN probes share one call without merging halfmove clocks', async () => {
  let calls = 0
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const payload = { category: 'draw', moves: [] }
  const client = createTablebaseClient({
    fetchImpl: async () => {
      calls += 1
      await gate
      return { ok: true, json: async () => payload }
    },
  })
  const fen = '7k/P7/8/8/8/8/8/6BK w - - 0 1'
  const first = client.probe(fen)
  const second = client.probe(fen)
  const differentClock = client.probe(fen.replace(' 0 1', ' 1 1'))
  assert.equal(calls, 2)
  release()
  assert.deepEqual(await Promise.all([first, second, differentClock]), [payload, payload, payload])
  client.destroy()
})

test('cancelled generations neither reuse pending work nor overwrite newer results', async () => {
  const requests = []
  const client = createTablebaseClient({
    fetchImpl: () => new Promise((resolve) => { requests.push(resolve) }),
  })
  const fen = '7k/P7/8/8/8/8/8/6BK w - - 0 1'
  const old = client.probe(fen)
  client.cancelAll()
  const fresh = client.probe(fen)
  assert.equal(requests.length, 2)
  requests[0]({ ok: true, json: async () => ({ category: 'old' }) })
  assert.equal(await old, null)
  const joined = client.probe(fen)
  assert.equal(requests.length, 2)
  const payload = { category: 'new', moves: [] }
  requests[1]({ ok: true, json: async () => payload })
  assert.deepEqual(await Promise.all([fresh, joined]), [payload, payload])
  assert.equal(await client.probe(fen), payload)
  client.destroy()
})

test('successful cache evicts the least recently used FEN and failures remain retryable', async () => {
  const calls = []
  let fail = false
  const client = createTablebaseClient({
    maxCacheSize: 2,
    fetchImpl: async (url) => {
      calls.push(new URL(url).searchParams.get('fen'))
      return { ok: !fail, json: async () => ({ category: 'draw', moves: [] }) }
    },
  })
  const fen = '7k/P7/8/8/8/8/8/6BK w - - 0 1'
  const second = fen.replace(' 0 1', ' 1 1')
  const third = fen.replace(' 0 1', ' 2 1')
  await client.probe(fen)
  await client.probe(second)
  await client.probe(fen)
  await client.probe(third)
  await client.probe(fen)
  assert.equal(calls.length, 3)
  await client.probe(second)
  assert.equal(calls.length, 4)
  fail = true
  assert.equal(await client.probe(third), null)
  fail = false
  assert.notEqual(await client.probe(third), null)
  assert.equal(calls.length, 6)
  client.destroy()
})
