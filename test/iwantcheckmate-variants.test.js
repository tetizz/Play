import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import {
  IWANTCHECKMATE_VIDEO_PROFILES,
  getIWantCheckmateProfile,
} from '../src/data/iwantcheckmateProfiles.js'
import {
  dialogueAfterBotMove,
  dialogueForBotBattle,
  dialogueForGameEnd,
  initialDialogue,
} from '../src/data/dialogue.js'
import {
  guaranteedMateInOneCandidates,
  initialVariantElo,
  resolveIWantCheckmateAvatar,
  runningVariantElo,
  selectIWantCheckmateCandidate,
  variantEngineElo,
  variantEventField,
} from '../src/lib/iwantcheckmateVariants.js'

const EXPECTED_NAMES = [
  'PityFish',
  'PanicFish',
  'TiltFish',
  'Smartin',
  'Martin',
  'TiredFish',
  'BlunderFish',
  'GeometricFish',
  'RandomFish',
  'DrawFish',
  'BetaFish',
  'HungryMartin',
  'Stockfish',
  'WorstFish',
  'Martinfish',
  'Martinfish 2.0',
  'Martinfish 3.0',
  'Random Martinfish',
  'Martinfish 80/20',
  'Martinfish 95/5',
  'Evil Martin',
  'Evil Martin 2.0',
]

function sequenceRandom(values) {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}

function scoredCandidates(count = 18) {
  return Array.from({ length: count }, (_, index) => ({
    uci: `a${index + 1}`,
    score: 400 - index * 50,
    rank: index + 1,
    move: { piece: index % 4 === 0 ? 'p' : 'n' },
  }))
}

test('IWantCheckmate exposes distinct talking profiles from the source videos', () => {
  assert.equal(IWANTCHECKMATE_VIDEO_PROFILES.length, EXPECTED_NAMES.length)
  assert.deepEqual(
    IWANTCHECKMATE_VIDEO_PROFILES.map((profile) => profile.name),
    EXPECTED_NAMES,
  )
  for (const profile of IWANTCHECKMATE_VIDEO_PROFILES) {
    assert.equal(profile.dialoguePolicy, 'iwantcheckmate')
    assert.equal(profile.capabilities.silentDialogue, false)
    assert.match(profile.source.videoUrl, /^https:\/\/www\.youtube\.com\/watch\?v=/)
    assert.match(profile.avatar.src, /^\.\/assets\/iwantcheckmate\/.+-profile\.(?:png|jpeg|svg)$/)
    assert.ok(profile.intro.length > 20)
    assert.equal(profile.intro, profile.videoLabel)
  }
  assert.equal(getIWantCheckmateProfile('iwc-smartin').name, 'Smartin')
  assert.equal(getIWantCheckmateProfile('martinfish').id, 'iwc-smartin')
  assert.equal(getIWantCheckmateProfile('iwc-worstfish').countryCode, '')
  assert.equal(getIWantCheckmateProfile('iwc-exploding-martin'), null)
  assert.equal(getIWantCheckmateProfile('geometricfish').displayRating, 3600)
  for (const profile of IWANTCHECKMATE_VIDEO_PROFILES.filter(
    (candidate) => candidate.category === 'martin',
  )) {
    assert.equal(profile.strengthPolicy.mateSafety.depth, 20, profile.name)
  }
})

test('GeometricFish follows the source geometric rank distribution boundaries', () => {
  const candidates = Array.from({ length: 6 }, (_, index) => ({
    uci: `move-${index + 1}`,
    score: 100 - index,
    rank: index + 1,
  }))
  const profile = getIWantCheckmateProfile('geometricfish')

  assert.equal(selectIWantCheckmateCandidate(profile, candidates, () => 0).rank, 1)
  assert.equal(selectIWantCheckmateCandidate(profile, candidates, () => 0.499999).rank, 1)
  assert.equal(selectIWantCheckmateCandidate(profile, candidates, () => 0.5).rank, 2)
  assert.equal(selectIWantCheckmateCandidate(profile, candidates, () => 0.75).rank, 3)
  assert.equal(selectIWantCheckmateCandidate(profile, candidates, () => 0.875).rank, 4)
  assert.equal(selectIWantCheckmateCandidate(profile, candidates, () => 0.999999).rank, 6)
})

