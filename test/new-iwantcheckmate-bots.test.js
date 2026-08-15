import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { createServer } from 'vite'
import {
  IWANTCHECKMATE_VIDEO_PROFILES,
  getIWantCheckmateProfile,
} from '../src/data/iwantcheckmateProfiles.js'
import {
  runningVariantElo,
  selectIWantCheckmateCandidate,
  variantEngineElo,
} from '../src/lib/iwantcheckmateVariants.js'
import { normalizeVariantEvents } from '../src/lib/gameSession.js'

const vite = await createServer({
  appType: 'custom',
  server: { middlewareMode: true },
})
const {
  pruneVariantEvents,
  variantUsesEvent,
} = await vite.ssrLoadModule('/src/hooks/useGameController.js')

test.after(async () => {
  await vite.close()
})

test('the latest public roster adds six variants and never adds Tony', () => {
  const expected = [
    ['iwc-clockfish', 'ClockFish', '0rlkE-CYRoc'],
    ['iwc-mirrorfish', 'MirrorFish', 'eCC-U9w9RvQ'],
    ['iwc-zebrafish', 'ZebraFish', 'oJu13RUrGl4'],
    ['iwc-simpfish', 'SimpFish', 'My1sUnkiNfU'],
    ['iwc-checkfish', 'CheckFish', 'tNgzqWiYDFk'],
    ['iwc-scaredfish', 'ScaredFish', null],
  ]

  for (const [id, name, videoId] of expected) {
    const profile = getIWantCheckmateProfile(id)
    assert.equal(profile.name, name)
    assert.equal(profile.source.videoId, videoId)
  }
  for (const profile of IWANTCHECKMATE_VIDEO_PROFILES) {
    assert.equal(`${profile.id} ${profile.name}`.toLowerCase().includes('tony'), false)
  }
})

test('ClockFish uses its persisted time-ramp rating as real engine strength', () => {
  const profile = getIWantCheckmateProfile('iwc-clockfish')
  const candidates = Array.from({ length: 18 }, (_, index) => ({
    uci: `move-${index + 1}`,
    score: 500 - index * 80,
    rank: index + 1,
    move: { piece: index % 3 === 0 ? 'p' : 'n' },
  }))

  assert.equal(runningVariantElo(profile, { currentElo: 2100 }), 2100)
  assert.equal(variantEngineElo(profile, { currentElo: 2100 }), 2100)
  assert.ok(selectIWantCheckmateCandidate(
    profile,
    candidates,
    () => 0.99,
    { rating: 100, events: { botMoves: 8 } },
  ).rank > 1)
  assert.equal(selectIWantCheckmateCandidate(
    profile,
    candidates,
    () => 0.99,
    { rating: 3600, events: { botMoves: 8 } },
  ).rank, 1)
})

test('MirrorFish matches the engine rank of the opponent move', () => {
  const profile = getIWantCheckmateProfile('iwc-mirrorfish')
  const candidates = [1, 2, 3, 4].map((rank) => ({
    uci: `move-${rank}`,
    score: 100 - rank,
    rank,
  }))
  const selected = selectIWantCheckmateCandidate(profile, candidates, Math.random, {
    events: { lastOpponentMoveRank: 3 },
  })
  assert.equal(selected.rank, 3)
})

test('ZebraFish alternates light and dark destination squares', () => {
  const profile = getIWantCheckmateProfile('iwc-zebrafish')
  const candidates = [
    { uci: 'a2a4', score: 80, rank: 1, move: { from: 'a2', to: 'a4', piece: 'p' } },
    { uci: 'a2a3', score: 70, rank: 2, move: { from: 'a2', to: 'a3', piece: 'p' } },
  ]
  assert.equal(selectIWantCheckmateCandidate(
    profile,
    candidates,
    Math.random,
    { events: { botMoves: 0 } },
  ).uci, 'a2a4')
  assert.equal(selectIWantCheckmateCandidate(
    profile,
    candidates,
    Math.random,
    { events: { botMoves: 1 } },
  ).uci, 'a2a3')
  assert.equal(variantUsesEvent(profile, 'botMoves'), true)
})

test('CheckFish must give check whenever a legal checking move exists', () => {
  const profile = getIWantCheckmateProfile('iwc-checkfish')
  const candidates = [
    { uci: 'd1d4', score: 200, rank: 1, move: { from: 'd1', to: 'd4', san: 'Qd4' } },
    { uci: 'd1d8', score: 50, rank: 2, move: { from: 'd1', to: 'd8', san: 'Qd8+' } },
  ]
  assert.equal(selectIWantCheckmateCandidate(profile, candidates).uci, 'd1d8')
})

test('SimpFish takes an available queen before following ordinary engine rank', () => {
  const profile = getIWantCheckmateProfile('iwc-simpfish')
  const game = new Chess('7k/8/8/8/8/8/3Q4/3r3K b - - 0 1')
  const candidates = [
    { uci: 'd1a1', score: 500, rank: 1, move: game.moves({ verbose: true }).find((move) => move.lan === 'd1a1') },
    { uci: 'd1d2', score: 300, rank: 2, move: game.moves({ verbose: true }).find((move) => move.lan === 'd1d2') },
  ]
  assert.equal(candidates[1].move.captured, 'q')
  assert.equal(selectIWantCheckmateCandidate(
    profile,
    candidates,
    Math.random,
    { game },
  ).uci, 'd1d2')
})

test('ScaredFish values an enemy pawn like a queen', () => {
  const profile = getIWantCheckmateProfile('iwc-scaredfish')
  const game = new Chess('7k/8/8/8/8/3p4/4P3/7K w - - 0 1')
  const legal = game.moves({ verbose: true })
  const candidates = [
    { uci: 'h1g1', score: 300, rank: 1, move: legal.find((move) => move.lan === 'h1g1') },
    { uci: 'e2d3', score: 100, rank: 2, move: legal.find((move) => move.lan === 'e2d3') },
  ]
  assert.equal(candidates[1].move.captured, 'p')
  assert.equal(selectIWantCheckmateCandidate(
    profile,
    candidates,
    Math.random,
    { game },
  ).uci, 'e2d3')
})

test('MirrorFish and ClockFish state survives reload and undo reconstruction', () => {
  const normalized = normalizeVariantEvents({
    mirror: {
      lastOpponentMoveRank: 4,
      clockStartedAt: 1234,
      currentElo: 900,
      applied: ['clock:0:100:1234', 'opponentRank:1:4', 'clock:2:900:1234'],
    },
  })
  assert.equal(normalized.mirror.lastOpponentMoveRank, 4)
  assert.equal(normalized.mirror.clockStartedAt, 1234)

  const rewound = pruneVariantEvents(normalized, 1)
  assert.equal(rewound.mirror.lastOpponentMoveRank, 4)
  assert.equal(rewound.mirror.currentElo, 100)
  assert.equal(rewound.mirror.clockStartedAt, 1234)
})
