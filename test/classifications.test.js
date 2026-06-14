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

test('a verified sacrifice can override an otherwise Great critical move', () => {
  const game = new Chess('q3k3/p7/8/8/8/8/8/R3K3 w - - 0 1')
  const move = game.moves({ verbose: true }).find((candidate) => candidate.from === 'a1' && candidate.to === 'a7')
  const result = classifyMove({
    beforeFen: game.fen(),
    move,
    bestLine: { uci: 'a1a7', score: 20, rank: 1, pv: ['a1a7', 'a8a7'] },
    playedLine: { uci: 'a1a7', score: 20, rank: 1, pv: ['a1a7', 'a8a7'] },
    candidateLines: [
      { uci: 'a1a7', score: 20, rank: 1, pv: ['a1a7', 'a8a7'] },
      { uci: 'a1a6', score: -100, rank: 2, pv: ['a1a6'] },
    ],
    legalMoveCount: game.moves().length,
  })
  assert.equal(result.key, 'brilliant')
})

test('the Rad1 exchange from the supplied game is not a sacrifice or Brilliant', () => {
  const game = new Chess('3r3r/p1q2p1p/2B1bk1b/1P2pp2/1Qp5/P1N3P1/4PP1P/R4RK1 w - - 4 18')
  const move = game.moves({ verbose: true }).find((candidate) =>
    candidate.from === 'a1' && candidate.to === 'd1',
  )
  const pv = ['a1d1', 'd8d1', 'f1d1', 'h8d8']
  assert.equal(verifySacrifice(new Chess(game.fen()), move, pv), false)

  const result = classifyMove({
    beforeFen: game.fen(),
    move,
    bestLine: { uci: 'a1d1', score: 33, rank: 1, pv },
    playedLine: { uci: 'a1d1', score: 33, rank: 1, pv },
    candidateLines: [
      { uci: 'a1d1', score: 33, rank: 1, pv },
      { uci: 'f1d1', score: 31, rank: 2, pv: ['f1d1'] },
    ],
    legalMoveCount: game.moves().length,
  })
  assert.notEqual(result.key, 'brilliant')
  assert.notEqual(result.key, 'great')
})

test('Qe5 from move 88 is the verified queen investment in the supplied game', () => {
  const game = new Chess('K7/1Pk5/8/8/4q3/8/1Q6/8 w - - 15 88')
  const move = game.moves({ verbose: true }).find((candidate) =>
    candidate.from === 'b2' && candidate.to === 'e5',
  )
  const pv = ['b2e5', 'e4e5', 'b7b8q', 'c7c6', 'b8e5']
  assert.equal(verifySacrifice(new Chess(game.fen()), move, pv), true)

  const result = classifyMove({
    beforeFen: game.fen(),
    move,
    bestLine: { uci: 'b2e5', score: 99992, mate: 8, rank: 1, pv },
    playedLine: { uci: 'b2e5', score: 99992, mate: 8, rank: 1, pv },
    candidateLines: [
      { uci: 'b2e5', score: 99992, mate: 8, rank: 1, pv },
      { uci: 'b2c3', score: 467, mate: null, rank: 2, pv: ['b2c3'] },
    ],
    legalMoveCount: game.moves().length,
  })
  assert.equal(result.key, 'brilliant')
  assert.equal(result.isRealPieceSacrifice, true)
})

test('a uniquely necessary best move is Great across a clear evaluation gap', () => {
  const game = new Chess()
  const move = game.moves({ verbose: true }).find((candidate) => candidate.san === 'Nf3')
  const result = classifyMove({
    beforeFen: game.fen(),
    move,
    bestLine: { uci: 'g1f3', score: 40, rank: 1, pv: ['g1f3'] },
    playedLine: { uci: 'g1f3', score: 40, rank: 1, pv: ['g1f3'] },
    candidateLines: [
      { uci: 'g1f3', score: 40, rank: 1, pv: ['g1f3'] },
      { uci: 'a2a3', score: -60, rank: 2, pv: ['a2a3'] },
    ],
    legalMoveCount: game.moves().length,
  })
  assert.equal(result.key, 'great')
  assert.equal(result.isOnlyMoveThatKeepsAdvantage, true)
})

test('a defended critical capture can be Great but taking a loose piece cannot', () => {
  const defended = new Chess('r3k3/p7/8/8/8/8/8/R3K3 w - - 0 1')
  const defendedMove = defended.moves({ verbose: true }).find((candidate) =>
    candidate.from === 'a1' && candidate.to === 'a7',
  )
  const defendedResult = classifyMove({
    beforeFen: defended.fen(),
    move: defendedMove,
    bestLine: { uci: 'a1a7', score: 100, rank: 1, pv: ['a1a7'] },
    playedLine: { uci: 'a1a7', score: 100, rank: 1, pv: ['a1a7'] },
    candidateLines: [
      { uci: 'a1a7', score: 100, rank: 1, pv: ['a1a7'] },
      { uci: 'a1a6', score: -100, rank: 2, pv: ['a1a6'] },
    ],
    legalMoveCount: defended.moves().length,
  })
  assert.equal(defendedResult.key, 'great')

  const loose = new Chess('4k3/p7/8/8/8/8/8/R3K3 w - - 0 1')
  const looseMove = loose.moves({ verbose: true }).find((candidate) =>
    candidate.from === 'a1' && candidate.to === 'a7',
  )
  const looseResult = classifyMove({
    beforeFen: loose.fen(),
    move: looseMove,
    bestLine: { uci: 'a1a7', score: 100, rank: 1, pv: ['a1a7'] },
    playedLine: { uci: 'a1a7', score: 100, rank: 1, pv: ['a1a7'] },
    candidateLines: [
      { uci: 'a1a7', score: 100, rank: 1, pv: ['a1a7'] },
      { uci: 'a1a6', score: -100, rank: 2, pv: ['a1a6'] },
    ],
    legalMoveCount: loose.moves().length,
  })
  assert.equal(looseResult.key, 'best')
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
