import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { classifyMove, verifySacrifice } from '../src/lib/bookupClassifications.js'

test('an ordinary capture is never automatically Brilliant', () => {
  const game = new Chess('4k3/8/8/8/8/8/4p3/3QK3 w - - 0 1')
  const move = game.moves({ verbose: true }).find((candidate) => candidate.from === 'd1' && candidate.to === 'e2')
  const result = classifyMove({
    beforeFen: game.fen(),
    move,
    bestLine: { uci: 'd1e2', score: 60, rank: 1, pv: ['d1e2'] },
    playedLine: { uci: 'd1e2', score: 60, rank: 1, pv: ['d1e2'] },
    candidateLines: [
      { uci: 'd1e2', score: 60, rank: 1, pv: ['d1e2'] },
      { uci: 'd1d8', score: 52, rank: 2, pv: ['d1d8'] },
    ],
    legalMoveCount: game.moves().length,
  })
  assert.notEqual(result.key, 'brilliant')
})

test('a sound near-best move with a PV-confirmed sacrifice can be Brilliant', () => {
  const game = new Chess('q3k3/p7/8/8/8/8/8/R3K3 w - - 0 1')
  const move = game.moves({ verbose: true }).find((candidate) => candidate.from === 'a1' && candidate.to === 'a7')
  assert.equal(verifySacrifice(new Chess(game.fen()), move, ['a1a7', 'a8a7']), true)
  const result = classifyMove({
    beforeFen: game.fen(),
    move,
    bestLine: { uci: 'a1a7', score: 20, rank: 1, pv: ['a1a7', 'a8a7'] },
    playedLine: { uci: 'a1a7', score: 20, rank: 1, pv: ['a1a7', 'a8a7'] },
    candidateLines: [
      { uci: 'a1a7', score: 20, rank: 1, pv: ['a1a7', 'a8a7'] },
      { uci: 'a1a6', score: 0, rank: 2, pv: ['a1a6'] },
    ],
    legalMoveCount: game.moves().length,
  })
  assert.equal(result.key, 'brilliant')
  assert.equal(result.isRealPieceSacrifice, true)
})

test('forced positions are classified as Forced', () => {
  const game = new Chess('8/8/8/8/Q7/K7/8/k7 b - - 0 1')
  const moves = game.moves({ verbose: true })
  assert.equal(moves.length, 1)
  const move = moves[0]
  const result = classifyMove({
    beforeFen: game.fen(),
    move,
    bestLine: { uci: `${move.from}${move.to}`, score: -900, rank: 1, pv: [] },
    playedLine: { uci: `${move.from}${move.to}`, score: -900, rank: 1, pv: [] },
    candidateLines: [],
    legalMoveCount: 1,
  })
  assert.equal(result.key, 'forced')
})