test('every IWantCheckmate bot keeps its copy dormant at runtime', () => {
  for (const profile of IWANTCHECKMATE_VIDEO_PROFILES) {
    assert.equal(initialDialogue(profile), '')
    assert.equal(dialogueAfterBotMove(profile, {
      move: { piece: 'n', san: 'Nf3' },
      variantElo: profile.variant.initialElo,
      variantEloDelta: 0,
    }), '')
    assert.equal(dialogueForGameEnd(profile, 'Bot wins by checkmate'), '')
  }
})

test('dynamic video-bot rating changes do not trigger visible dialogue', () => {
  const pityFish = getIWantCheckmateProfile('iwc-worst-move')
  const smartin = getIWantCheckmateProfile('iwc-smartin')

  assert.equal(dialogueAfterBotMove(pityFish, {
    variantElo: 3100,
    variantEloDelta: -500,
  }), '')
  assert.equal(dialogueAfterBotMove(smartin, {
    variantElo: 350,
    variantEloDelta: 100,
  }), '')
  assert.equal(dialogueForBotBattle(
    smartin,
    {
      variantElo: 450,
      variantEloDelta: 100,
    },
      pityFish,
    ), '')

  const rivalryLine = dialogueForBotBattle(
    pityFish,
    {
      variantElo: 3600,
      variantEloDelta: 0,
      isCheck: false,
      isCheckmate: false,
      isFreePiece: false,
      opponentBlunder: false,
      capturedValue: 0,
      isWinning: false,
    },
    smartin,
  )
  assert.equal(rivalryLine, '')
  assert.doesNotMatch(rivalryLine, /\{opponent\}/)
})

test('running Elo follows only the source-video trigger', () => {
  const worst = getIWantCheckmateProfile('iwc-worst-move')
  const check = getIWantCheckmateProfile('iwc-give-check')
  const best = getIWantCheckmateProfile('iwc-best-move')
  const smartin = getIWantCheckmateProfile('iwc-smartin')
  const bestMoveMartin = getIWantCheckmateProfile('iwc-best-move-martin')
  const decay = getIWantCheckmateProfile('iwc-elo-decay')
  const hungry = getIWantCheckmateProfile('iwc-hungry-martin')
  const captureToggle = getIWantCheckmateProfile('iwc-capture-toggle')

  assert.equal(initialVariantElo(worst), 3600)
  assert.equal(initialVariantElo(getIWantCheckmateProfile('iwc-random-top-three')), 3600)
  assert.equal(initialVariantElo(getIWantCheckmateProfile('iwc-zero-evaluation')), 3600)
  assert.equal(runningVariantElo(worst, { opponentWorstMoves: 2 }), 2600)
  assert.equal(runningVariantElo(check, { opponentChecks: 3 }), 2700)
  assert.equal(runningVariantElo(best, { opponentBestMoves: 5 }), 3100)
  assert.equal(runningVariantElo(smartin, { botMoves: 4 }), 650)
  assert.equal(runningVariantElo(bestMoveMartin), 250)
  assert.equal(runningVariantElo(bestMoveMartin, { opponentNonBestMoves: 1 }), 450)
  assert.equal(runningVariantElo(bestMoveMartin, { opponentNonBestMoves: 16 }), 3450)
  assert.equal(runningVariantElo(bestMoveMartin, { opponentNonBestMoves: 17 }), 3600)
  assert.equal(runningVariantElo(bestMoveMartin, { opponentNonBestMoves: 99 }), 3600)
  assert.equal(runningVariantElo(decay, { botMoves: 100 }), 100)
  assert.equal(runningVariantElo(hungry, { botCaptureChecks: 2 }), 2250)
  assert.equal(runningVariantElo(captureToggle, { botCaptures: 0 }), 3600)
  assert.equal(runningVariantElo(captureToggle, { botCaptures: 1 }), 250)
  assert.equal(runningVariantElo(captureToggle, { botCaptures: 2 }), 3600)
  assert.equal(runningVariantElo(captureToggle, {
    botCaptures: 0,
    botCaptureChecks: 99,
    opponentChecks: 99,
  }), 3600)
  assert.equal(runningVariantElo(check, { botMoves: 99 }), 3600)
  assert.equal(variantEventField(hungry), 'botCaptureChecks')
  assert.equal(variantEventField(captureToggle), 'botCaptures')
  assert.equal(variantEventField(bestMoveMartin), 'opponentNonBestMoves')
  assert.equal(variantEngineElo(worst), undefined)
  assert.equal(variantEngineElo(worst, { opponentWorstMoves: 1 }), 3100)
  assert.equal(variantEngineElo(smartin), undefined)
  assert.equal(variantEngineElo(smartin, { botMoves: 32 }), undefined)
  assert.equal(variantEngineElo(smartin, { botMoves: 33 }), undefined)
  assert.equal(variantEngineElo(smartin, { botMoves: 34 }), undefined)
  assert.equal(variantEngineElo(bestMoveMartin), undefined)
  assert.equal(variantEngineElo(bestMoveMartin, { opponentNonBestMoves: 6 }), 1450)
})

