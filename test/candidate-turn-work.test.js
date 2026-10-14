import assert from 'node:assert/strict'
import test from 'node:test'
import { Chess } from 'chess.js'
import { createServer } from 'vite'
import { requestCandidateMoves, requestCandidateScore } from '../src/lib/candidateAnalysis.js'

const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false } })
const { verifyObjectiveCandidates } = await vite.ssrLoadModule('/src/hooks/useGameController.js')
test.after(() => vite.close())

for (const [name, request, method] of [
  ['opponent/mate/objective move request', requestCandidateMoves, 'bestMoves'],
  ['opponent reply evaluation', requestCandidateScore, 'evaluateFen'],
]) {
  test(`${name} stops a stalled transport at the shared absolute deadline`, async () => {
    let stopped = 0, calls = 0
    const client = { [method]: () => { calls++; return new Promise(() => {}) }, cancelAll: () => { stopped++ } }
    await assert.rejects(request(client, new Chess().fen(), { depth: 14, moveTime: 420, timeout: 5000 }, { deadlineMs: Date.now() + 200 }), { code: 'deadline' })
    assert.equal(calls, 1); assert.equal(stopped, 1)
  })
  test(`${name} keeps requested strength and result when budget remains`, async () => {
    const expected = method === 'bestMoves' ? [{ uci: 'e2e4', score: 40 }] : 40
    let policy
    const client = { [method]: async (_fen, options) => { policy = options; return expected } }
    assert.deepEqual(await request(client, new Chess().fen(), { depth: 22, moveTime: 3200, timeout: 4500 }, { deadlineMs: Date.now() + 10000 }), expected)
    assert.deepEqual(policy, { depth: 22, moveTime: 3200, timeout: 4500 })
  })
}

test('actual objective verification stops later work and cleans up a stalled proof', async () => {
  let calls = 0, stopped = 0
  const client = { bestMoves: () => { calls++; return new Promise(() => {}) }, cancelAll: () => { stopped++ } }
  await assert.rejects(verifyObjectiveCandidates(new Chess(), [{ uci: 'e2e4', score: 900 }, { uci: 'd2d4', score: 900 }], client, { depth: 22, moveTime: 3200 }, { deadlineMs: Date.now() + 200 }), { code: 'deadline' })
  assert.equal(calls, 1); assert.equal(stopped, 1)
})

test('actual objective verification retains every candidate and proof score within budget', async () => {
  const requests = []
  const client = { bestMoves: async (fen, policy) => { requests.push({ fen, policy }); return [{ score: -900 }] } }
  const candidates = [{ uci: 'e2e4', score: 850 }, { uci: 'd2d4', score: 800 }]
  const result = await verifyObjectiveCandidates(new Chess(), candidates, client, { depth: 22, moveTime: 3200 }, { deadlineMs: Date.now() + 10000 })
  assert.deepEqual(result, candidates.map(candidate => ({ ...candidate, objectiveVerified: true, objectiveVerificationScore: 900 })))
  assert.equal(requests.length, 2)
  for (const { policy } of requests) { assert.equal(policy.depth, 22); assert.equal(policy.moveTime, 3200); assert.equal(policy.count, 1) }
})

test('aborting an active reply evaluation cleans up once and rejects cancelled work', async () => {
  const controller = new AbortController(); let stopped = 0
  const pending = requestCandidateScore({ evaluateFen: () => new Promise(() => {}), cancelAll: () => { stopped++ } }, new Chess().fen(), {}, { deadlineMs: Date.now() + 10000, signal: controller.signal })
  await Promise.resolve(); controller.abort()
  await assert.rejects(pending, { code: 'cancelled' }); assert.equal(stopped, 1)
})
