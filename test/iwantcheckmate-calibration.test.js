import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { getIWantCheckmateProfile } from '../src/data/iwantcheckmateProfiles.js'
import {
  buildPairings,
  createCalibrationRow,
  createVariantEvents,
  deriveSeed,
  estimateEloWithInterval,
  finalizeCalibrationRow,
  nativeEngineElo,
  positionCommandForGame,
  playGame,
  recordCalibrationGame,
  recordOpponentMoveEvents,
  recordOwnMoveEvents,
  resolveProfileRating,
  seededRandom,
} from '../scripts/calibrateIWantCheckmateElo.mjs'

test('calibration uses native UCI Elo only inside Stockfish supported bounds', () => {
  assert.equal(nativeEngineElo(1319), undefined)
  assert.equal(nativeEngineElo(1320), 1320)
  assert.equal(nativeEngineElo(2400.4), 2400)
  assert.equal(nativeEngineElo(3190), 3190)
  assert.equal(nativeEngineElo(3191), undefined)
  assert.equal(nativeEngineElo(null), undefined)
})

test('calibration creates deterministic color-paired opening games', () => {
  const options = {
    games: 6,
    openings: [[], ['e4', 'e5'], ['d4', 'd5']],
    baseSeed: 77,
    profileId: 'iwc-smartin',
    anchorElo: 1600,
  }
  const first = buildPairings(options)
  const second = buildPairings(options)
  assert.deepEqual(first, second)
  assert.equal(first.length, 6)
  for (let index = 0; index < first.length; index += 2) {
    assert.deepEqual(first[index].opening, first[index + 1].opening)
    assert.equal(first[index].seed, first[index + 1].seed)
    assert.deepEqual(
      [first[index].profileColor, first[index + 1].profileColor],
      ['w', 'b'],
    )
  }
  assert.throws(
    () => buildPairings({ ...options, games: 3 }),
    /positive even number/,
  )
  assert.equal(
    deriveSeed(77, 'iwc-smartin', 1600, 0),
    deriveSeed(77, 'iwc-smartin', 1600, 0),
  )
  assert.notEqual(
    deriveSeed(77, 'iwc-smartin', 1600, 0),
    deriveSeed(77, 'iwc-smartin', 1600, 1),
  )
  assert.equal(seededRandom(123)(), seededRandom(123)())
})

test('calibration sends complete legal move history for repetition state', () => {
  const game = new Chess()
  for (const san of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) {
    game.move(san)
  }
  assert.equal(game.isThreefoldRepetition(), true)
  assert.equal(
    positionCommandForGame(game),
    'position startpos moves g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8',
  )
})

test('dynamic trigger events change the running profile rating', () => {
  const events = createVariantEvents()
  const checkProfile = getIWantCheckmateProfile('iwc-give-check')
  const bestProfile = getIWantCheckmateProfile('iwc-best-move')
  const bestMoveMartinProfile = getIWantCheckmateProfile('iwc-best-move-martin')
  const worstProfile = getIWantCheckmateProfile('iwc-worst-move')
  const hungryProfile = getIWantCheckmateProfile('iwc-hungry-martin')
  const captureToggleProfile = getIWantCheckmateProfile('iwc-capture-toggle')

  recordOpponentMoveEvents(
    events,
    { san: 'Qh4+' },
    'd8h4',
    [
      { uci: 'd8h4', rank: 1, score: 70 },
      { uci: 'a7a5', rank: 2, score: -220 },
    ],
  )
  assert.equal(events.opponentChecks, 1)
  assert.equal(events.opponentBestMoves, 1)
  assert.equal(events.opponentNonBestMoves, 0)
  assert.equal(resolveProfileRating(checkProfile, events), 3300)
  assert.equal(resolveProfileRating(bestProfile, events), 3500)

  recordOpponentMoveEvents(
    events,
    { san: 'a5' },
    'a7a5',
    [
      { uci: 'd7d5', rank: 1, score: 80 },
      { uci: 'a7a5', rank: 2, score: -220 },
    ],
  )
  assert.equal(events.opponentWorstMoves, 1)
  assert.equal(events.opponentNonBestMoves, 1)
  assert.equal(resolveProfileRating(worstProfile, events), 3100)
  assert.equal(resolveProfileRating(bestMoveMartinProfile, events), 450)

  recordOwnMoveEvents(events, { san: 'Bxh7+', captured: 'p' })
  assert.equal(events.botMoves, 1)
  assert.equal(events.botCaptureChecks, 1)
  assert.equal(resolveProfileRating(hungryProfile, events), 1250)
  assert.equal(events.botCaptures, 1)
  assert.equal(resolveProfileRating(captureToggleProfile, events), 250)

  recordOwnMoveEvents(events, { san: 'Nc3' })
  assert.equal(events.botCaptures, 1)
  assert.equal(resolveProfileRating(captureToggleProfile, events), 250)

  recordOwnMoveEvents(events, { san: 'Nxe4', captured: 'p' })
  assert.equal(events.botCaptures, 2)
  assert.equal(resolveProfileRating(captureToggleProfile, events), 3600)
})

