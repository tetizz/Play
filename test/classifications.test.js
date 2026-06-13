import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import {
  accuracyFromExpectedPointsLoss,
  classificationKeyFromLoss,
  classifyMove,
  expectedPointsFromScore,
  verifySacrifice,
} from '../src/lib/bookupClassifications.js'

test('Bookup expected-points thresholds retain their exact boundary behavior', () => {
  assert.equal(classificationKeyFromLoss(0, true), 'best')
  assert.equal(classificationKeyFromLoss(0, false), 'excellent')
  assert.equal(classificationKeyFromLoss(0.02), 'excellent')
  assert.equal(classificationKeyFromLoss(0.0201), 'good')
  assert.equal(classificationKeyFromLoss(0.05), 'good')
  assert.equal(classificationKeyFromLoss(0.0501), 'inaccuracy')
  assert.equal(classificationKeyFromLoss(0.10), 'inaccuracy')
  assert.equal(classificationKeyFromLoss(0.1001), 'mistake')
  assert.equal(classificationKeyFromLoss(0.20), 'mistake')
  assert.equal(classificationKeyFromLoss(0.2001), 'blunder')
})

test('expected-points and accuracy use continuous evaluation loss', () => {
  assert.equal(expectedPointsFromScore(0), 0.5)
  assert.equal(expectedPointsFromScore(0, 1), 1)
  assert.equal(expectedPointsFromScore(0, -1), 0)
  assert.equal(accuracyFromExpectedPointsLoss(0, 'best'), 100)
  assert.equal(accuracyFromExpectedPointsLoss(0.04, 'book'), 100)
  assert.ok(accuracyFromExpectedPointsLoss(0.06, 'inaccuracy') < 80)
  assert.ok(accuracyFromExpectedPointsLoss(0.06, 'inaccuracy') > 70)
  assert.equal(accuracyFromExpectedPointsLoss(null, 'unreviewed'), null)
})

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

test('a restricted rank-one result is not mistaken for the actual engine best move', () => {
  const game = new Chess()
  const move = game.moves({ verbose: true }).find((candidate) => candidate.san === 'e4')
  const result = classifyMove({
    beforeFen: game.fen(),
    move,
    bestLine: { uci: 'd2d4', score: 25, rank: 1, pv: ['d2d4'] },
    playedLine: { uci: 'e2e4', score: 24, rank: 1, pv: ['e2e4'] },
    candidateLines: [
      { uci: 'e2e4', score: 24, rank: 1, pv: ['e2e4'] },
      { uci: 'd2d4', score: 25, rank: 2, pv: ['d2d4'] },
    ],
    legalMoveCount: game.moves().length,
  })
  assert.equal(result.key, 'excellent')
  assert.equal(result.expectedPointsLoss, 0.0009)
})

test('a move that allows forced mate is a Blunder under Bookup expected-points bands', () => {
  const game = new Chess()
  const move = game.moves({ verbose: true }).find((candidate) => candidate.san === 'f3')
  const result = classifyMove({
    beforeFen: game.fen(),
    move,
    bestLine: { uci: 'e2e4', score: 40, mate: null, rank: 1, pv: ['e2e4'] },
    playedLine: { uci: 'f2f3', score: -99996, mate: -4, rank: null, pv: ['f2f3'] },
    candidateLines: [{ uci: 'e2e4', score: 40, mate: null, rank: 1, pv: ['e2e4'] }],
    legalMoveCount: game.moves().length,
  })
  assert.equal(result.key, 'blunder')
})

test('an exact branch outside MultiPV receives Bookup branch-quality floors', () => {
  const game = new Chess()
  const move = game.moves({ verbose: true }).find((candidate) => candidate.san === 'f3')
  const result = classifyMove({
    beforeFen: game.fen(),
    move,
    bestLine: { uci: 'e2e4', score: 50, rank: 1, pv: ['e2e4'] },
    playedLine: { uci: 'f2f3', score: -10, rank: null, pv: ['f2f3'] },
    candidateLines: [{ uci: 'e2e4', score: 50, rank: 1, pv: ['e2e4'] }],
    legalMoveCount: game.moves().length,
    openingPhase: false,
  })
  assert.equal(result.key, 'inaccuracy')
})
