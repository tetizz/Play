import test from 'node:test'
import assert from 'node:assert/strict'
import { BOT_PROFILES } from '../src/data/botProfiles.js'
import { ALL_DIALOGUE_LINES, DIALOGUE_CATALOG } from '../src/data/dialogueCatalog.js'
import {
  DIALOGUE_RUNTIME_ENABLED,
  dialogueAfterBotMove,
  dialogueForBotBattle,
  dialogueForGameEnd,
  initialDialogue,
} from '../src/data/dialogue.js'

test('dialogue content remains stored while runtime speech is disabled', () => {
  assert.equal(DIALOGUE_RUNTIME_ENABLED, false)
  assert.ok(Object.keys(DIALOGUE_CATALOG).length > 0)
  assert.ok(ALL_DIALOGUE_LINES.length >= 4000)
})

test('every bot-facing dialogue entry point returns no visible speech', () => {
  for (const [index, profile] of BOT_PROFILES.entries()) {
    const opponent = BOT_PROFILES[(index + 1) % BOT_PROFILES.length]
    const context = {
      move: { piece: 'n' },
      phase: 'opening',
      isOpeningMove: true,
      isBrilliant: true,
      isCheckmate: true,
      opponentBlunder: true,
      variantEloDelta: 200,
      variantElo: 450,
    }

    assert.equal(initialDialogue(profile), '')
    assert.equal(dialogueAfterBotMove(profile, context), '')
    assert.equal(dialogueForBotBattle(profile, context, opponent), '')
    assert.equal(dialogueForGameEnd(profile, 'bot wins'), '')
  }
})

test('new public-game bots have no authored or inherited dialogue packs', () => {
  for (const profileId of ['brian', 'kirk', 'alexander']) {
    assert.equal(DIALOGUE_CATALOG[profileId], undefined)
    assert.equal(BOT_PROFILES.find((profile) => profile.id === profileId)?.dialoguePolicy, 'silent')
  }
})
