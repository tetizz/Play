import { writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'

const PROFILES = {
  mubassar: {
    label: 'Mubassar',
    bookFile: 'generatedRecentRepertoireBook.js',
    bookExport: 'GENERATED_RECENT_REPERTOIRE_BOOK',
    styleFile: 'generatedMubassarStyleProfile.js',
    styleExport: 'GENERATED_MUBASSAR_STYLE_PROFILE',
    accounts: [
      { site: 'chess.com', username: 'keepitcoming' },
      { site: 'lichess', username: 'real64squares' },
      { site: 'lichess', username: 'guardup' },
    ],
  },
  ayden: {
    label: 'Ayden',
    bookFile: 'generatedRecentAydenRepertoireBook.js',
    bookExport: 'GENERATED_RECENT_REPERTOIRE_BOOK',
    styleFile: 'generatedAydenStyleProfile.js',
    styleExport: 'GENERATED_AYDEN_STYLE_PROFILE',
    accounts: [
      { site: 'chess.com', username: 'AA01001' },
      { site: 'lichess', username: 'AydenICN' },
    ],
  },
  akshit: {
    label: 'Akshit',
    bookFile: 'generatedRecentAkshitRepertoireBook.js',
    bookExport: 'GENERATED_RECENT_AKSHIT_REPERTOIRE_BOOK',
    styleFile: 'generatedAkshitStyleProfile.js',
    styleExport: 'GENERATED_AKSHIT_STYLE_PROFILE',
    accounts: [
      { site: 'chess.com', username: 'knightmanuveur_12' },
    ],
  },
  trixize: {
    label: 'Trixize',
    bookFile: 'generatedRecentTrixizeRepertoireBook.js',
    bookExport: 'GENERATED_RECENT_TRIXIZE_REPERTOIRE_BOOK',
    styleFile: 'generatedTrixizeStyleProfile.js',
    styleExport: 'GENERATED_TRIXIZE_STYLE_PROFILE',
    accounts: [
      { site: 'chess.com', username: 'trixize1234' },
    ],
  },
}

const requestedProfile = process.argv.includes('--profile')
  ? process.argv[process.argv.indexOf('--profile') + 1]
  : 'all'

if (requestedProfile === 'all') {
  for (const profileId of Object.keys(PROFILES)) {
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--profile', profileId], {
      stdio: 'inherit',
    })
    if (result.status !== 0) process.exit(result.status || 1)
  }
  process.exit(0)
}

const PROFILE = PROFILES[requestedProfile]
if (!PROFILE) throw new Error(`Unknown profile "${requestedProfile}"`)
const BOOK_OUTPUT_PATH = new URL(`../src/data/${PROFILE.bookFile}`, import.meta.url)
const STYLE_OUTPUT_PATH = new URL(`../src/data/${PROFILE.styleFile}`, import.meta.url)
const HALF_LIFE_DAYS = 180
const CHESSCOM_RECENT_MONTHS = 30
const MAX_LICHESS_GAMES_PER_ACCOUNT = 900
const MAX_BOOK_PLIES = 24
const MAX_MOVES_PER_POSITION = 8
const MIN_RECENT_WEIGHT = 0.05
const MAX_BOOK_POSITIONS = 9000
const ACCOUNTS = PROFILE.accounts

const now = new Date()
const book = {}
const sourceStats = []
const styleAccumulator = {
  games: 0,
  recentWeight: 0,
  sources: {},
  byColor: {
    white: createStyleBucket(),
    black: createStyleBucket(),
  },
}

for (const account of ACCOUNTS) {
  try {
    const games = account.site === 'chess.com'
      ? await fetchChessComGames(account.username)
      : await fetchLichessGames(account.username)
    let acceptedGames = 0
    for (const gameRecord of games) {
      const parsedGame = parsePlayerGame(account.username, gameRecord)
      if (!parsedGame) continue
      acceptedGames += 1
      addGameToBook(parsedGame)
      addGameToStyle(account.site, parsedGame)
    }
    sourceStats.push(`${account.site}:${account.username}=${acceptedGames}`)
  } catch (error) {
    sourceStats.push(`${account.site}:${account.username}=0(error)`)
    console.warn(`Skipping ${account.site}:${account.username}: ${error.message}`)
  }
}

