import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { BOT_PROFILES, getBotProfile } from '../src/data/botProfiles.js'
import { dialogueAfterBotMove } from '../src/data/dialogue.js'
import { chooseCoachMove, shouldActivateBeltMode } from '../src/lib/coachEngine.js'

test('the three public bot profiles expose the requested ratings and capabilities', () => {
  assert.equal(BOT_PROFILES.length, 3)
  assert.equal(getBotProfile('mubassar').displayRating, 2300)
  assert.equal(getBotProfile('ayden').displayRating, 1900)
  assert.equal(getBotProfile('akshit').displayRating, 1000)
  assert.equal(getBotProfile('mubassar').capabilities.beltMode, true)
  assert.equal(getBotProfile('ayden').capabilities.beltMode, false)
  assert.equal(getBotProfile('akshit').capabilities.knightSpecialist, true)
})

test('Mubassar always opens with d4 as White', () => {
  const game = new Chess()
  const decision = chooseCoachMove(
    game,
    [
      { uci: 'e2e4', score: 80, rank: 1 },
      { uci: 'd2d4', score: 20, rank: 2 },
    ],
    getBotProfile('mubassar'),
    { openingBook: {}, bookMaxPlies: 0 },
  )
  assert.equal(decision.move.san, 'd4')
})

test('unsound repertoire moves are rejected for engine candidates', () => {
  const game = new Chess()
  const profile = getBotProfile('ayden')
  const decision = chooseCoachMove(
    game,
    [
      { uci: 'e2e4', score: 80, rank: 1 },
      { uci: 'a2a3', score: -50, rank: 2 },
    ],
    profile,
    {
      openingBook: {
        [game.fen().split(' ').slice(0, 4).join(' ')]: [
          { san: 'a3', games: 40, wins: 18, losses: 10, recentWeight: 12 },
        ],
      },
      bookMaxPlies: 12,
      bookKeyType: 'position',
    },
  )
  assert.equal(decision.move.san, 'e4')
  assert.notEqual(decision.source, 'repertoire')
})

test('belt mode is isolated to Mubassar', () => {
  const history = ['Nf3', 'd5', 'g3', 'Nf6', 'Bg2']
  assert.equal(shouldActivateBeltMode(getBotProfile('mubassar'), history, 'white'), true)
  assert.equal(shouldActivateBeltMode(getBotProfile('ayden'), history, 'white'), false)
  assert.equal(shouldActivateBeltMode(getBotProfile('akshit'), history, 'white'), false)
})

test('Akshit must take a clearly superior knight move and only speaks for knight moves', () => {
  const game = new Chess()
  const profile = getBotProfile('akshit')
  const decision = chooseCoachMove(
    game,
    [
      { uci: 'g1f3', score: 70, rank: 1 },
      { uci: 'e2e4', score: 20, rank: 2 },
    ],
    profile,
    { openingBook: {}, bookMaxPlies: 0 },
  )
  assert.equal(decision.move.piece, 'n')
  assert.equal(dialogueAfterBotMove(profile, { move: decision.move }), 'I am the knight manuveur.')
  assert.equal(dialogueAfterBotMove(profile, { move: { piece: 'p' } }), '')
})
