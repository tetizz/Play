import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { BOT_PROFILES, getBotProfile } from '../src/data/botProfiles.js'
import {
  dialogueAfterBotMove,
  dialogueForBotBattle,
  initialDialogue,
  IWANTCHECKMATE_LINES,
} from '../src/data/dialogue.js'

const TECHNICAL_NARRATION = /\b(?:centipawn|depth|engine|evaluation(?: bar)?|principal variation|stockfish)\b/i

function allCatalogLines(value) {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(allCatalogLines)
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(allCatalogLines)
  }
  return []
}

test('IWantCheckmate dialogue is situational, wacky, and free of technical narration', () => {
  const catalog = allCatalogLines(IWANTCHECKMATE_LINES)
  assert.ok(catalog.length > 80)
  for (const line of catalog) {
    assert.doesNotMatch(line, TECHNICAL_NARRATION, line)
  }

  const pityFish = getBotProfile('iwc-worst-move')
  const panicFish = getBotProfile('iwc-give-check')
  const drawFish = getBotProfile('iwc-zero-evaluation')
  assert.match(initialDialogue(pityFish), /worst move|500 Elo/i)
  assert.match(dialogueAfterBotMove(panicFish, {
    variantElo: 3300,
    variantEloDelta: -300,
  }), /300|rating/i)
  assert.match(dialogueAfterBotMove(drawFish, {
    variantElo: 3600,
    isWinning: true,
  }), /0\.00|equality|exciting/i)
})

test('bot-battle dialogue naturally names the opponent for every talking profile', () => {
  const opponent = getBotProfile('mubassar')
  const talkingProfiles = BOT_PROFILES.filter(
    (profile) => profile.dialoguePolicy === 'iwantcheckmate',
  )
  for (const profile of talkingProfiles) {
    const line = dialogueForBotBattle(profile, {
      move: { piece: 'n', san: 'Nf3' },
      capturedValue: 0,
      isCheck: false,
      isCheckmate: false,
      isFreePiece: false,
      opponentBlunder: false,
      isWinning: false,
      variantElo: profile.variant?.initialElo,
      variantEloDelta: 0,
    }, opponent)
    assert.match(line, /Mubassar/, `${profile.name}: ${line}`)
    assert.doesNotMatch(line, /\{opponent\}/)
  }
})

test('setup roster grouping follows profile.category and hybrids use rule labels', async () => {
  const source = await readFile(
    new URL('../src/components/SetupScreen.jsx', import.meta.url),
    'utf8',
  )
  assert.match(source, /bot\.category === section\.id/)
  assert.doesNotMatch(source, /MARTIN_BOT_IDS/)
  assert.doesNotMatch(source, /iwc-martinfish/)
  assert.match(source, /profileRuleLabel\(profile\)/)
  assert.match(source, /profile\.videoLabel \|\| profile\.intro \|\| 'Variable strength'/)

  const knownCategories = new Set(['coach', 'stockfish', 'martin'])
  for (const profile of BOT_PROFILES) {
    assert.ok(knownCategories.has(profile.category), `${profile.name}: ${profile.category}`)
  }
  const hybrids = BOT_PROFILES.filter(
    (profile) => profile.capabilities?.videoVariant && !Number.isFinite(profile.displayRating),
  )
  assert.ok(hybrids.length > 0)
  for (const profile of hybrids) {
    assert.ok(profile.videoLabel || profile.intro, `${profile.name} needs a rule label`)
  }
})