if (styleAccumulator.games === 0) {
  console.warn(`No ${PROFILE.label} games were loaded. Existing generated repertoire and style data were preserved.`)
} else {
  const sortedBook = buildSortedBook()
  const learnedStyle = buildLearnedStyle(sortedBook)

  await Promise.all([
    writeFile(
      BOOK_OUTPUT_PATH,
      `// Generated from recent public Chess.com/Lichess PGNs for ${PROFILE.label}.
// Recency uses a ${HALF_LIFE_DAYS}-day half-life, so newer games influence move choice more.
// Chess.com window: last ${CHESSCOM_RECENT_MONTHS} monthly archives. Lichess cap: latest ${MAX_LICHESS_GAMES_PER_ACCOUNT} games per account.
// Opening depth: first ${MAX_BOOK_PLIES} plies, max ${MAX_MOVES_PER_POSITION} moves per position.
// Sources: ${sourceStats.join(', ')}.
// Generated at ${now.toISOString()}.
// Do not edit by hand; run npm run build:repertoires.
export const ${PROFILE.bookExport} = ${JSON.stringify(sortedBook, null, 2)}
`,
    ),
    writeFile(
      STYLE_OUTPUT_PATH,
      `// Generated from the same public games as ${PROFILE.bookFile}.
// This compact profile lets the runtime preserve ${PROFILE.label}'s recurring plans outside exact book positions.
// Sources: ${sourceStats.join(', ')}.
// Generated at ${now.toISOString()}.
// Do not edit by hand; run npm run build:repertoires.
export const ${PROFILE.styleExport} = ${JSON.stringify(learnedStyle, null, 2)}
`,
    ),
  ])
}

function parsePlayerGame(accountUsername, gameRecord) {
  const chess = new Chess()
  try {
    chess.loadPgn(gameRecord.pgn)
  } catch {
    return null
  }

  const headers = chess.header()
  if (headers.Variant && headers.Variant.toLowerCase() !== 'standard') return null
  const white = normalizeUsername(headers.White)
  const black = normalizeUsername(headers.Black)
  const account = normalizeUsername(accountUsername)
  const playerColor = white === account ? 'w' : black === account ? 'b' : null
  if (!playerColor) return null

  const playedAt = gameRecord.playedAt || dateFromHeaders(headers)
  if (!playedAt) return null

  return {
    headers,
    moves: chess.history({ verbose: true }),
    playedAt,
    playerColor,
    result: resultForPlayer(headers.Result, playerColor),
    weight: recencyWeight(playedAt),
  }
}

function addGameToBook(gameRecord) {
  const moveSans = gameRecord.moves.map((move) => move.san)
  const replay = new Chess()

  for (let index = 0; index < moveSans.length; index += 1) {
    if (index >= MAX_BOOK_PLIES) break
    const isPlayerMove = gameRecord.playerColor === 'w' ? index % 2 === 0 : index % 2 === 1
    if (isPlayerMove) {
      const key = positionKey(replay)
      const san = moveSans[index]
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
          latestPlayedAt: gameRecord.playedAt.toISOString(),
        }
        moveList.push(entry)
        book[key] = moveList
      }
      entry.games += 1
      entry[gameRecord.result] += 1
      entry.recentWeight += gameRecord.weight
      if (gameRecord.playedAt > new Date(entry.latestPlayedAt)) {
        entry.latestPlayedAt = gameRecord.playedAt.toISOString()
      }
    }
    replay.move(moveSans[index])
  }
}