test('ratings above native UCI Elo use a monotonic near-best selector', () => {
  const profile = getIWantCheckmateProfile('iwc-elo-decay')
  const candidates = [
    { uci: 'a2a4', score: 100, rank: 1 },
    { uci: 'b2b4', score: 60, rank: 2 },
    { uci: 'c2c4', score: -80, rank: 3 },
  ]

  assert.equal(
    selectIWantCheckmateCandidate(
      profile,
      candidates,
      () => 0.99,
      { rating: 3200 },
    ).uci,
    'b2b4',
  )
  assert.equal(
    selectIWantCheckmateCandidate(
      profile,
      candidates,
      () => 0.99,
      { rating: 3550 },
    ).uci,
    'a2a4',
  )
  assert.equal(
    selectIWantCheckmateCandidate(
      profile,
      candidates,
      () => 0,
      { rating: 3200 },
    ).uci,
    'a2a4',
  )
})

test('dynamic Elo continuously changes playing strength from 100 to full Stockfish', () => {
  const fadingFish = getIWantCheckmateProfile('iwc-worst-move')
  const smartin = getIWantCheckmateProfile('iwc-smartin')
  const candidates = Array.from({ length: 30 }, (_, index) => ({
    uci: `move-${index + 1}`,
    score: 1000 - index * 100,
    rank: index + 1,
    move: { piece: index % 3 === 0 ? 'p' : 'n' },
  }))
  const fixedRandom = () => sequenceRandom([0.99, 0.5])

  const floorMove = selectIWantCheckmateCandidate(
    fadingFish,
    candidates,
    fixedRandom(),
    { rating: 100, events: {} },
  )
  const martinLevelMove = selectIWantCheckmateCandidate(
    fadingFish,
    candidates,
    fixedRandom(),
    { rating: 250, events: {} },
  )
  const earlySmartinMove = selectIWantCheckmateCandidate(
    smartin,
    candidates,
    fixedRandom(),
    { rating: 250, events: { botMoves: 8 } },
  )
  const strongerSmartinMove = selectIWantCheckmateCandidate(
    smartin,
    candidates,
    fixedRandom(),
    { rating: 1250, events: { botMoves: 8 } },
  )

  assert.ok(floorMove.rank > martinLevelMove.rank)
  assert.equal(martinLevelMove.rank, earlySmartinMove.rank)
  assert.ok(strongerSmartinMove.rank < earlySmartinMove.rank)
  assert.equal(variantEngineElo(fadingFish, { opponentWorstMoves: 7 }), undefined)
  assert.equal(runningVariantElo(fadingFish, { opponentWorstMoves: 99 }), 100)
  assert.equal(variantEngineElo(smartin, { botMoves: 34 }), undefined)
})

