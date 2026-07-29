import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
})
const {
  analyzeCandidatesWithRetry,
  isExactVariantTrigger,
  pruneVariantEvents,
  requiresEveryLegalMove,
  resolveEvilMartinMode,
  variantUsesEvent,
} = await vite.ssrLoadModule('/src/hooks/useGameController.js')

test.after(async () => {
  await vite.close()
})

test('best and worst triggers require the exact calibrated move', () => {
  const candidates = [
    { uci: 'e2e4', rank: 1, score: 30 },
    { uci: 'd2d4', rank: 2, score: 28 },
    { uci: 'a2a3', rank: 3, score: -100 },
    { uci: 'h2h3', rank: 4, score: -100 },
  ]

  assert.equal(isExactVariantTrigger('opponent-best-move', 'e2e4', candidates), true)
  assert.equal(isExactVariantTrigger('opponent-best-move', 'd2d4', candidates), false)
  assert.equal(isExactVariantTrigger('opponent-worst-move', 'a2a3', candidates), true)
  assert.equal(isExactVariantTrigger('opponent-worst-move', 'h2h3', candidates), true)
  assert.equal(isExactVariantTrigger('opponent-worst-move', 'd2d4', candidates), false)
})

test('DrawFish, BlunderFish, and exhaustive ranked bots request every legal move', () => {
  const profile = (type, allLegalMoves = false) => ({
    variant: { movePolicy: { type, allLegalMoves } },
  })

  assert.equal(requiresEveryLegalMove(profile('target-evaluation')), true)
  assert.equal(requiresEveryLegalMove(profile('random-blunder')), true)
  assert.equal(requiresEveryLegalMove(profile('geometric-ranked', true)), true)
  assert.equal(requiresEveryLegalMove(profile('worst-move', true)), true)
  assert.equal(requiresEveryLegalMove(profile('best')), false)
})

test('exhaustive analysis covers every legal move and retries on another engine', async () => {
  const legalMoves = Array.from({ length: 17 }, (_, index) => ({
    from: `a${(index % 8) + 1}`,
    to: `${String.fromCharCode(98 + Math.floor(index / 8))}${(index % 8) + 1}`,
  }))
  const game = {
    fen: () => 'test-fen',
    moves: () => legalMoves,
  }
  const primary = {
    bestMoves: async () => {
      throw new Error('primary engine unavailable')
    },
  }
  const searched = []
  const retry = {
    bestMoves: async (_fen, policy) => {
      searched.push(...policy.searchMoves)
      return policy.searchMoves.map((uci, index) => ({
        uci,
        rank: index + 1,
        score: index,
      }))
    },
  }

  const candidates = await analyzeCandidatesWithRetry(
    primary,
    retry,
    game,
    { depth: 14, moveTime: 420, timeout: 2600 },
    true,
  )

  assert.equal(searched.length, legalMoves.length)
  assert.equal(new Set(searched).size, legalMoves.length)
  assert.equal(candidates.length, legalMoves.length)
})

test('failed engines reject instead of inventing a first-legal move', async () => {
  const failure = { bestMoves: async () => { throw new Error('engine unavailable') } }

  await assert.rejects(
    analyzeCandidatesWithRetry(
      failure,
      failure,
      { fen: () => 'test-fen' },
      { depth: 14, moveTime: 420 },
      false,
    ),
    /engine unavailable/,
  )
})

test('Evil Martin stays awake after the threshold has been crossed', () => {
  const profile = {
    variant: {
      movePolicy: {
        type: 'evil-martin',
        sleepyElo: 250,
        awakeElo: 3000,
        wakeThresholdCp: -600,
      },
    },
  }

  assert.deepEqual(
    resolveEvilMartinMode(profile, [{ score: -650 }], { evilAwake: false }),
    { awake: true, rating: 3000 },
  )
  assert.deepEqual(
    resolveEvilMartinMode(profile, [{ score: 400 }], { evilAwake: true }),
    { awake: true, rating: 3000 },
  )
})

test('undo reconstruction derives Evil Martin mode from retained markers', () => {
  const events = {
    evil: {
      botMoves: 2,
      botCaptureChecks: 0,
      botCaptures: 2,
      opponentChecks: 0,
      opponentBestMoves: 0,
      opponentWorstMoves: 0,
      currentElo: 3000,
      evilAwake: true,
      applied: [
        'mode:0:250:0',
        'botMoves:1',
        'botCaptures:2',
        'mode:4:3000:1',
        'botCaptures:4',
        'botMoves:5',
      ],
    },
  }

  const beforeWake = pruneVariantEvents(events, 2).evil
  assert.equal(beforeWake.currentElo, 250)
  assert.equal(beforeWake.evilAwake, false)
  assert.equal(beforeWake.botMoves, 1)
  assert.equal(beforeWake.botCaptures, 1)

  const afterWake = pruneVariantEvents(events, 4).evil
  assert.equal(afterWake.currentElo, 3000)
  assert.equal(afterWake.evilAwake, true)
  assert.equal(afterWake.botMoves, 1)
  assert.equal(afterWake.botCaptures, 2)
})

test('capture toggle tracks move phase and capture state independently', () => {
  const profile = {
    variant: {
      trigger: 'own-capture',
      movePolicy: { type: 'capture-toggle' },
    },
  }

  assert.equal(variantUsesEvent(profile, 'botMoves'), true)
  assert.equal(variantUsesEvent(profile, 'botCaptures'), true)
  assert.equal(variantUsesEvent(profile, 'botCaptureChecks'), false)
})
