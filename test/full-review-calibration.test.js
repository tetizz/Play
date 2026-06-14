import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import {
  accuracyFromExpectedPointsLoss,
  classifyMove,
} from '../src/lib/bookupClassifications.js'
import { aggregateAccuracy } from '../src/lib/reviewEngine.js'

const fixture = JSON.parse(fs.readFileSync(
  new URL('./fixtures/trixize-mubassar-depth22-review.json', import.meta.url),
  'utf8',
))

test('the supplied Trixize-Mubassar review is not inflated', () => {
  const openingBookPlies = new Set([1, 2, 3, 4, 5, 6, 7])
  const moments = fixture.map((record) => {
    const game = new Chess(record.fen)
    const classification = classifyMove({
      beforeFen: record.fen,
      move: game.move(record.move),
      bestLine: record.best,
      playedLine: record.played,
      candidateLines: record.candidates,
      legalMoveCount: record.legal,
      openingPhase: record.ply <= 16,
      inBook: openingBookPlies.has(record.ply),
      isPlayerMove: true,
    })
    const perspective = record.side === 'w' ? 1 : -1
    return {
      ...record,
      key: classification.key,
      accuracy: accuracyFromExpectedPointsLoss(
        classification.expectedPointsLoss,
        classification.key,
      ),
      scoreBefore: record.best.score * perspective,
      mateBefore: Number.isFinite(record.best.mate)
        ? record.best.mate * perspective
        : null,
      scoreAfter: record.played.score * perspective,
      mateAfter: Number.isFinite(record.played.mate)
        ? record.played.mate * perspective
        : null,
    }
  })

  const white = moments.filter((moment) => moment.side === 'w')
  const black = moments.filter((moment) => moment.side === 'b')

  assert.equal(white.filter((moment) => moment.key === 'brilliant').length, 0)
  assert.equal(white.filter((moment) => moment.key === 'great').length, 3)
  assert.equal(white.filter((moment) => moment.key === 'best').length, 58)
  assert.ok(aggregateAccuracy(moments, 'w') >= 95.5)
  assert.ok(aggregateAccuracy(moments, 'w') <= 96.8)
  assert.ok(aggregateAccuracy(moments, 'b') >= 89.5)
  assert.ok(aggregateAccuracy(moments, 'b') <= 91)
  assert.ok(black.some((moment) => moment.key === 'inaccuracy'))
})
