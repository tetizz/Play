import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { Chess } from 'chess.js'
import { classifyMove } from '../src/lib/bookupClassifications.js'

const fixtureUrl = new URL('./fixtures/trixize-akshit-depth18-review.json', import.meta.url)
const reviewRecords = JSON.parse(fs.readFileSync(fixtureUrl, 'utf8'))
const bookPlies = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16])

function classifyReviewRecord(record) {
  const game = new Chess(record.fen)
  const move = game.move(record.move)
  return classifyMove({
    beforeFen: record.fen,
    move,
    bestLine: record.best,
    playedLine: record.played,
    candidateLines: record.candidates,
    legalMoveCount: record.legal,
    openingPhase: record.ply <= 16,
    inBook: bookPlies.has(record.ply),
    isPlayerMove: true,
  })
}

test('depth-18 Trixize versus Akshit review preserves calibrated Great counts', () => {
  const classifications = reviewRecords.map((record) => ({
    ...record,
    classification: classifyReviewRecord(record).key,
  }))
  const greatBySide = classifications.reduce((counts, record) => {
    if (record.classification === 'great') counts[record.side] += 1
    return counts
  }, { w: 0, b: 0 })

  assert.deepEqual(greatBySide, { w: 12, b: 14 })
  assert.deepEqual(
    classifications
      .filter((record) => record.classification === 'brilliant')
      .map((record) => record.san),
    ['Qe5+'],
  )
  assert.notEqual(
    classifications.find((record) => record.san === 'Rad1')?.classification,
    'brilliant',
  )
})

test('critical theory takes precedence over a generic Book label', () => {
  const criticalTheory = reviewRecords.find((record) => record.ply === 7)
  assert.equal(criticalTheory.san, 'd4')
  assert.equal(classifyReviewRecord(criticalTheory).key, 'great')
})
