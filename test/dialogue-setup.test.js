import test from 'node:test'
import assert from 'node:assert/strict'
import { BOT_PROFILES } from '../src/data/botProfiles.js'
import {
  dialogueAfterBotMove,
  dialogueForBotBattle,
  initialDialogue,
} from '../src/data/dialogue.js'

test('setup, moves, and bot battles do not emit dialogue', () => {
  const opponent = BOT_PROFILES[0]
  for (const profile of BOT_PROFILES) {
    assert.equal(initialDialogue(profile), '')
    assert.equal(dialogueAfterBotMove(profile, { move: { piece: 'p' } }), '')
    assert.equal(dialogueForBotBattle(profile, { move: { piece: 'p' } }, opponent), '')
  }
})
