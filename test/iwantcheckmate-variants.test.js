import test from 'node:test'
import assert from 'node:assert/strict'
import {
  IWANTCHECKMATE_VIDEO_PROFILES,
  getIWantCheckmateProfile,
} from '../src/data/iwantcheckmateProfiles.js'
import {
  initialVariantElo,
  runningVariantElo,
  selectIWantCheckmateCandidate,
  variantEngineElo,
} from '../src/lib/iwantcheckmateVariants.js'

test('IWantCheckmate exposes the nine requested silent video variants', () => {
  assert.equal(IWANTCHECKMATE_VIDEO_PROFILES.length, 9)
  assert.deepEqual(
    IWANTCHECKMATE_VIDEO_PROFILES.map((profile) => profile.id),
    [
      'iwc-worst-move',
      'iwc-give-check',
      'iwc-best-move',
      'martinfish',
      'iwc-elo-decay',
      'iwc-random-blunder',
      'iwc-random-top-three',
      'iwc-zero-evaluation',
      'iwc-second-best',
    ],
  )
  for (const profile of IWANTCHECKMATE_VIDEO_PROFILES) {
    assert.equal(profile.dialoguePolicy, 'silent')
    assert.equal(profile.capabilities.silentDialogue, true)
    assert.match(profile.source.videoUrl, /^https:\/\/www\.youtube\.com\/watch\?v=/)
  }
  assert.equal(getIWantCheckmateProfile('martinfish').name, 'Martin')
  assert.equal(getIWantCheckmateProfile('iwc-second-best').source.videoTitle, 'Stockfish, But It Plays the 2nd Best Move...')
})

test('running Elo follows only the video rule that changes it', () => {
  const worst = getIWantCheckmateProfile('iwc-worst-move')
  const check = getIWantCheckmateProfile('iwc-give-check')
  const best = getIWantCheckmateProfile('iwc-best-move')
  const martin = getIWantCheckmateProfile('martinfish')
  const decay = getIWantCheckmateProfile('iwc-elo-decay')

  assert.equal(initialVariantElo(worst), 3600)
  assert.equal(runningVariantElo(worst, { opponentWorstMoves: 2 }), 2600)
  assert.equal(runningVariantElo(check, { opponentChecks: 3 }), 2700)
  assert.equal(runningVariantElo(best, { opponentBestMoves: 5 }), 3100)
  assert.equal(runningVariantElo(martin, { botMoves: 4 }), 650)
  assert.equal(runningVariantElo(decay, { botMoves: 100 }), 250)
  assert.equal(runningVariantElo(check, { botMoves: 99 }), 3600)
  assert.equal(variantEngineElo(worst), undefined)
  assert.equal(variantEngineElo(worst, { opponentWorstMoves: 1 }), 3100)
  assert.equal(variantEngineElo(martin), 1320)
})

test('video variants make the requested deterministic candidate choice', () => {
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
    selectIWantCheckmateCandidate(getIWantCheckmateProfile('iwc-random-top-three'), candidates, () => 0.8).uci,
    'c2c4',
  )
  assert.equal(
    selectIWantCheckmateCandidate(getIWantCheckmateProfile('iwc-random-blunder'), candidates, () => 0.6).uci,
    'a2a4',
  )
  assert.equal(
    selectIWantCheckmateCandidate(getIWantCheckmateProfile('iwc-random-blunder'), candidates, () => 0.01).uci,
    'b2b4',
  )
})