function addGameToStyle(site, gameRecord) {
  const colorKey = gameRecord.playerColor === 'w' ? 'white' : 'black'
  const bucket = styleAccumulator.byColor[colorKey]
  const source = styleAccumulator.sources[site] || { games: 0, recentWeight: 0 }
  const moveSans = gameRecord.moves.map((move) => move.san)
  const openingLine = moveSans.slice(0, 8).join(' ')
  const replay = new Chess()
  let recordedPawnStructure = false

  styleAccumulator.games += 1
  styleAccumulator.recentWeight += gameRecord.weight
  source.games += 1
  source.recentWeight += gameRecord.weight
  styleAccumulator.sources[site] = source
  bucket.games += 1
  bucket.recentWeight += gameRecord.weight
  bucket.results[gameRecord.result] += 1
  increment(bucket.openingLines, openingLine, gameRecord.weight)
  increment(bucket.timeControls, classifyTimeControl(gameRecord.headers.TimeControl), gameRecord.weight)

  for (let index = 0; index < gameRecord.moves.length; index += 1) {
    const move = gameRecord.moves[index]
    const isPlayerMove = gameRecord.playerColor === 'w' ? index % 2 === 0 : index % 2 === 1
    const isEarlyMove = index < 20
    const piecesBeforeMove = countPieces(replay)

    if (isPlayerMove) {
      bucket.moveWeight += gameRecord.weight
      if (isEarlyMove) increment(bucket.pieceDestinations, `${move.piece}:${move.to}`, gameRecord.weight)
      recordMoveMotifs(bucket.motifs, move, index, gameRecord.weight)

      if (piecesBeforeMove <= 12) {
        bucket.endgame.positions += gameRecord.weight
        if (move.piece === 'k') bucket.endgame.kingMoves += gameRecord.weight
        if (move.piece === 'p') bucket.endgame.pawnMoves += gameRecord.weight
        if (move.captured) bucket.endgame.captures += gameRecord.weight
        if (move.san.includes('+')) bucket.endgame.checks += gameRecord.weight
      }
    }

    replay.move(move.san)
    if (!recordedPawnStructure && index >= 11) {
      increment(
        bucket.pawnStructures,
        pawnStructureSignature(replay, gameRecord.playerColor),
        gameRecord.weight,
      )
      recordedPawnStructure = true
    }
  }

  if (!recordedPawnStructure) {
    increment(
      bucket.pawnStructures,
      pawnStructureSignature(replay, gameRecord.playerColor),
      gameRecord.weight,
    )
  }
}

function recordMoveMotifs(motifs, move, index, weight) {
  if (move.captured) motifs.capture += weight
  if (move.san.includes('+') || move.san.includes('#')) motifs.check += weight
  if (move.flags.includes('k') || move.flags.includes('q')) motifs.castle += weight
  if (move.piece === 'p') motifs.pawnPush += weight
  if (move.piece === 'q') motifs.queenMove += weight
  if (move.piece === 'r') motifs.rookMove += weight
  if (move.piece === 'k') motifs.kingMove += weight
  if (move.piece === 'p' && ['a', 'b', 'g', 'h'].includes(move.to[0])) motifs.flankPawn += weight
  if (['d4', 'e4', 'd5', 'e5'].includes(move.to)) motifs.center += weight
  if (
    index < 16 &&
    (move.piece === 'n' || move.piece === 'b') &&
    ['1', '8'].includes(move.from[1])
  ) {
    motifs.development += weight
  }
  if (move.piece === 'q' && index < 12) motifs.earlyQueen += weight
}