test('a dynamic trigger changes the Elo used by the next move in an actual game', async () => {
  const profileCalls = []
  const engines = {
    profile: {
      newGame: async () => {},
      analyze: async (_position, options) => {
        profileCalls.push(options)
        return [{ uci: 'e8f7', score: 0, rank: 1 }]
      },
    },
    anchor: {
      newGame: async () => {},
      analyze: async () => [{ uci: 'c4f7', score: 0, rank: 1 }],
    },
    judge: {
      newGame: async () => {},
      analyze: async () => [],
    },
  }
  const result = await playGame({
    engines,
    profile: getIWantCheckmateProfile('iwc-give-check'),
    profileColor: 'b',
    requestedInitialElo: 1620,
    anchorElo: 1600,
    opening: ['e4', 'e5', 'Bc4', 'Nc6'],
    nodes: 200,
    judgeNodes: 200,
    maxPlies: 6,
    seed: 9,
  })

  assert.equal(result.status, 'unfinished')
  assert.equal(result.events.opponentChecks, 1)
  assert.equal(result.startingElo, 1620)
  assert.equal(result.endingElo, 1320)
  assert.equal(profileCalls.length, 1)
  assert.equal(profileCalls[0].elo, 1320)
  assert.equal(result.ratingHistory[0].elo, 1320)
})

test('fixed-rating calibration measures one Elo without applying a video trigger', async () => {
  const profileCalls = []
  const engines = {
    profile: {
      newGame: async () => {},
      analyze: async (_position, options) => {
        profileCalls.push(options)
        return [{ uci: 'e2e4', score: 0, rank: 1 }]
      },
    },
    anchor: {
      newGame: async () => {},
      analyze: async () => [{ uci: 'e7e5', score: 0, rank: 1 }],
    },
    judge: {
      newGame: async () => {},
      analyze: async () => [],
    },
  }
  const result = await playGame({
    engines,
    profile: getIWantCheckmateProfile('iwc-smartin'),
    profileColor: 'w',
    requestedInitialElo: 2200,
    anchorElo: 2200,
    opening: [],
    nodes: 200,
    judgeNodes: 200,
    maxPlies: 2,
    seed: 19,
    freezeRating: true,
  })

  assert.equal(result.status, 'unfinished')
  assert.equal(result.events.botMoves, 1)
  assert.equal(result.startingElo, 2200)
  assert.equal(result.endingElo, 2200)
  assert.equal(result.ratingHistory[0].elo, 2200)
  assert.equal(profileCalls[0].elo, 2200)
})

test('sub-1320 games request full candidates for the app weak-move selector', async () => {
  const profileCalls = []
  const engines = {
    profile: {
      newGame: async () => {},
      analyze: async (_position, options) => {
        profileCalls.push(options)
        return [
          { uci: 'e2e4', score: 100, rank: 1 },
          { uci: 'd2d4', score: 80, rank: 2 },
          { uci: 'g1f3', score: 40, rank: 3 },
          { uci: 'a2a3', score: -200, rank: 4 },
        ]
      },
    },
    anchor: {
      newGame: async () => {},
      analyze: async () => [{ uci: 'e7e5', score: 0, rank: 1 }],
    },
    judge: {
      newGame: async () => {},
      analyze: async () => [],
    },
  }
  const result = await playGame({
    engines,
    profile: getIWantCheckmateProfile('iwc-smartin'),
    profileColor: 'w',
    requestedInitialElo: 250,
    anchorElo: 1600,
    opening: [],
    nodes: 200,
    judgeNodes: 200,
    maxPlies: 2,
    seed: 17,
  })

  assert.equal(result.status, 'unfinished')
  assert.equal(profileCalls.length, 1)
  assert.equal(profileCalls[0].elo, undefined)
  assert.equal(profileCalls[0].count, 16)
  assert.equal(result.ratingHistory[0].elo, 250)
})

test('an engine exception is a failed game, never a draw', async () => {
  const engines = {
    profile: {
      newGame: async () => {},
      analyze: async () => {
        const error = new Error('search timed out')
        error.code = 'engine-timeout'
        throw error
      },
    },
    anchor: {
      newGame: async () => {},
      analyze: async () => [{ uci: 'e7e5', score: 0, rank: 1 }],
    },
    judge: {
      newGame: async () => {},
      analyze: async () => [],
    },
  }
  const result = await playGame({
    engines,
    profile: getIWantCheckmateProfile('iwc-smartin'),
    profileColor: 'w',
    requestedInitialElo: 250,
    anchorElo: 1600,
    opening: [],
    nodes: 200,
    judgeNodes: 200,
    maxPlies: 2,
    seed: 11,
  })

  assert.equal(result.status, 'failed')
  assert.equal(result.score, null)
  assert.equal(result.result, '*')
  assert.equal(result.reason, 'engine-timeout')
})

test('failed and unfinished games never count as draws or Elo evidence', () => {
  const row = createCalibrationRow(1600)
  recordCalibrationGame(row, { status: 'completed', score: 1 })
  recordCalibrationGame(row, { status: 'completed', score: 0.5 })
  recordCalibrationGame(row, { status: 'completed', score: 0 })
  recordCalibrationGame(row, { status: 'unfinished', score: null })
  recordCalibrationGame(row, { status: 'failed', score: null })
  finalizeCalibrationRow(row)

  assert.deepEqual(
    {
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      completed: row.completedGames,
      unfinished: row.unfinishedGames,
      failed: row.failedGames,
    },
    {
      wins: 1,
      draws: 1,
      losses: 1,
      completed: 3,
      unfinished: 1,
      failed: 1,
    },
  )
  assert.equal(row.scoreRate, 0.5)
  assert.ok(row.scoreConfidenceInterval95.lower < 0.5)
  assert.ok(row.scoreConfidenceInterval95.upper > 0.5)

  const estimate = estimateEloWithInterval([row])
  assert.equal(estimate.rating, 1600)
  assert.equal(estimate.completedGames, 3)
  assert.equal(estimate.unfinishedGames, 1)
  assert.equal(estimate.failedGames, 1)
  assert.ok(estimate.lower95 < estimate.rating)
  assert.ok(estimate.upper95 > estimate.rating)
})
