import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { reviewGameWithStockfish } from '../src/lib/reviewEngine.js'

const records = JSON.parse(fs.readFileSync(
  new URL('./fixtures/trixize-mubassar-depth22-review.json', import.meta.url), 'utf8',
))
const history = records.map((record) => record.san)
const fullLine = records.map((record) => record.move)

async function reviewVariation(pv) {
  const original = structuredClone(pv)
  const requests = []
  const client = {
    async analyze(fen, options) {
      requests.push({ fen, options: structuredClone(options) })
      return [{ uci: fullLine[0], rank: 1, score: 0, mate: null, pv: structuredClone(pv) }]
    },
  }
  const review = await reviewGameWithStockfish({ history: [history[0]], client, playedClient: client })
  assert.deepEqual(pv, original)
  assert.equal(requests.length, 2)
  assert(requests.every((request) => request.fen === records[0].fen))
  assert.deepEqual(requests[1].options.searchMoves, [fullLine[0]])
  assert.deepEqual(review.moments[0].bestLine, pv)
  assert.deepEqual(review.moments[0].playedLine, pv)
  return review.moments[0]
}

test('review output keeps the full legal SAN variation including castles, underpromotions and mate', async () => {
  assert.equal(fullLine.length, 169)
  const moment = await reviewVariation(fullLine)
  assert.deepEqual(moment.bestLineSan, history)
  assert.deepEqual(moment.playedLineSan, history)
  assert(history.includes('O-O'))
  assert(history.includes('b8=B'))
  assert(history.includes('g8=B'))
  assert(history.includes('f8=Q+'))
  assert.equal(moment.bestLineSan.at(-1), 'Be5#')
})

for (const invalid of ['0000', '(none)', 'E2E4', 'e2e4q', 'e2e4 ', 'e2e5']) {
  test(`review SAN output stops at the legal prefix before ${JSON.stringify(invalid)}`, async () => {
    const moment = await reviewVariation([fullLine[0], fullLine[1], invalid, fullLine[2]])
    assert.deepEqual(moment.bestLineSan, history.slice(0, 2))
    assert.deepEqual(moment.playedLineSan, history.slice(0, 2))
  })
}

test('review output requires the exact promotion rather than silently accepting an omitted promotion', async () => {
  const index = fullLine.findIndex((uci) => uci.length === 5)
  assert(index > 0)
  const moment = await reviewVariation([...fullLine.slice(0, index), fullLine[index].slice(0, 4)])
  assert.deepEqual(moment.bestLineSan, history.slice(0, index))
  assert.deepEqual(moment.playedLineSan, history.slice(0, index))
})

test('review SAN output keeps the complete mate prefix and ignores an illegal continuation', async () => {
  const moment = await reviewVariation([...fullLine, 'e2e4'])
  assert.deepEqual(moment.bestLineSan, history)
  assert.deepEqual(moment.playedLineSan, history)
})