function buildSortedBook() {
  const reliablePositions = Object.entries(book)
      .map(([key, moves]) => [
        key,
        moves
          .filter((move) =>
            move.recentWeight >= MIN_RECENT_WEIGHT &&
            (move.games >= 2 || move.recentWeight >= 0.7),
          )
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
      ])
      .filter(([, moves]) => moves.length)
  reliablePositions.sort(([, a], [, b]) => {
    const aWeight = a.reduce((sum, move) => sum + move.recentWeight, 0)
    const bWeight = b.reduce((sum, move) => sum + move.recentWeight, 0)
    return bWeight - aWeight
  })
  return Object.fromEntries(
    reliablePositions
      .slice(0, MAX_BOOK_POSITIONS)
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

function buildLearnedStyle(sortedBook) {
  return {
    generatedAt: now.toISOString(),
    sampleSize: styleAccumulator.games,
    recentWeight: round(styleAccumulator.recentWeight),
    sources: Object.fromEntries(
      Object.entries(styleAccumulator.sources).map(([site, stats]) => [
        site,
        {
          games: stats.games,
          recentWeight: round(stats.recentWeight),
        },
      ]),
    ),
    byColor: {
      white: summarizeStyleBucket(styleAccumulator.byColor.white),
      black: summarizeStyleBucket(styleAccumulator.byColor.black),
    },
    knownWeakMoves: findKnownWeakMoves(sortedBook),
  }
}

function summarizeStyleBucket(bucket) {
  const moveWeight = Math.max(1, bucket.moveWeight)
  const favoritePieceSetups = topEntries(bucket.pieceDestinations, 36)
  const strongestSetupWeight = favoritePieceSetups[0]?.weight || 1

  return {
    games: bucket.games,
    recentWeight: round(bucket.recentWeight),
    results: bucket.results,
    motifWeights: Object.fromEntries(
      Object.entries(bucket.motifs).map(([motif, weight]) => [motif, round(weight / moveWeight)]),
    ),
    pieceSquareWeights: Object.fromEntries(
      favoritePieceSetups.map(({ key, weight }) => [key, round(weight / strongestSetupWeight)]),
    ),
    favoritePieceSetups: favoritePieceSetups.slice(0, 12),
    openingLines: topEntries(bucket.openingLines, 10),
    commonPawnStructures: topEntries(bucket.pawnStructures, 10),
    timeControls: topEntries(bucket.timeControls, 6),
    endgameHabits: {
      positions: round(bucket.endgame.positions),
      kingMoveRate: rate(bucket.endgame.kingMoves, bucket.endgame.positions),
      pawnMoveRate: rate(bucket.endgame.pawnMoves, bucket.endgame.positions),
      captureRate: rate(bucket.endgame.captures, bucket.endgame.positions),
      checkRate: rate(bucket.endgame.checks, bucket.endgame.positions),
    },
  }
}

function findKnownWeakMoves(sortedBook) {
  const weakMoves = []
  for (const [history, moves] of Object.entries(sortedBook)) {
    for (const move of moves) {
      if (move.games < 4) continue
      const decisiveGames = move.wins + move.losses
      if (!decisiveGames) continue
      const lossRate = move.losses / decisiveGames
      const winRate = move.wins / decisiveGames
      if (lossRate < 0.65 || winRate > 0.25) continue
      weakMoves.push({
        history,
        san: move.san,
        games: move.games,
        winRate: round(winRate),
        lossRate: round(lossRate),
        recentWeight: move.recentWeight,
      })
    }
  }
  return weakMoves
    .sort((a, b) => b.recentWeight - a.recentWeight || b.games - a.games)
    .slice(0, 40)
}

function createStyleBucket() {
  return {
    games: 0,
    recentWeight: 0,
    moveWeight: 0,
    results: { wins: 0, losses: 0, draws: 0 },
    motifs: {
      capture: 0,
      check: 0,
      castle: 0,
      pawnPush: 0,
      queenMove: 0,
      rookMove: 0,
      kingMove: 0,
      flankPawn: 0,
      center: 0,
      development: 0,
      earlyQueen: 0,
    },
    pieceDestinations: {},
    openingLines: {},
    pawnStructures: {},
    timeControls: {},
    endgame: {
      positions: 0,
      kingMoves: 0,
      pawnMoves: 0,
      captures: 0,
      checks: 0,
    },
  }
}

function pawnStructureSignature(game, playerColor) {
  const squares = []
  const board = game.board()
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank][file]
      if (piece?.type === 'p' && piece.color === playerColor) {
        squares.push(`${'abcdefgh'[file]}${8 - rank}`)
      }
    }
  }
  return squares.sort().join('-') || 'no-pawns'
}

function classifyTimeControl(timeControl = '') {
  const [baseText, incrementText = '0'] = timeControl.split('+')
  const base = Number(baseText)
  const increment = Number(incrementText)
  if (!Number.isFinite(base) || base <= 0) return 'unknown'
  const estimatedSeconds = base + Math.max(0, increment) * 40
  if (estimatedSeconds <= 180) return 'bullet'
  if (estimatedSeconds <= 600) return 'blitz'
  if (estimatedSeconds <= 1800) return 'rapid'
  return 'classical'
}

function topEntries(record, limit) {
  return Object.entries(record)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([key, weight]) => ({ key, weight: round(weight) }))
}

function increment(record, key, weight) {
  if (!key) return
  record[key] = (record[key] || 0) + weight
}

function countPieces(game) {
  return game.board().flat().filter(Boolean).length
}

function positionKey(game) {
  return game.fen().split(' ').slice(0, 4).join(' ')
}

function rate(value, total) {
  return total ? round(value / total) : 0
}

function round(value) {
  return Number((Number(value) || 0).toFixed(3))
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
        'User-Agent': 'play-bots-repertoire/2.0',
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
    headers: { 'User-Agent': 'play-bots-repertoire/2.0' },
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
