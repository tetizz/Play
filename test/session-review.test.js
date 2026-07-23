import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { Chess } from 'chess.js'
import {
  applyNextPremove,
  applyPremove,
  gameFromHistory,
  isAutomaticGameOver,
  loadSession,
  saveSession,
  shouldResumeBotTurn,
} from '../src/lib/gameSession.js'
import { buildSmoothPath, evaluationBarDisplay } from '../src/lib/evaluationGraph.js'
import { buildGamePgn, pgnFilename } from '../src/lib/pgnExport.js'
import {
  aggregateAccuracy,
  buildFallbackFinalReview,
  evaluationToWhitePercent,
  reviewPolicyForLength,
  reviewGameWithStockfish,
} from '../src/lib/reviewEngine.js'

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

test('review PGN export preserves player colors, headers, moves, and result', () => {
  const pgn = buildGamePgn({
    history: ['f4', 'e5', 'g4', 'Qh4#'],
    result: 'Black wins by checkmate',
    gameMode: 'player',
    humanColor: 'white',
    player: { name: 'player' },
    profile: { name: 'Mubassar' },
    date: new Date(2026, 5, 14),
  })

  assert.match(pgn, /\[Date "2026\.06\.14"\]/)
  assert.match(pgn, /\[White "player"\]/)
  assert.match(pgn, /\[Black "Mubassar"\]/)
  assert.match(pgn, /\[Result "0-1"\]/)
  assert.match(pgn, /1\. f4 e5 2\. g4 Qh4# 0-1/)
  assert.equal(pgnFilename({
    gameMode: 'player',
    humanColor: 'black',
    profile: { name: 'Ayden' },
  }), 'ayden-vs-player.pgn')
})

test('review PGN export resolves player and bot names to the correct result color', () => {
  const playerWin = buildGamePgn({
    history: ['e4', 'e5'],
    result: 'player wins by resignation',
    gameMode: 'player',
    humanColor: 'white',
    player: { name: 'player' },
    profile: { name: 'Mubassar' },
    date: new Date(2026, 5, 14),
  })
  assert.match(playerWin, /\[Result "1-0"\]/)
  assert.match(playerWin, /1\. e4 e5 1-0/)

  const botWin = buildGamePgn({
    history: ['e4', 'e5'],
    result: 'Akshit Sharma wins by resignation',
    gameMode: 'bots',
    whiteProfile: { name: 'Trixize' },
    blackProfile: { name: 'Akshit Sharma' },
    date: new Date(2026, 5, 14),
  })
  assert.match(botWin, /\[Result "0-1"\]/)
  assert.match(botWin, /1\. e4 e5 0-1/)
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

test('the next pending premove settles once and preserves its queue tail', () => {
  const valid = applyNextPremove(
    ['e4', 'e5'],
    [
      { from: 'g1', to: 'f3' },
      { from: 'f3', to: 'g5' },
    ],
  )
  assert.equal(valid.applied, true)
  assert.equal(valid.move.san, 'Nf3')
  assert.deepEqual(valid.remaining, [{ from: 'f3', to: 'g5' }])

  const invalid = applyNextPremove(
    ['e4'],
    [{ from: 'e7', to: 'e4' }],
  )
  assert.equal(invalid.applied, false)
  assert.deepEqual(invalid.remaining, [])
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

test('the fifty-move draw is claimable while the seventy-five-move draw is automatic', () => {
  const claimable = new Chess('6k1/7r/8/8/8/8/R7/1K6 w - - 100 51')
  const automatic = new Chess('6k1/7r/8/8/8/8/R7/1K6 w - - 150 76')
  assert.equal(claimable.isDrawByFiftyMoves(), true)
  assert.equal(isAutomaticGameOver(claimable), false)
  assert.equal(isAutomaticGameOver(automatic), true)
})

test('Fools Mate produces a complete navigable review', async () => {
  const history = ['f4', 'e5', 'g4', 'Qh4#']
  const fakeClient = {
    async analyze(fen, options) {
      const game = new Chess(fen)
      const legalMoves = game.moves({ verbose: true })
      const requested = options.searchMoves?.length
        ? legalMoves.filter((move) =>
            options.searchMoves.includes(`${move.from}${move.to}${move.promotion || ''}`),
          )
        : legalMoves
      return requested.slice(0, options.count || 4).map((move, index) => ({
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

test('long reviews use the bounded fast path without redundant exact searches', async () => {
  const source = new Chess()
  source.loadPgn(fs.readFileSync(
    new URL('./fixtures/trixize-mubassar-reference.pgn', import.meta.url),
    'utf8',
  ))
  const history = source.history()
  const fenToSan = new Map()
  const replay = new Chess()
  history.forEach((san) => {
    fenToSan.set(replay.fen(), san)
    replay.move(san)
  })
  const calls = []
  const policy = reviewPolicyForLength(history.length)
  const fakeClient = {
    async analyze(fen, options = {}) {
      calls.push({
        depth: options.depth,
        moveTime: options.moveTime || null,
        searchMoves: options.searchMoves || [],
      })
      const game = new Chess(fen)
      const playedSan = fenToSan.get(fen)
      const legalMoves = game.moves({ verbose: true })
      const played = legalMoves.find((move) => move.san === playedSan) || legalMoves[0]
      const uci = `${played.from}${played.to}${played.promotion || ''}`
      return [{
        uci,
        score: 20,
        mate: played.san.includes('#') ? 1 : null,
        rank: 1,
        pv: [uci],
      }]
    },
  }

  const review = await reviewGameWithStockfish({
    history,
    client: fakeClient,
    playedClient: fakeClient,
  })

  assert.equal(review.complete, true)
  assert.equal(review.moments.length, history.length)
  const deepCalls = calls.filter((call) => call.depth === policy.tacticalOptions.depth)
  assert.ok(calls.length <= history.length + policy.maxDeepPasses)
  assert.ok(deepCalls.length <= policy.maxDeepPasses)
  assert.equal(calls.some((call) => call.searchMoves.length), false)
  assert.equal(calls.every((call) =>
    call.depth === policy.reviewOptions.depth ||
    call.depth === policy.tacticalOptions.depth,
  ), true)
  assert.ok(policy.reviewOptions.depth < 22)
  assert.ok(policy.reviewOptions.moveTime <= 220)
})

test('book and best moves always score 100 percent accuracy', async () => {
  const fakeClient = {
    async analyze(fen, options = {}) {
      const game = new Chess(fen)
      const legalMoves = game.moves({ verbose: true })
      const move = options.searchMoves?.length
        ? legalMoves.find((candidate) =>
            options.searchMoves.includes(`${candidate.from}${candidate.to}${candidate.promotion || ''}`),
          )
        : legalMoves.find((candidate) => candidate.san === 'Nf3') || legalMoves[0]
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

test('game accuracy uses surrounding position volatility to preserve serious errors', () => {
  const perfectMoves = Array.from({ length: 9 }, (_, index) => ({
    side: index % 2 === 0 ? 'w' : 'b',
    accuracy: 100,
    scoreBefore: 20,
    scoreAfter: 20,
    mateBefore: null,
    mateAfter: null,
  }))
  const blunder = {
    side: 'w',
    accuracy: 30,
    scoreBefore: 250,
    scoreAfter: -250,
    mateBefore: null,
    mateAfter: null,
  }

  assert.equal(aggregateAccuracy([...perfectMoves, blunder], 'w'), 57)
})

test('game accuracy remains perfect when every reviewed move is perfect', () => {
  assert.equal(aggregateAccuracy([
    { side: 'w', accuracy: 100, scoreBefore: 0, scoreAfter: 10 },
    { side: 'b', accuracy: 100, scoreBefore: 10, scoreAfter: 30 },
  ], 'w'), 100)
  assert.equal(aggregateAccuracy([]), null)
})

test('review scores the played move from the same pre-move position', async () => {
  const calls = []
  const fakeClient = {
    async analyze(fen, options = {}) {
      calls.push({ fen, searchMoves: options.searchMoves || [] })
      const game = new Chess(fen)
      const legalMoves = game.moves({ verbose: true })
      if (options.searchMoves?.length) {
        const move = legalMoves.find((candidate) =>
          options.searchMoves.includes(`${candidate.from}${candidate.to}${candidate.promotion || ''}`),
        )
        return move ? [{
          uci: `${move.from}${move.to}${move.promotion || ''}`,
          score: -180,
          mate: null,
          rank: 1,
          pv: [`${move.from}${move.to}${move.promotion || ''}`],
        }] : []
      }
      const best = legalMoves.find((candidate) => candidate.san === 'e4')
      return [{
        uci: `${best.from}${best.to}`,
        score: 40,
        mate: null,
        rank: 1,
        pv: [`${best.from}${best.to}`],
      }]
    },
  }

  const review = await reviewGameWithStockfish({
    history: ['f3'],
    client: fakeClient,
    playedClient: fakeClient,
  })

  const unrestricted = calls.find((call) => call.searchMoves.length === 0)
  const restricted = calls.find((call) => call.searchMoves[0] === 'f2f3')
  assert.equal(unrestricted.fen, restricted.fen)
  assert.equal(review.moments[0].key, 'mistake')
  assert.equal(review.moments[0].accuracy, 2.8)
  assert.equal(review.accuracy.white, 2.8)
})

test('a quiet non-best move receives the deeper review pass', async () => {
  const calls = []
  const fakeClient = {
    async analyze(fen, options = {}) {
      calls.push({ depth: options.depth, searchMoves: options.searchMoves || [] })
      const game = new Chess(fen)
      const legalMoves = game.moves({ verbose: true })
      const requestedUci = options.searchMoves?.[0]
      const requested = requestedUci
        ? legalMoves.find((move) =>
            `${move.from}${move.to}${move.promotion || ''}` === requestedUci,
          )
        : null
      const played = legalMoves.find((move) => move.san === 'Nf3') || requested || legalMoves[0]
      const best = legalMoves.find((move) => move.san === 'e4') || legalMoves[0]
      const isDeep = options.depth >= 22
      if (options.searchMoves?.length) {
        return [{
          uci: requestedUci,
          score: isDeep ? -260 : 10,
          mate: null,
          rank: 1,
          pv: [requestedUci],
        }]
      }
      return [
        {
          uci: `${best.from}${best.to}`,
          score: isDeep ? 80 : 20,
          mate: null,
          rank: 1,
          pv: [`${best.from}${best.to}`],
        },
        {
          uci: `${played.from}${played.to}`,
          score: isDeep ? -260 : 10,
          mate: null,
          rank: 2,
          pv: [`${played.from}${played.to}`],
        },
      ]
    },
  }

  const review = await reviewGameWithStockfish({
    history: ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8', 'e4'],
    client: fakeClient,
    playedClient: fakeClient,
  })

  assert.ok(calls.some((call) => call.depth >= 22 && call.searchMoves.length === 0))
  assert.ok(calls.some((call) => call.depth >= 22 && call.searchMoves[0] === 'g1f3'))
  assert.ok(['mistake', 'blunder'].includes(review.moments[0].key))
  assert.ok(review.accuracy.white < 70)
})

test('a restricted result cannot become a fake Best move when unrestricted analysis fails', async () => {
  const client = {
    async analyze(fen, options = {}) {
      if (!options.searchMoves?.length) return []
      return [{
        uci: options.searchMoves[0],
        score: 25,
        mate: null,
        rank: 1,
        pv: [options.searchMoves[0]],
      }]
    },
  }

  const review = await reviewGameWithStockfish({
    history: ['e4'],
    client,
  })

  assert.equal(review.moments[0].key, 'unreviewed')
  assert.equal(review.moments[0].bestMove, null)
  assert.equal(review.moments[0].accuracy, null)
  assert.equal(review.accuracy.white, null)
  assert.match(review.moments[0].explanation, /could not be classified/i)
  assert.equal(review.graph[0].percent, 50)
})

test('unreviewed engine timeouts remain visible in per-side classification totals', async () => {
  const client = {
    async analyze() {
      throw new DOMException('Review timed out', 'TimeoutError')
    },
  }
  const review = await reviewGameWithStockfish({
    history: ['e4', 'e5'],
    client,
  })

  const unreviewed = review.counts.find((item) => item.key === 'unreviewed')
  assert.equal(unreviewed.white, 1)
  assert.equal(unreviewed.black, 1)
  assert.equal(review.counts.reduce((sum, item) => sum + item.white, 0), 1)
  assert.equal(review.counts.reduce((sum, item) => sum + item.black, 0), 1)
  assert.equal(review.accuracy.white, null)
  assert.equal(review.accuracy.black, null)
})

test('cancelling during analysis stops retry work and rejects the review', async () => {
  const controller = new AbortController()
  let calls = 0
  const client = {
    async analyze() {
      calls += 1
      controller.abort()
      return []
    },
  }

  await assert.rejects(
    reviewGameWithStockfish({
      history: ['e4'],
      client,
      signal: controller.signal,
    }),
    (error) => error?.name === 'AbortError',
  )
  assert.equal(calls, 1)
})

test('review result overrides preserve resignation and manual match endings', async () => {
  const client = { async analyze() { return [] } }
  const resigned = await reviewGameWithStockfish({
    history: ['e4'],
    client,
    resultOverride: 'Black wins by resignation',
  })
  assert.equal(resigned.result, 'Black wins by resignation')
  assert.equal(resigned.graph.at(-1).percent, 0)

  const ended = buildFallbackFinalReview([], 'Match ended')
  assert.equal(ended.result, 'Match ended')
})

test('a manually finished review remains a review after session restoration', () => {
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = {
    getItem() {
      return JSON.stringify({
        phase: 'review',
        history: [],
        reviewResult: 'Black wins by resignation',
      })
    },
  }
  try {
    const restored = loadSession()
    assert.equal(restored.phase, 'review')
    assert.equal(restored.reviewResult, 'Black wins by resignation')
  } finally {
    if (previousLocalStorage) globalThis.localStorage = previousLocalStorage
    else delete globalThis.localStorage
  }
})

test('session persistence failures do not crash gameplay', () => {
  const previousLocalStorage = globalThis.localStorage
  globalThis.localStorage = {
    setItem() {
      throw new DOMException('Storage disabled', 'SecurityError')
    },
  }
  try {
    assert.equal(saveSession({ phase: 'game', history: ['e4'] }), false)
  } finally {
    if (previousLocalStorage) globalThis.localStorage = previousLocalStorage
    else delete globalThis.localStorage
  }
})
