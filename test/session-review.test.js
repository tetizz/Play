import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import {
  applyNextPremove,
  applyPremove,
  gameFromHistory,
  isAutomaticGameOver,
  shouldResumeBotTurn,
} from '../src/lib/gameSession.js'
import { buildSmoothPath, evaluationBarDisplay } from '../src/lib/evaluationGraph.js'
import { evaluationToWhitePercent, reviewGameWithStockfish } from '../src/lib/reviewEngine.js'

test('the evaluation graph uses a continuous curved path through every point', () => {
  const path = buildSmoothPath([
    { x: 0, y: 66 },
    { x: 100, y: 40 },
    { x: 200, y: 92 },
  ])
  assert.match(path, /^M 0 66 C /)
  assert.equal((path.match(/ C /g) || []).length, 2)
  assert.doesNotMatch(path, /[HV]/)
  assert.match(path, /200 92$/)
})

test('a zero-move review draws a full-width line at equality', () => {
  const path = buildSmoothPath([{ x: 0, y: 66 }], 640)
  assert.equal(path, 'M 0 66 L 640 66')
})

test('the evaluation bar follows Chess.com-style side and result labels', () => {
  assert.deepEqual(
    evaluationBarDisplay({ percent: 50, score: 0, mate: null }),
    { percent: 50, label: '0.0', side: 'white' },
  )
  assert.deepEqual(
    evaluationBarDisplay({ percent: 0, score: null, mate: -1 }),
    { percent: 0, label: 'M1', side: 'black' },
  )
  assert.deepEqual(
    evaluationBarDisplay({ percent: 0, score: null, mate: -1 }, 'Black wins by checkmate', true),
    { percent: 0, label: '0-1', side: 'black' },
  )
})

test('valid and invalid premoves settle without leaving an unresolved turn', () => {
  const afterBot = ['e4']
  const valid = applyPremove(afterBot, { from: 'e7', to: 'e5' })
  assert.equal(valid.applied, true)
  assert.deepEqual(valid.history, ['e4', 'e5'])
  const invalid = applyPremove(afterBot, { from: 'e7', to: 'e4' })
  assert.equal(invalid.applied, false)
  assert.deepEqual(invalid.history, ['e4'])
})

test('premove queues consume one move at a time and preserve the remainder', () => {
  const queue = [
    { from: 'g1', to: 'f3' },
    { from: 'b1', to: 'c3' },
  ]
  const first = applyNextPremove(['e4', 'e5'], queue)
  assert.equal(first.applied, true)
  assert.equal(first.move.san, 'Nf3')
  assert.deepEqual(first.remaining, [queue[1]])

  const second = applyNextPremove([...first.history, 'Nc6'], first.remaining)
  assert.equal(second.applied, true)
  assert.equal(second.move.san, 'Nc3')
  assert.deepEqual(second.remaining, [])
})

test('restored games request exactly the side whose turn is missing', () => {
  assert.equal(shouldResumeBotTurn([], 'white'), false)
  assert.equal(shouldResumeBotTurn(['e4'], 'white'), true)
  assert.equal(shouldResumeBotTurn([], 'black'), true)
  assert.deepEqual(gameFromHistory(['e4', 'e5']).history(), ['e4', 'e5'])
})

test('threefold repetition is claimable but does not automatically end the game', () => {
  const threefold = gameFromHistory([
    'Nf3', 'Nf6', 'Ng1', 'Ng8',
    'Nf3', 'Nf6', 'Ng1', 'Ng8',
  ])
  assert.equal(threefold.isThreefoldRepetition(), true)
  assert.equal(threefold.isGameOver(), true)
  assert.equal(isAutomaticGameOver(threefold), false)
  assert.equal(shouldResumeBotTurn(threefold.history(), 'white'), false)
  assert.equal(shouldResumeBotTurn(threefold.history(), 'black'), true)
})

test('fivefold repetition automatically ends the game', () => {
  const fivefold = gameFromHistory([
    'Nf3', 'Nf6', 'Ng1', 'Ng8',
    'Nf3', 'Nf6', 'Ng1', 'Ng8',
    'Nf3', 'Nf6', 'Ng1', 'Ng8',
    'Nf3', 'Nf6', 'Ng1', 'Ng8',
  ])
  assert.equal(isAutomaticGameOver(fivefold), true)
})

test('Fools Mate produces a complete navigable review', async () => {
  const history = ['f4', 'e5', 'g4', 'Qh4#']
  const fakeClient = {
    async analyze(fen, options) {
      const game = new Chess(fen)
      return game.moves({ verbose: true }).slice(0, options.count || 4).map((move, index) => ({
        uci: `${move.from}${move.to}${move.promotion || ''}`,
        score: index === 0 ? 20 : 10 - index,
        mate: move.san.includes('#') ? 1 : null,
        rank: index + 1,
        pv: [`${move.from}${move.to}${move.promotion || ''}`],
      }))
    },
  }
  const review = await reviewGameWithStockfish({
    history,
    client: fakeClient,
  })
  assert.equal(review.complete, true)
  assert.equal(review.positions.length, 5)
  assert.equal(review.moments.length, 4)
  assert.match(review.result, /checkmate/i)
  assert.equal(review.counts.reduce((sum, item) => sum + item.white, 0), 2)
  assert.equal(review.counts.reduce((sum, item) => sum + item.black, 0), 2)
  assert.equal(review.graph.length, 5)
  review.graph.forEach((point) => {
    assert.equal(point.percent, evaluationToWhitePercent(point.score, point.mate))
  })
  assert.ok(Number.isFinite(review.accuracy.white))
  assert.ok(Number.isFinite(review.accuracy.black))
  assert.ok(Number.isFinite(review.gameRating.white))
  assert.ok(Number.isFinite(review.gameRating.black))
  assert.equal(review.phaseAccuracy.white.opening.moves, 2)
  assert.equal(review.phaseAccuracy.black.opening.moves, 2)
  assert.match(review.moments.at(-1).explanation, /game|choice|evaluation|mate/i)
})

test('book and best moves always score 100 percent accuracy', async () => {
  const fakeClient = {
    async analyze(fen) {
      const game = new Chess(fen)
      const move = game.moves({ verbose: true }).find((candidate) => candidate.san === 'Nf3')
        || game.moves({ verbose: true })[0]
      return [{
        uci: `${move.from}${move.to}${move.promotion || ''}`,
        score: 15,
        mate: null,
        rank: 1,
        pv: [`${move.from}${move.to}${move.promotion || ''}`],
      }]
    },
  }
  const game = new Chess()
  const key = game.fen().split(' ').slice(0, 4).join(' ')
  const review = await reviewGameWithStockfish({
    history: ['Nf3'],
    client: fakeClient,
    repertoire: {
      openingBook: {
        [key]: [{ san: 'Nf3', games: 20 }],
      },
    },
  })
  assert.equal(review.moments[0].key, 'book')
  assert.equal(review.moments[0].accuracy, 100)
  assert.equal(review.accuracy.white, 100)
})
