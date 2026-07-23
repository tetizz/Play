import { Chess } from 'chess.js'

export function buildGamePgn({
  history,
  result,
  gameMode,
  humanColor,
  player,
  profile,
  whiteProfile,
  blackProfile,
  date = new Date(),
}) {
  const game = new Chess()
  const { white, black } = playerNames({
    gameMode,
    humanColor,
    player,
    profile,
    whiteProfile,
    blackProfile,
  })
  for (const san of history) game.move(san)
  const resultTag = resultCode(result, { white, black, game })

  game.header(
    'Event', 'Play Bots',
    'Site', 'tetizz.github.io/Play',
    'Date', formatPgnDate(date),
    'Round', '?',
    'White', white,
    'Black', black,
    'Result', resultTag,
  )

  return game.pgn({ maxWidth: 80, newline: '\n' })
}

export function pgnFilename({ gameMode, humanColor, profile, whiteProfile, blackProfile }) {
  const { white, black } = playerNames({
    gameMode,
    humanColor,
    player: { name: 'player' },
    profile,
    whiteProfile,
    blackProfile,
  })
  return `${safeName(white)}-vs-${safeName(black)}.pgn`
}

function playerNames({ gameMode, humanColor, player, profile, whiteProfile, blackProfile }) {
  if (gameMode === 'bots') {
    return {
      white: whiteProfile?.name || 'White Bot',
      black: blackProfile?.name || 'Black Bot',
    }
  }
  const playerName = player?.name || 'player'
  const botName = profile?.name || 'Bot'
  return humanColor === 'black'
    ? { white: botName, black: playerName }
    : { white: playerName, black: botName }
}

function resultCode(result, { white, black, game }) {
  if (game.isCheckmate()) return game.turn() === 'w' ? '0-1' : '1-0'

  const normalized = normalizeResultText(result)
  if (normalized === '1-0' || normalized.startsWith('white wins')) return '1-0'
  if (normalized === '0-1' || normalized.startsWith('black wins')) return '0-1'
  if (winnerMatches(normalized, white)) return '1-0'
  if (winnerMatches(normalized, black)) return '0-1'
  if (normalized.includes('draw') || normalized.includes('stalemate')) return '1/2-1/2'
  return '*'
}

function winnerMatches(result, name) {
  const normalizedName = normalizeResultText(name)
  return Boolean(normalizedName) && result.startsWith(`${normalizedName} wins`)
}

function normalizeResultText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function formatPgnDate(date) {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return '????.??.??'
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('.')
}

function safeName(value) {
  return String(value || 'game')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}
