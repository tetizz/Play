import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { BOT_PROFILES, getBotProfile } from '../src/data/botProfiles.js'
import { calculationProfile, chooseCoachMove } from '../src/lib/coachEngine.js'

const ayden = getBotProfile('ayden')
const mubassar = getBotProfile('mubassar')

assert.equal(BOT_PROFILES.length, 2, 'Ayden must be added without replacing Mubassar')
assert.equal(mubassar.id, 'mubassar')
assert.equal(ayden.fullName, 'Ayden Spellman')
assert.equal(ayden.country, 'United States')
assert.equal(ayden.displayRating, 1900)
assert.equal(ayden.accounts.lichess, 'AydenICN')
assert.equal(ayden.accounts.chesscom, 'AA01001')
assert.equal(ayden.avatar.type, 'placeholder')
assert.equal(ayden.avatar.src, undefined, 'Ayden must not use a real image yet')

const learnedStyle = ayden.styleProfile.learnedStyle
assert.ok(learnedStyle.sampleSize > 0, 'Ayden style data should include imported games')
assert.ok(learnedStyle.sources.lichess.games > 0, 'Lichess games should be represented')
assert.ok(learnedStyle.sources['chess.com'].games > 0, 'Chess.com games should be represented')
assert.ok(learnedStyle.byColor.white.games > 0, 'White games should be detected')
assert.ok(learnedStyle.byColor.black.games > 0, 'Black games should be detected')
assert.ok(learnedStyle.byColor.white.commonPawnStructures.length > 0)
assert.ok(learnedStyle.byColor.black.favoritePieceSetups.length > 0)
assert.ok(learnedStyle.byColor.white.timeControls.length > 0)
assert.ok(learnedStyle.knownWeakMoves.length > 0, 'Weak repeated choices should be identified')
assert.ok(Object.keys(ayden.styleProfile.openingBook).length > 0)
const startingPosition = new Chess()
const startingPositionKey = positionKey(startingPosition)
assert.ok(
  ayden.styleProfile.openingBook[startingPositionKey]?.length,
  'White repertoire should include first moves',
)
startingPosition.move('e4')
assert.ok(
  ayden.styleProfile.openingBook[positionKey(startingPosition)]?.length,
  'Black repertoire should include replies',
)

const aydenWhiteDecision = chooseCoachMove(new Chess(), 2050, null, ayden.styleProfile)
assert.equal(aydenWhiteDecision.source, 'repertoire')
const aydenAsBlack = new Chess()
aydenAsBlack.move('e4')
const aydenBlackDecision = chooseCoachMove(aydenAsBlack, 2050, null, ayden.styleProfile)
assert.equal(aydenBlackDecision.source, 'repertoire')

const engineFallback = chooseCoachMove(
  new Chess(),
  2050,
  [
    { uci: 'e2e4', score: 24, rank: 1 },
    { uci: 'd2d4', score: 15, rank: 2 },
  ],
  {
    openingBook: {},
    bookMaxPlies: 0,
    learnedStyle,
  },
)
assert.ok(engineFallback.move, 'Missing game data must fall back to a legal engine move')
assert.equal(engineFallback.source, 'engine-style')

const correctedHabit = chooseCoachMove(
  new Chess(),
  2050,
  [{ uci: 'e2e4', score: 30, rank: 1 }],
  {
    openingBook: {
      '': [
        {
          san: 'a3',
          games: 10,
          wins: 0,
          losses: 10,
          draws: 0,
          recentWeight: 10,
        },
      ],
    },
    bookMaxPlies: 14,
    learnedStyle,
  },
)
assert.equal(correctedHabit.source, 'corrected-repertoire')
assert.equal(correctedHabit.correction.historicalMove, 'a3')
assert.equal(correctedHabit.move.san, 'e4')

const noNetworkData = chooseCoachMove(new Chess(), 1900, null, {
  openingBook: {},
  bookMaxPlies: 0,
})
assert.ok(noNetworkData.move, 'The local JS style fallback should work without imported data or Stockfish')
assert.equal(noNetworkData.source, 'js-style-fallback')
assert.equal(calculationProfile(2050).elo, 2050, 'Ayden upgraded strength should reach 2000+')

console.log(
  `Ayden profile verified with ${learnedStyle.sampleSize} games `
  + `(${learnedStyle.byColor.white.games} White, ${learnedStyle.byColor.black.games} Black).`,
)

function positionKey(game) {
  return game.fen().split(' ').slice(0, 4).join(' ')
}
