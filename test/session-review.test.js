import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { applyPremove, gameFromHistory, shouldResumeBotTurn } from '../src/lib/gameSession.js'
import { reviewGameWithStockfish } from '../src/lib/reviewEngine.js'

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
})
