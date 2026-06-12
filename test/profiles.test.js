import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { BOT_PROFILES, getBotProfile } from '../src/data/botProfiles.js'
import { dialogueAfterBotMove } from '../src/data/dialogue.js'
import { TRIXIZE_OPENING_BOOK } from '../src/data/trixizeOpeningBook.js'
import {
  calculationProfile,
  chooseCoachMove,
  isBishopKnightMatePosition,
  moveContext,
  shouldActivateBeltMode,
} from '../src/lib/coachEngine.js'

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
  assert.equal(getBotProfile('trixize').capabilities.weightedRepertoire, true)
  assert.equal(getBotProfile('trixize').strengthPolicy.engineElo, null)
  assert.equal(getBotProfile('trixize').strengthPolicy.candidates, 16)
  assert.equal(getBotProfile('trixize').capabilities.maximumEngine, true)
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
  assert.equal(dialogueAfterBotMove(profile, { opponentHungQueen: true }), 'Where did your queen go?')
  assert.equal(
    dialogueAfterBotMove(profile, { isBishopKnightObjective: true }),
    "I'm going to checkmate you with a bishop and knight.",
  )
})

test('Trixize uses unlimited Stockfish strength and deeper conversion searches', () => {
  const profile = getBotProfile('trixize')
  const opening = calculationProfile(profile)
  assert.equal(opening.elo, undefined)
  assert.equal(opening.depth, 18)
  assert.equal(opening.styleWindowCp, 0)

  const promotion = new Chess('7k/P7/8/8/8/8/8/6BK w - - 0 1')
  const endgame = calculationProfile(profile, false, promotion)
  assert.equal(endgame.elo, undefined)
  assert.equal(endgame.depth, 22)
  assert.equal(endgame.count, 16)
})

test('Trixize can underpromote into a bishop and knight mating objective', () => {
  const game = new Chess('7k/P7/8/8/8/8/8/6BK w - - 0 1')
  const profile = getBotProfile('trixize')
  const decision = chooseCoachMove(
    game,
    [
      { uci: 'a7a8q', score: 1200, rank: 1 },
      { uci: 'a7a8n', score: 900, rank: 2 },
      { uci: 'g1f2', score: 600, rank: 3 },
    ],
    profile,
    { openingBook: {}, bookMaxPlies: 0 },
  )
  assert.equal(decision.move.promotion, 'n')
  assert.equal(decision.source, 'engine-objective')

  const context = moveContext(game, decision.move, decision, false, false, profile)
  assert.equal(context.isBishopKnightObjective, true)
  assert.equal(dialogueAfterBotMove(profile, context), "I'm going to checkmate you with a bishop and knight.")

  const after = new Chess(game.fen())
  after.move(decision.move)
  assert.equal(isBishopKnightMatePosition(after, 'w'), true)
  assert.equal(calculationProfile(profile, false, after).depth, 26)
})

test('Trixize queen dialogue excludes a normal queen trade recapture', () => {
  const beforeTradeRecapture = new Chess()
  for (const san of ['e4', 'd5', 'exd5', 'Qxd5', 'Qf3', 'Qxf3']) beforeTradeRecapture.move(san)
  const recapture = beforeTradeRecapture.moves({ verbose: true }).find((move) => move.san === 'Nxf3')
  assert.ok(recapture)

  const decision = { move: recapture, source: 'engine-best', rank: 1, score: 0 }
  const context = moveContext(beforeTradeRecapture, recapture, decision, false, false, getBotProfile('trixize'))
  assert.equal(context.opponentHungQueen, false)
  assert.equal(dialogueAfterBotMove(getBotProfile('trixize'), context), '')
})

