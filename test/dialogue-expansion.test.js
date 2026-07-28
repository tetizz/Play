import test from 'node:test'
import assert from 'node:assert/strict'
import { BOT_PROFILES, getBotProfile } from '../src/data/botProfiles.js'
import {
  ALL_DIALOGUE_LINES,
  DIALOGUE_CATALOG,
  DIALOGUE_EVENTS,
  getDialoguePack,
} from '../src/data/dialogueCatalog.js'
import {
  dialogueAfterBotMove,
  dialogueForBotBattle,
  initialDialogue,
  resetDialogueHistory,
} from '../src/data/dialogue.js'
import { IWANTCHECKMATE_VIDEO_PROFILES } from '../src/data/iwantcheckmateProfiles.js'

const FORBIDDEN_TECHNICAL_SPEECH =
  /\b(?:engine|stockfish|depth|calculation|probability|percent|ratio)\b|80\s*\/\s*20/i

function flattenPack(pack) {
  return DIALOGUE_EVENTS.flatMap((event) => pack[event])
}

test('all selectable profiles own complete, independent dialogue packs', () => {
  assert.equal(Object.keys(DIALOGUE_CATALOG).length, BOT_PROFILES.length)
  assert.deepEqual(
    new Set(Object.keys(DIALOGUE_CATALOG)),
    new Set(BOT_PROFILES.map((profile) => profile.id)),
  )

  const packs = BOT_PROFILES.map((profile) => {
    const pack = getDialoguePack(profile.id)
    assert.ok(pack, `${profile.id} should have its own dialogue pack`)

    for (const event of DIALOGUE_EVENTS) {
      assert.ok(Array.isArray(pack[event]), `${profile.id}.${event} should be an array`)
      assert.ok(pack[event].length > 0, `${profile.id}.${event} should not be empty`)
    }

    return pack
  })

  assert.equal(new Set(packs).size, BOT_PROFILES.length)
  assert.equal(
    new Set(packs.flatMap((pack) => DIALOGUE_EVENTS.map((event) => pack[event]))).size,
    BOT_PROFILES.length * DIALOGUE_EVENTS.length,
  )
})

test('expanded dialogue contains at least 4000 globally unique human-facing lines', () => {
  assert.ok(
    ALL_DIALOGUE_LINES.length >= 4000,
    `expected at least 4000 lines, received ${ALL_DIALOGUE_LINES.length}`,
  )
  assert.equal(new Set(ALL_DIALOGUE_LINES).size, ALL_DIALOGUE_LINES.length)

  for (const line of ALL_DIALOGUE_LINES) {
    assert.equal(typeof line, 'string')
    assert.equal(line.trim(), line)
    assert.ok(line.length > 0)
  }
})

test('dialogue never exposes forbidden technical speech', () => {
  const violations = ALL_DIALOGUE_LINES.filter((line) =>
    FORBIDDEN_TECHNICAL_SPEECH.test(line),
  )
  assert.deepEqual(violations, [])
})

test('every profile exhausts a meaningful quiet-event shuffle bag before repeating', () => {
  for (const profile of BOT_PROFILES) {
    resetDialogueHistory(profile.id)
    const expectedLines = getDialoguePack(profile.id).quiet
    const sampledLines = Array.from(
      { length: expectedLines.length },
      () => dialogueAfterBotMove(profile, {
        move: { piece: 'p' },
        phase: 'middlegame',
      }),
    )

    assert.equal(
      new Set(sampledLines).size,
      expectedLines.length,
      `${profile.id} repeated before exhausting its quiet-event bag`,
    )
    assert.deepEqual(new Set(sampledLines), new Set(expectedLines))

    const firstLineFromNextBag = dialogueAfterBotMove(profile, {
      move: { piece: 'p' },
      phase: 'middlegame',
    })
    assert.notEqual(
      firstLineFromNextBag,
      sampledLines.at(-1),
      `${profile.id} repeated across a shuffle-bag boundary`,
    )
  }
})

test('bot-battle dialogue remains attributed to the speaking profile', () => {
  for (const [index, profile] of BOT_PROFILES.entries()) {
    const opponent = BOT_PROFILES[(index + 1) % BOT_PROFILES.length]
    const ownPack = getDialoguePack(profile.id)
    const ownLines = new Set(flattenPack(ownPack))
    const opponentLines = new Set(flattenPack(getDialoguePack(opponent.id)))

    resetDialogueHistory(profile.id)
    const spoken = Array.from(
      { length: 3 },
      () => dialogueForBotBattle(
        profile,
        { move: { piece: 'p' }, phase: 'middlegame' },
        opponent,
      ),
    )

    for (const line of spoken) {
      const ownLine = line
        .replace(`${opponent.name}, `, '')
        .replace(opponent.name, '{opponent}')
      assert.ok(ownLines.has(ownLine), `${profile.id} used dialogue outside its own pack`)
      assert.equal(
        opponentLines.has(ownLine),
        false,
        `${profile.id} used ${opponent.id}'s dialogue`,
      )
    }
    assert.ok(
      ownPack.battle.includes(
        spoken[2]
          .replace(`${opponent.name}, `, '')
          .replace(opponent.name, '{opponent}'),
      ),
      `${profile.id}'s third battle turn should use its battle dialogue`,
    )
  }
})

test('Witty Alien guarantees the Caro-Kann opener and retains iconic lines', () => {
  const witty = getBotProfile('witty-alien')
  const pack = getDialoguePack(witty.id)

  assert.ok(pack.intro.includes('Is this not what you came for?'))
  assert.ok(pack.brilliant.includes('My gambit, my legacy.'))
  assert.ok(pack.opening.includes('I am the destroyer of the Caro-Kann.'))

  resetDialogueHistory(witty.id)
  assert.equal(
    dialogueAfterBotMove(witty, { isOpeningMove: true }),
    'I am the destroyer of the Caro-Kann.',
  )
  assert.equal(dialogueAfterBotMove(witty, { isBrilliant: true }), 'BRILLIANT!!')
})

test('GeometricFish and every video fish or Martin profile speak visibly', () => {
  assert.ok(
    IWANTCHECKMATE_VIDEO_PROFILES.some((profile) => profile.id === 'geometricfish'),
  )

  for (const profile of IWANTCHECKMATE_VIDEO_PROFILES) {
    resetDialogueHistory(profile.id)
    assert.notEqual(profile.dialoguePolicy, 'silent')
    assert.equal(profile.capabilities.silentDialogue, false)
    assert.ok(getDialoguePack(profile.id), `${profile.id} should have a dialogue pack`)
    assert.match(initialDialogue(profile), /\S/)
    assert.match(
      dialogueAfterBotMove(profile, {
        move: { piece: 'p' },
        phase: 'middlegame',
      }),
      /\S/,
    )
  }
})