test('each dynamic variant reads only its declared trigger counter', () => {
  const cases = [
    ['iwc-worst-move', 'opponentWorstMoves', 3100],
    ['iwc-give-check', 'opponentChecks', 3300],
    ['iwc-best-move', 'opponentBestMoves', 3500],
    ['iwc-smartin', 'botMoves', 350],
    ['iwc-best-move-martin', 'opponentNonBestMoves', 450],
    ['iwc-elo-decay', 'botMoves', 3550],
    ['iwc-hungry-martin', 'botCaptureChecks', 1250],
    ['iwc-capture-toggle', 'botCaptures', 250],
  ]

  for (const [id, field, expected] of cases) {
    const profile = getIWantCheckmateProfile(id)
    const events = {
      botMoves: 0,
      botCaptureChecks: 0,
      botCaptures: 0,
      opponentChecks: 0,
      opponentBestMoves: 0,
      opponentNonBestMoves: 0,
      opponentWorstMoves: 0,
      [field]: 1,
    }
    assert.equal(variantEventField(profile), field)
    assert.equal(runningVariantElo(profile, events), expected)
    assert.equal(
      runningVariantElo(profile, {
        botMoves: field === 'botMoves' ? 0 : 99,
        botCaptureChecks: field === 'botCaptureChecks' ? 0 : 99,
        botCaptures: field === 'botCaptures' ? 0 : 99,
        opponentChecks: field === 'opponentChecks' ? 0 : 99,
        opponentBestMoves: field === 'opponentBestMoves' ? 0 : 99,
        opponentNonBestMoves: field === 'opponentNonBestMoves' ? 0 : 99,
        opponentWorstMoves: field === 'opponentWorstMoves' ? 0 : 99,
      }),
      initialVariantElo(profile),
    )
  }
})

test('ranked, target, random-top, and true-worst rules choose the intended move', () => {
  const candidates = [
    { uci: 'a2a4', score: 80, rank: 1 },
    { uci: 'b2b4', score: 20, rank: 2 },
    { uci: 'c2c4', score: 2, rank: 3 },
    { uci: 'd2d4', score: -120, rank: 4 },
  ]

  assert.equal(
    selectIWantCheckmateCandidate(getIWantCheckmateProfile('iwc-second-best'), candidates).uci,
    'b2b4',
  )
  assert.equal(
    selectIWantCheckmateCandidate(getIWantCheckmateProfile('iwc-zero-evaluation'), candidates).uci,
    'c2c4',
  )
  assert.equal(
    selectIWantCheckmateCandidate(
      getIWantCheckmateProfile('iwc-random-top-three'),
      candidates,
      () => 0.8,
    ).uci,
    'c2c4',
  )
  assert.equal(
    selectIWantCheckmateCandidate(getIWantCheckmateProfile('iwc-worstfish'), candidates).uci,
    'd2d4',
  )
})

test('BlunderFish only fires its 5% rule when a materially bad candidate exists', () => {
  const candidates = [
    { uci: 'a2a4', score: 80, rank: 1 },
    { uci: 'b2b4', score: 50, rank: 2 },
    { uci: 'c2c4', score: -140, rank: 3 },
    { uci: 'd2d4', score: -420, rank: 4 },
  ]
  const profile = getIWantCheckmateProfile('iwc-random-blunder')
  assert.equal(selectIWantCheckmateCandidate(profile, candidates, () => 0.6).uci, 'a2a4')
  assert.equal(selectIWantCheckmateCandidate(profile, candidates, () => 0.01).uci, 'd2d4')

  const harmlessAlternatives = candidates.slice(0, 2)
  assert.equal(
    selectIWantCheckmateCandidate(profile, harmlessAlternatives, () => 0.01).uci,
    'a2a4',
  )
})

test('Martin strength improves smoothly as Elo rises', () => {
  const candidates = scoredCandidates()
  const smartin = getIWantCheckmateProfile('iwc-smartin')
  const ratings = [250, 500, 750, 1000, 1250, 1320]
  const ranks = ratings.map((rating) =>
    selectIWantCheckmateCandidate(
      smartin,
      candidates,
      () => 0.99,
      { events: { botMoves: 8 }, rating },
    ).rank,
  )

  assert.ok(ranks[0] >= 13)
  assert.ok(ranks.at(-1) <= 2)
  for (let index = 1; index < ranks.length; index += 1) {
    assert.ok(ranks[index] <= ranks[index - 1])
  }
})

