import { writeFile } from 'node:fs/promises'
import { Chess } from 'chess.js'

const OUTPUT_PATH = new URL('../src/data/generatedRecentRepertoireBook.js', import.meta.url)
const HALF_LIFE_DAYS = 180
const CHESSCOM_RECENT_MONTHS = 30
const MAX_LICHESS_GAMES_PER_ACCOUNT = 900
const MAX_BOOK_PLIES = 14
const MAX_MOVES_PER_POSITION = 8
const MIN_RECENT_WEIGHT = 0.05
const ACCOUNTS = [
  { site: 'chess.com', username: 'keepitcoming' },
  { site: 'lichess', username: 'real64squares' },
  { site: 'lichess', username: 'guardup' },
]

const now = new Date()
const book = {}
const sourceStats = []

for (const account of ACCOUNTS) {
  const games = account.site === 'chess.com'
    ? await fetchChessComGames(account.username)
    : await fetchLichessGames(account.username)
  sourceStats.push(`${account.site}:${account.username}=${games.length}`)
  for (const gameRecord of games) addGameToBook(account.username, gameRecord)
}

const sortedBook = Object.fromEntries(
  Object.entries(book)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, moves]) => [
      key,
      moves
        .filter((move) => move.recentWeight >= MIN_RECENT_WEIGHT)
        .sort((a, b) => b.recentWeight - a.recentWeight || b.games - a.games)
        .slice(0, MAX_MOVES_PER_POSITION)
        .map((move) => ({
          san: move.san,
          games: move.games,
          wins: move.wins,
          losses: move.losses,
          draws: move.draws,
          recentWeight: Number(move.recentWeight.toFixed(3)),
          latestPlayedAt: move.latestPlayedAt,
        })),
    ]),
)

await writeFile(
  OUTPUT_PATH,
  `// Generated from recent public Chess.com/Lichess PGNs for keepitcoming, real64squares, and guardup.
// Recency uses a ${HALF_LIFE_DAYS}-day half-life, so newer games influence move choice more.
// Chess.com window: last ${CHESSCOM_RECENT_MONTHS} monthly archives. Lichess cap: latest ${MAX_LICHESS_GAMES_PER_ACCOUNT} games per account.
// Opening depth: first ${MAX_BOOK_PLIES} plies, max ${MAX_MOVES_PER_POSITION} moves per position.
// Sources: ${sourceStats.join(', ')}.
// Generated at ${now.toISOString()}.
// Do not edit by hand; run npm run build:recent-book.
export const GENERATED_RECENT_REPERTOIRE_BOOK = ${JSON.stringify(sortedBook, null, 2)}
`,
)

function addGameToBook(accountUsername, gameRecord) {
  const chess = new Chess()
  try {
    chess.loadPgn(gameRecord.pgn)
  } catch {
    return
  }

  const headers = chess.header()
  if (headers.Variant && headers.Variant.toLowerCase() !== 'standard') return
  const white = normalizeUsername(headers.White)
  const black = normalizeUsername(headers.Black)
  const account = normalizeUsername(accountUsername)
  const playerColor = white === account ? 'w' : black === account ? 'b' : null
  if (!playerColor) return

  const playedAt = gameRecord.playedAt || dateFromHeaders(headers)
  if (!playedAt) return
  const weight = recencyWeight(playedAt)
  const result = resultForPlayer(headers.Result, playerColor)
  const moves = chess.history()

  for (let index = 0; index < moves.length; index += 1) {
    if (index >= MAX_BOOK_PLIES) break
    const isPlayerMove = playerColor === 'w' ? index % 2 === 0 : index % 2 === 1
    if (!isPlayerMove) continue
    const key = moves.slice(0, index).join(' ')
    const san = moves[index]
    const moveList = book[key] || []
    let entry = moveList.find((move) => move.san === san)
    if (!entry) {
      entry = {
        san,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        recentWeight: 0,
        latestPlayedAt: playedAt.toISOString(),
      }
      moveList.push(entry)
      book[key] = moveList
    }
    entry.games += 1
    entry[result] += 1
    entry.recentWeight += weight
    if (playedAt > new Date(entry.latestPlayedAt)) entry.latestPlayedAt = playedAt.toISOString()
  }
}

async function fetchChessComGames(username) {
  const archives = await fetchJson(`https://api.chess.com/pub/player/${username}/games/archives`)
  const recentArchives = (archives.archives || []).slice(-CHESSCOM_RECENT_MONTHS)
  const games = []
  const monthlyArchives = await Promise.all(recentArchives.map((archiveUrl) => fetchJson(archiveUrl)))
  for (const archive of monthlyArchives) {
    for (const game of archive.games || []) {
      if (game.rules !== 'chess' || !game.pgn) continue
      games.push({
        pgn: game.pgn,
        playedAt: game.end_time ? new Date(game.end_time * 1000) : null,
      })
    }
  }
  return games
}

async function fetchLichessGames(username) {
  const url = new URL(`https://lichess.org/api/games/user/${username}`)
  url.searchParams.set('max', String(MAX_LICHESS_GAMES_PER_ACCOUNT))
  url.searchParams.set('pgnInJson', 'false')
  url.searchParams.set('tags', 'true')
  url.searchParams.set('clocks', 'false')
  url.searchParams.set('evals', 'false')
  url.searchParams.set('opening', 'false')
  const response = await fetch(url, {
    headers: {
      Accept: 'application/x-chess-pgn',
      'User-Agent': 'mubassar-bot/1.0',
    },
  })
  if (!response.ok) throw new Error(`Lichess ${username}: ${response.status}`)
  const pgnText = await response.text()
  return splitPgnGames(pgnText).map((pgn) => ({
    pgn,
    playedAt: dateFromPgn(pgn),
  }))
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'mubassar-bot/1.0' },
  })
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response.json()
}

function splitPgnGames(pgnText) {
  return pgnText
    .split(/\n(?=\[Event )/g)
    .map((game) => game.trim())
    .filter(Boolean)
}

function dateFromHeaders(headers) {
  const date = headers.UTCDate || headers.Date
  const time = headers.UTCTime || '00:00:00'
  if (!date || date.includes('????')) return null
  return parsePgnDate(date, time)
}

function dateFromPgn(pgn) {
  const date = pgn.match(/\[(?:UTCDate|Date) "([^"]+)"\]/)?.[1]
  const time = pgn.match(/\[UTCTime "([^"]+)"\]/)?.[1] || '00:00:00'
  return date ? parsePgnDate(date, time) : null
}

function parsePgnDate(date, time) {
  const normalizedDate = date.replaceAll('.', '-')
  const parsed = new Date(`${normalizedDate}T${time}Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function recencyWeight(playedAt) {
  const ageMs = Math.max(0, now.getTime() - playedAt.getTime())
  const ageDays = ageMs / 86400000
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS)
}

function resultForPlayer(result, playerColor) {
  if (result === '1/2-1/2') return 'draws'
  if (result === '1-0') return playerColor === 'w' ? 'wins' : 'losses'
  if (result === '0-1') return playerColor === 'b' ? 'wins' : 'losses'
  return 'draws'
}

function normalizeUsername(username = '') {
  return username.toLowerCase().replace(/\s+/g, '')
}
