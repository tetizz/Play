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

test('without the special objective the tablebase chooses the shortest exact mate', () => {
  const game = new Chess('7k/P7/8/8/8/8/8/6BK w - - 0 1')
  const decision = selectTablebaseDecision(game, PROMOTION_TABLEBASE)
  assert.equal(decision.move.promotion, 'q')
  assert.equal(decision.source, 'tablebase-mate')
  assert.equal(decision.line.dtm, -12)
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
