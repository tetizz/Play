import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { applyPremove, gameFromHistory, shouldResumeBotTurn } from '../src/lib/gameSession.js'
import { evaluationToWhitePercent, reviewGameWithStockfish } from '../src/lib/reviewEngine.js'

test('valid and invalid premoves settle without leaving an unresolved turn', () => {
  const afterBot = ['e4']
  const valid = applyPremove(afterBot, { from: 'e7', to: 'e5' })
  assert.equal(valid.applied, true)
  assert.deepEqual(valid.history, ['e4', 'e5'])
  const invalid = applyPremove(afterBot, { from: 'e7', to: 'e4' })
  assert.equal(invalid.applied, false)
  assert.deepEqual(invalid.history, ['e4'])
})

test('restored games request exactly the side whose turn is missing', () => {
  assert.equal(shouldResumeBotTurn([], 'white'), false)
  assert.equal(shouldResumeBotTurn(['e4'], 'white'), true)
  assert.equal(shouldResumeBotTurn([], 'black'), true)
  assert.deepEqual(gameFromHistory(['e4', 'e5']).history(), ['e4', 'e5'])
})

test('Fools Mate produces a complete navigable review', async () => {
  const history = ['f3', 'e5', 'g4', 'Qh4#']
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
