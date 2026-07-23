import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { applyNextPremove, gameFromHistory } from '../src/lib/gameSession.js'
import {
  buildPremoveProjection,
  normalizePremoveQueue,
  potentialPremoveTargets,
  premovePieceAt,
  premovePositionObject,
} from '../src/lib/premoveRules.js'

test('normalization preserves an unbounded ordered premove queue', () => {
  const cycle = [
    { from: 'g1', to: 'f3' },
    { from: 'f3', to: 'g5' },
    { from: 'g5', to: 'f3' },
    { from: 'f3', to: 'g1' },
  ]
  const queue = Array.from({ length: 40 }, (_, index) => ({
    id: `move-${index}`,
    ...cycle[index % cycle.length],
  }))

  const normalized = normalizePremoveQueue(queue)
  const projection = buildPremoveProjection(new Chess(), normalized, 'w')

  assert.equal(normalized.length, 40)
  assert.equal(projection.acceptedMoves.length, 40)
  assert.deepEqual(
    normalized.map(({ from, to }) => `${from}${to}`),
    queue.map(({ from, to }) => `${from}${to}`),
  )
  assert.deepEqual(premovePieceAt(projection, 'g1'), { color: 'w', type: 'n' })
})

test('a projected piece can be moved repeatedly and can conditionally capture', () => {
  const game = new Chess()
  game.move('e4')
  const projection = buildPremoveProjection(game, [
    { from: 'g1', to: 'f3' },
    { from: 'f3', to: 'g5' },
    { from: 'g5', to: 'h7' },
  ], 'w')

  assert.equal(projection.acceptedMoves.length, 3)
  assert.equal(premovePieceAt(projection, 'g1'), null)
  assert.equal(premovePieceAt(projection, 'h7')?.color, 'w')
  assert.equal(premovePieceAt(projection, 'h7')?.type, 'n')
  assert.equal(premovePositionObject(projection).h7.pieceType, 'wN')
})

test('black can build the same projected multi-premove chains', () => {
  const game = new Chess()
  game.move('e4')
  const projection = buildPremoveProjection(game, [
    { from: 'g8', to: 'f6' },
    { from: 'f6', to: 'g4' },
    { from: 'g4', to: 'h2' },
  ], 'b')

  assert.equal(projection.acceptedMoves.length, 3)
  assert.deepEqual(premovePieceAt(projection, 'h2'), { color: 'b', type: 'n' })
  assert.equal(premovePieceAt(projection, 'g8'), null)
})

test('projected castling moves the rook so a later rook premove can be queued', () => {
  const game = gameFromHistory(['Nf3', 'd5', 'g3', 'c5', 'Bg2', 'Nc6'])
  const projection = buildPremoveProjection(game, [
    { from: 'e1', to: 'g1' },
    { from: 'f1', to: 'e1' },
  ], 'w')

  assert.equal(projection.acceptedMoves.length, 2)
  assert.deepEqual(premovePieceAt(projection, 'g1'), { color: 'w', type: 'k' })
  assert.deepEqual(premovePieceAt(projection, 'e1'), { color: 'w', type: 'r' })
  assert.equal(premovePieceAt(projection, 'h1'), null)
})

test('projected underpromotion changes the piece used by the next premove', () => {
  const game = gameFromHistory(['a4', 'h5', 'a5', 'h4', 'a6', 'h3', 'axb7', 'hxg2'])
  const projection = buildPremoveProjection(game, [
    { from: 'b7', to: 'a8', promotion: 'n' },
    { from: 'a8', to: 'c7' },
  ], 'w')

  assert.equal(projection.acceptedMoves.length, 2)
  assert.deepEqual(premovePieceAt(projection, 'c7'), { color: 'w', type: 'n' })
  assert.equal(premovePieceAt(projection, 'a8'), null)
})

test('conditional en-passant projection removes the pawn that must double-step', () => {
  const game = gameFromHistory(['e4', 'a6', 'e5'])
  const projection = buildPremoveProjection(game, [
    { from: 'e5', to: 'd6' },
    { from: 'd6', to: 'd7' },
  ], 'w')

  assert.equal(game.turn(), 'b')
  assert.equal(projection.acceptedMoves.length, 2)
  assert.deepEqual(premovePieceAt(projection, 'd7'), { color: 'w', type: 'p' })
})

test('projection keeps only the valid prefix when a later source disappears', () => {
  const game = new Chess()
  game.move('e4')
  const projection = buildPremoveProjection(game, [
    { from: 'g1', to: 'f3' },
    { from: 'f3', to: 'g5' },
    { from: 'g1', to: 'h3' },
    { from: 'g5', to: 'h7' },
  ], 'w')

  assert.equal(projection.acceptedMoves.length, 2)
  assert.equal(projection.rejectedIndex, 2)
})

test('normalization drops malformed entries and their dependent suffix', () => {
  const normalized = normalizePremoveQueue([
    { from: 'g1', to: 'f3' },
    { from: 'not-a-square', to: 'g5' },
    { from: 'b1', to: 'c3' },
  ])

  assert.equal(normalized.length, 1)
  assert.equal(normalized[0].from, 'g1')
  assert.equal(normalized[0].to, 'f3')
})

test('pawn targets never include an occupied straight-ahead square', () => {
  const game = new Chess()
  const projection = buildPremoveProjection(game, [], 'w')
  projection.pieces.e3 = { color: 'b', type: 'n' }

  assert.equal(
    potentialPremoveTargets(projection, 'e2').some(({ square }) => square === 'e3'),
    false,
  )
})

test('three queued premoves execute one at a time after alternating replies', () => {
  let history = ['e4', 'd6']
  let queue = [
    { from: 'g1', to: 'f3' },
    { from: 'f3', to: 'g5' },
    { from: 'g5', to: 'h7' },
  ]

  const first = applyNextPremove(history, queue)
  assert.equal(first.move.san, 'Nf3')
  assert.equal(first.remaining.length, 2)

  const afterFirstReply = gameFromHistory(first.history)
  afterFirstReply.move('g6')
  history = afterFirstReply.history()
  queue = first.remaining
  const second = applyNextPremove(history, queue)
  assert.equal(second.move.san, 'Ng5')
  assert.equal(second.remaining.length, 1)

  const afterSecondReply = gameFromHistory(second.history)
  afterSecondReply.move('Bg7')
  const third = applyNextPremove(afterSecondReply.history(), second.remaining)
  assert.equal(third.move.san, 'Nxh7')
  assert.equal(third.remaining.length, 0)
})

test('an invalid queue head clears its dependent suffix', () => {
  const settled = applyNextPremove(['e4', 'e5'], [
    { from: 'e4', to: 'd5' },
    { from: 'd5', to: 'd6' },
  ])

  assert.equal(settled.applied, false)
  assert.deepEqual(settled.remaining, [])
  assert.deepEqual(settled.history, ['e4', 'e5'])
})
