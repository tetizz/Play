import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { BOT_PROFILES, getBotProfile } from '../src/data/botProfiles.js'
import { dialogueAfterBotMove } from '../src/data/dialogue.js'
import { chooseCoachMove, shouldActivateBeltMode } from '../src/lib/coachEngine.js'

test('the four public bot profiles expose the requested ratings and capabilities', () => {
  assert.equal(BOT_PROFILES.length, 4)
  assert.equal(getBotProfile('mubassar').displayRating, 2300)
  assert.equal(getBotProfile('ayden').displayRating, 1900)
  assert.equal(getBotProfile('akshit').displayRating, 1000)
  assert.equal(getBotProfile('trixize').displayRating, 1550)
  assert.equal(getBotProfile('mubassar').capabilities.beltMode, true)
  assert.equal(getBotProfile('ayden').capabilities.beltMode, false)
  assert.equal(getBotProfile('akshit').capabilities.knightSpecialist, true)
  assert.equal(getBotProfile('trixize').capabilities.perfectTheory, true)
  assert.equal(getBotProfile('trixize').strengthPolicy.engineElo, 3000)
  assert.equal(getBotProfile('ayden').intro, 'Ayden loves the french defense')
  assert.equal(
    getBotProfile('akshit').intro,
    'Akshit is the Knight maneuver loves to move his knight',
  )
})

test('the original bot strength hierarchy is Mubassar, Ayden, then Akshit', () => {
  const mubassar = getBotProfile('mubassar').strengthPolicy.engineElo
  const ayden = getBotProfile('ayden').strengthPolicy.engineElo
  const akshit = getBotProfile('akshit').strengthPolicy.engineElo
  assert.ok(mubassar > ayden)
  assert.ok(ayden > akshit)
  assert.ok(ayden - akshit <= 150)
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

test('Akshit must take a clearly superior knight move and uses his own dialogue set', () => {
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
  assert.match(dialogueAfterBotMove(profile, { move: { piece: 'p' } }), /^(Okay|Lil kids play this)$/)
  assert.match(
    dialogueAfterBotMove(profile, { move: { piece: 'p' }, isWinning: true }),
    /^(Easy belt|Don't cry after losing|Go home|Quit the game|Chess is not for you)$/,
  )
  assert.match(
    dialogueAfterBotMove(profile, { move: { piece: 'p' }, isFreePiece: true }),
    /^(rahhhhhh|Easy belt)$/,
  )
})

test('Trixize starts with Nf3 and uses only the requested short dialogue', () => {
  const game = new Chess()
  const profile = getBotProfile('trixize')
  assert.equal(profile.intro, 'Adriano plays the kings indian ie the best opening')
  const decision = chooseCoachMove(
    game,
    [
      { uci: 'd2d4', score: 30, rank: 1 },
      { uci: 'g1f3', score: 26, rank: 2 },
    ],
    profile,
    { openingBook: {}, bookMaxPlies: 0 },
  )
  assert.equal(decision.move.san, 'Nf3')
  assert.equal(dialogueAfterBotMove(profile, { isTrixizeFirstMove: true }), '1. Nf3 is the starting move.')
  assert.equal(dialogueAfterBotMove(profile, { isTheoryBest: true }), 'Best move. Too much theory.')
  assert.equal(dialogueAfterBotMove(profile, { isFreePiece: true }), 'Oops.')
  assert.equal(dialogueAfterBotMove(profile, { isBrilliant: true }), 'Rahh!')
})