test('low-Elo Martin favors novice pawn, queen, and hanging-piece ideas', () => {
  const smartin = getIWantCheckmateProfile('iwc-smartin')
  const pawnCandidates = [
    { uci: 'g1f3', score: 300, rank: 1, move: { piece: 'n' } },
    { uci: 'b1c3', score: 120, rank: 2, move: { piece: 'n' } },
    { uci: 'h2h4', score: -100, rank: 3, move: { piece: 'p' } },
  ]
  const queenCandidates = [
    { uci: 'g1f3', score: 300, rank: 1, move: { piece: 'n' } },
    { uci: 'b1c3', score: 120, rank: 2, move: { piece: 'n' } },
    { uci: 'd1h5', score: -190, rank: 4, move: { piece: 'q' } },
  ]
  const hangingCandidates = [
    { uci: 'g1f3', score: 300, rank: 1, move: { piece: 'n' } },
    { uci: 'b1c3', score: 120, rank: 2, move: { piece: 'n' } },
    { uci: 'a1a4', score: -450, rank: 5, move: { piece: 'r' } },
  ]

  assert.equal(selectIWantCheckmateCandidate(
    smartin,
    pawnCandidates,
    sequenceRandom([0.99, 0]),
    { events: { botMoves: 5 }, rating: 250 },
  ).uci, 'h2h4')
  assert.equal(selectIWantCheckmateCandidate(
    smartin,
    queenCandidates,
    sequenceRandom([0.99, 0]),
    { events: { botMoves: 5 }, rating: 250 },
  ).uci, 'd1h5')
  assert.equal(selectIWantCheckmateCandidate(
    smartin,
    hangingCandidates,
    sequenceRandom([0.99, 0.72]),
    { events: { botMoves: 8 }, rating: 250 },
  ).uci, 'a1a4')
})

test('Martinfish cycles preserve their exact Stockfish-to-Martin ratios', () => {
  const candidates = scoredCandidates()
  const cases = [
    ['iwc-martinfish', [true, false, true, false]],
    ['iwc-martinfish-2', [true, true, false, true, true, false]],
    ['iwc-martinfish-3', [true, true, true, false, true, true, true, false]],
  ]

  for (const [id, expectedBestMovePhases] of cases) {
    const profile = getIWantCheckmateProfile(id)
    const bestMovePhases = expectedBestMovePhases.map((_, offset) =>
      selectIWantCheckmateCandidate(profile, candidates, () => 0.5, {
        events: { botMoves: offset + 12 },
      }).rank === 1,
    )
    assert.deepEqual(bestMovePhases, expectedBestMovePhases)
  }
})

test('Martin uses shallow opening memory before switching to novice calculation', () => {
  const smartin = getIWantCheckmateProfile('iwc-smartin')
  const openingCandidates = scoredCandidates(12)
  const openingMove = selectIWantCheckmateCandidate(
    smartin,
    openingCandidates,
    sequenceRandom([0.1, 0.99]),
    { events: { botMoves: 0 }, rating: 250 },
  )
  const laterMove = selectIWantCheckmateCandidate(
    smartin,
    openingCandidates,
    () => 0.99,
    { events: { botMoves: 4 }, rating: 250 },
  )

  assert.ok(openingMove.rank <= 5)
  assert.ok(laterMove.rank >= 10)
})

test('every Martin-derived selector has an absolute mate-in-one rule', () => {
  const martinProfiles = IWANTCHECKMATE_VIDEO_PROFILES.filter(
    (profile) => profile.category === 'martin',
  )
  const mateCandidates = [
    { uci: 'd7d5', score: 900, rank: 1, move: { piece: 'p' } },
    { uci: 'b8c6', score: 800, rank: 2, move: { piece: 'n' } },
    { uci: 'd8h4', score: 700, mate: 1, rank: 3, move: { piece: 'q' } },
  ]

  assert.ok(martinProfiles.length >= 7)
  for (const profile of martinProfiles) {
    assert.equal(
      selectIWantCheckmateCandidate(
        profile,
        mateCandidates,
        () => 0.99,
        { events: { botMoves: 17 }, rating: 250, evaluation: 0 },
      ).uci,
      'd8h4',
      profile.name,
    )
  }
})

test('Random Martinfish preserves its verified 90/10 mode split', () => {
  const profile = getIWantCheckmateProfile('iwc-random-martinfish')
  const candidates = scoredCandidates()

  assert.equal(selectIWantCheckmateCandidate(
    profile,
    candidates,
    () => 0.899999,
    { events: { botMoves: 8 } },
  ).rank, 1)
  assert.ok(selectIWantCheckmateCandidate(
    profile,
    candidates,
    sequenceRandom([0.9, 0.99, 0.5]),
    { events: { botMoves: 8 } },
  ).rank > 1)
})