test('Trixize notices a genuinely hung queen', () => {
  const game = new Chess()
  for (const san of ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qxg2']) game.move(san)
  const capture = game.moves({ verbose: true }).find((move) => move.san === 'Bxg2')
  assert.ok(capture)

  const decision = { move: capture, source: 'engine-best', rank: 1, score: 900 }
  const context = moveContext(game, capture, decision, false, false, getBotProfile('trixize'))
  assert.equal(context.opponentHungQueen, true)
  assert.equal(dialogueAfterBotMove(getBotProfile('trixize'), context), 'Where did your queen go?')
})

test('Trixize follows the full position repertoire after the forced Nf3 start', () => {
  const game = new Chess()
  const profile = getBotProfile('trixize')
  for (const san of ['Nf3', 'd5']) game.move(san)
  const key = game.fen().split(' ').slice(0, 4).join(' ')
  const c4 = chooseCoachMove(
    game,
    [
      { uci: 'g2g3', score: 30, rank: 1 },
      { uci: 'c2c4', score: 28, rank: 2 },
    ],
    profile,
    {
      openingBook: {
        [key]: [
          { san: 'g3', games: 288, wins: 158, losses: 118, draws: 12, recentWeight: 198 },
          { san: 'c4', games: 18, wins: 11, losses: 6, draws: 1, recentWeight: 12 },
        ],
      },
      bookMaxPlies: 40,
      bookKeyType: 'position',
    },
    false,
    () => 0.999,
  )
  assert.equal(c4.move.san, 'c4')

  const g3 = chooseCoachMove(
    game,
    [
      { uci: 'g2g3', score: 30, rank: 1 },
      { uci: 'c2c4', score: 28, rank: 2 },
    ],
    profile,
    {
      openingBook: {
        [key]: [
          { san: 'g3', games: 288, wins: 158, losses: 118, draws: 12, recentWeight: 198 },
          { san: 'c4', games: 18, wins: 11, losses: 6, draws: 1, recentWeight: 12 },
        ],
      },
      bookMaxPlies: 40,
      bookKeyType: 'position',
    },
    false,
    () => 0,
  )
  assert.equal(g3.move.san, 'g3')
})

test('Trixize knows the legal Nf3 b6 tactical repertoire line', () => {
  const game = new Chess()
  const profile = getBotProfile('trixize')
  const line = [
    ['Nf3', 'g8f6'],
    ['b6'],
    ['g3', 'g2g3'],
    ['Bb7'],
    ['Bg2', 'f1g2'],
    ['g5'],
    ['e4', 'e2e4'],
    ['Bxe4'],
    ['d3', 'd2d3'],
    ['Bxf3'],
    ['Qxf3', 'd1f3'],
    ['Nc6'],
    ['Qxc6', 'f3c6'],
    ['dxc6'],
    ['Bxc6+', 'c1c6'],
    ['Qd7'],
    ['Bxd7+', 'c6d7'],
  ]

  for (let index = 0; index < line.length; index += 1) {
    const [san, uci] = line[index]
    if (index % 2 === 0) {
      const decision = chooseCoachMove(
        game,
        [{ uci, score: 30, rank: 1 }],
        profile,
        {
          openingBook: TRIXIZE_OPENING_BOOK,
          bookMaxPlies: 40,
          bookKeyType: 'position',
        },
      )
      assert.equal(decision.move.san, san)
      assert.equal(decision.source, 'repertoire')
    }
    game.move(san)
  }

  assert.deepEqual(game.moves().sort(), ['Kd8', 'Kxd7'])
})

test('Trixize prefers a familiar Black repertoire move inside the engine-safe window', () => {
  const game = new Chess()
  game.move('e4')
  const profile = getBotProfile('trixize')
  const decision = chooseCoachMove(
    game,
    [
      { uci: 'g8f6', score: 35, rank: 1 },
      { uci: 'd7d6', score: 30, rank: 2 },
    ],
    profile,
    {
      openingBook: {
        [game.fen().split(' ').slice(0, 4).join(' ')]: [
          { san: 'd6', games: 504, recentWeight: 341.9 },
          { san: 'Nf6', games: 4, recentWeight: 3.1 },
        ],
      },
      bookMaxPlies: 40,
      bookKeyType: 'position',
    },
  )
  assert.equal(decision.move.san, 'd6')
  assert.equal(decision.source, 'repertoire')
})

test('Trixize rejects an unsafe familiar Black move for a safe repertoire alternative', () => {
  const game = new Chess()
  game.move('e4')
  const profile = getBotProfile('trixize')
  const decision = chooseCoachMove(
    game,
    [
      { uci: 'g8f6', score: 80, rank: 1 },
      { uci: 'd7d6', score: 10, rank: 2 },
    ],
    profile,
    {
      openingBook: {
        [game.fen().split(' ').slice(0, 4).join(' ')]: [
          { san: 'd6', games: 504, recentWeight: 341.9 },
          { san: 'Nf6', games: 4, recentWeight: 3.1 },
        ],
      },
      bookMaxPlies: 40,
      bookKeyType: 'position',
    },
  )
  assert.equal(decision.move.san, 'Nf6')
  assert.equal(decision.source, 'repertoire')
})