test('random Martinfish profiles preserve their verified video ratios and sources', () => {
  const cases = [
    ['iwc-random-martinfish', 'Y0LOmrRicgw', 0.9],
    ['iwc-martinfish-80-20', 'ew6NU1Z_G4k', 0.8],
    ['iwc-martinfish-95-5', 'MwXcULBxA_s', 0.95],
  ]
  const candidates = scoredCandidates()

  for (const [id, videoId, stockfishChance] of cases) {
    const profile = getIWantCheckmateProfile(id)
    assert.equal(profile.source.videoId, videoId)
    assert.equal(profile.variant.movePolicy.stockfishChance, stockfishChance)
    assert.equal(profile.displayRating, null)
    assert.equal(runningVariantElo(profile), null)
    assert.equal(selectIWantCheckmateCandidate(
      profile,
      candidates,
      () => stockfishChance - 0.000001,
      { events: { botMoves: 8 } },
    ).rank, 1)
    assert.ok(selectIWantCheckmateCandidate(
      profile,
      candidates,
      sequenceRandom([stockfishChance, 0.99, 0.5]),
      { events: { botMoves: 8 } },
    ).rank > 1)
  }
})

test('all Martinfish hybrids omit a fixed display and running Elo', () => {
  const hybridIds = [
    'iwc-martinfish',
    'iwc-martinfish-2',
    'iwc-martinfish-3',
    'iwc-random-martinfish',
    'iwc-martinfish-80-20',
    'iwc-martinfish-95-5',
  ]

  for (const id of hybridIds) {
    const profile = getIWantCheckmateProfile(id)
    assert.equal(profile.displayRating, null, id)
    assert.equal(runningVariantElo(profile), null, id)
    assert.equal(variantEngineElo(profile), undefined, id)
  }
})

test('Martin mate safety finds mating moves omitted from ordinary MultiPV for both colors', () => {
  const black = new Chess()
  for (const move of ['f3', 'e5', 'g4']) black.move(move)
  const white = new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1')
  const ordinaryCandidates = [
    { uci: 'a2a3', score: 900, rank: 1, move: { piece: 'p' } },
    { uci: 'b2b3', score: 800, rank: 2, move: { piece: 'p' } },
  ]
  const profile = getIWantCheckmateProfile('iwc-smartin')

  for (const position of [black, white]) {
    const mates = guaranteedMateInOneCandidates(position)
    assert.ok(mates.length >= 1)
    assert.equal(
      ordinaryCandidates.some((candidate) =>
        mates.some((mate) => mate.uci === candidate.uci),
      ),
      false,
    )
    const selected = selectIWantCheckmateCandidate(
      profile,
      ordinaryCandidates,
      () => 0.99,
      { events: { botMoves: 20 }, rating: 250, game: position },
    )
    assert.equal(selected.mate, 1)
    const verified = new Chess(position.fen())
    verified.move(selected.uci)
    assert.equal(verified.isCheckmate(), true)
  }
})

test('every Martin-derived selector avoids an opponent mate in one when a defense exists', () => {
  const position = new Chess()
  for (const move of ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5']) position.move(move)
  const unsafeCandidate = {
    uci: 'a7a6',
    score: 0,
    rank: 1,
    move: { from: 'a7', to: 'a6', piece: 'p', color: 'b' },
  }
  const martinProfiles = IWANTCHECKMATE_VIDEO_PROFILES.filter(
    (profile) => profile.category === 'martin',
  )

  for (const profile of martinProfiles) {
    const selected = selectIWantCheckmateCandidate(
      profile,
      [unsafeCandidate],
      () => 0.99,
      {
        events: { botMoves: 20 },
        rating: 250,
        evaluation: 0,
        game: position,
      },
    )
    assert.notEqual(selected.uci, unsafeCandidate.uci, profile.name)

    const after = new Chess(position.fen())
    after.move(selected.uci)
    assert.equal(
      guaranteedMateInOneCandidates(after).length,
      0,
      profile.name,
    )
  }
})

test('Martin remains a 250-style weak bot after mate safety filters the move pool', () => {
  const position = new Chess()
  const profile = getIWantCheckmateProfile('iwc-smartin')
  const selected = selectIWantCheckmateCandidate(
    profile,
    [
      { uci: 'e2e4', score: 50, rank: 1, move: { from: 'e2', to: 'e4', piece: 'p' } },
      { uci: 'a2a3', score: -300, rank: 2, move: { from: 'a2', to: 'a3', piece: 'p' } },
      { uci: 'h2h3', score: -500, rank: 3, move: { from: 'h2', to: 'h3', piece: 'p' } },
    ],
    sequenceRandom([0.99, 0.5]),
    {
      events: { botMoves: 8 },
      rating: 250,
      evaluation: 0,
      game: position,
    },
  )

  assert.notEqual(selected.rank, 1)
})

test('Evil Martin versions use their verified permanent wake thresholds', () => {
  const candidates = [
    { uci: 'a2a4', score: 20, rank: 1 },
    { uci: 'b2b4', score: -700, rank: 2 },
  ]
  const cases = [
    ['iwc-evil-martin', -600],
    ['iwc-evil-martin-2', -500],
  ]

  for (const [id, threshold] of cases) {
    const profile = getIWantCheckmateProfile(id)
    assert.equal(profile.variant.movePolicy.wakeThresholdCp, threshold)
    assert.equal(profile.variant.movePolicy.permanentWake, true)
    assert.ok(selectIWantCheckmateCandidate(
      profile,
      candidates,
      () => 0.5,
      { evaluation: threshold + 1, events: { evilAwake: false } },
    ).rank > 1)
    assert.equal(selectIWantCheckmateCandidate(
      profile,
      candidates,
      () => 0.5,
      { evaluation: threshold, events: { evilAwake: false } },
    ).rank, 1)
    assert.equal(selectIWantCheckmateCandidate(
      profile,
      candidates,
      () => 0.5,
      { evaluation: 200, events: { evilAwake: true } },
    ).rank, 1)
  }
})

test('Evil Martin exposes the Sleepy and Evil portraits from its awake state', () => {
  const profile = getIWantCheckmateProfile('iwc-evil-martin')
  const sleepy = resolveIWantCheckmateAvatar(profile, { evilAwake: false })
  const evil = resolveIWantCheckmateAvatar(profile, { evilAwake: true })

  assert.equal(profile.avatarStates.sleepy.src.endsWith('sleepy-martin-profile.png'), true)
  assert.equal(profile.avatarStates.evil.src.endsWith('evil-martin-profile.png'), true)
  assert.equal(sleepy.avatarState, 'sleepy')
  assert.equal(sleepy.avatar, profile.avatarStates.sleepy)
  assert.equal(evil.avatarState, 'evil')
  assert.equal(evil.avatar, profile.avatarStates.evil)
})

test('capture toggle changes identity and strength only after its own captures', () => {
  const profile = getIWantCheckmateProfile('iwc-capture-toggle')
  const candidates = scoredCandidates()
  const stockfish = resolveIWantCheckmateAvatar(profile, { botCaptures: 0 })
  const martin = resolveIWantCheckmateAvatar(profile, { botCaptures: 1 })
  const stockfishAgain = resolveIWantCheckmateAvatar(profile, { botCaptures: 2 })

  assert.equal(profile.source.videoId, 'Q6sj5N3oQjI')
  assert.equal(stockfish.name, 'Stockfish')
  assert.equal(stockfish.displayRating, 3600)
  assert.equal(stockfish.countryCode, 'us')
  assert.equal(stockfish.avatarState, 'stockfish')
  assert.ok(stockfish.avatar.src.endsWith('capture-toggle-stockfish-profile.png'))
  assert.equal(martin.name, 'Martin')
  assert.equal(martin.displayRating, 250)
  assert.equal(martin.countryCode, 'bg')
  assert.equal(martin.avatarState, 'martin')
  assert.ok(martin.avatar.src.endsWith('martin-profile.png'))
  assert.equal(stockfishAgain.name, 'Stockfish')
  assert.equal(
    selectIWantCheckmateCandidate(
      profile,
      candidates,
      () => 0.99,
      { rating: 3600, events: { botCaptures: 0, botMoves: 8 } },
    ).rank,
    1,
  )
  assert.ok(
    selectIWantCheckmateCandidate(
      profile,
      candidates,
      sequenceRandom([0.99, 0.5]),
      { rating: 250, events: { botCaptures: 1, botMoves: 8 } },
    ).rank > 1,
  )
})
