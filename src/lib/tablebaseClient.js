import { Chess } from 'chess.js'
import { isBishopKnightObjectiveReachable } from './coachEngine.js'

const TABLEBASE_ENDPOINT = 'https://tablebase.lichess.ovh/standard'
const EXACT_WIN = 'win'
const EXACT_LOSS = 'loss'

export function createTablebaseClient({
  fetchImpl = globalThis.fetch,
  endpoint = TABLEBASE_ENDPOINT,
  timeoutMs = 2400,
} = {}) {
  const cache = new Map()
  const controllers = new Set()
  let generation = 0

  async function probe(fen) {
    if (!isTablebaseEligible(fen) || typeof fetchImpl !== 'function') return null
    if (cache.has(fen)) return cache.get(fen)

    const requestGeneration = generation
    const controller = new AbortController()
    controllers.add(controller)
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const url = new URL(endpoint)
      url.searchParams.set('fen', fen)
      const response = await fetchImpl(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (!response.ok || requestGeneration !== generation) return null
      const payload = await response.json()
      if (requestGeneration !== generation) return null
      cache.set(fen, payload)
      return payload
    } catch {
      return null
    } finally {
      clearTimeout(timeout)
      controllers.delete(controller)
    }
  }

  function cancelAll() {
    generation += 1
    controllers.forEach((controller) => controller.abort())
    controllers.clear()
  }

  return {
    probe,
    cancelAll,
    destroy: cancelAll,
  }
}

export function isTablebaseEligible(fen) {
  if (typeof fen !== 'string') return false
  const [board, , castling] = fen.trim().split(/\s+/)
  if (!board || castling !== '-') return false
  const pieceCount = [...board].filter((token) => /[prnbqk]/i.test(token)).length
  return pieceCount >= 2 && pieceCount <= 7
}

export function selectTablebaseDecision(
  game,
  payload,
  { preferBishopKnightObjective = false } = {},
) {
  if (
    !game ||
    payload?.category !== EXACT_WIN ||
    !Array.isArray(payload.moves)
  ) {
    return null
  }

  const legalMoves = new Map(
    game.moves({ verbose: true }).map((move) => [moveToUci(move), move]),
  )
  const exactWins = payload.moves.flatMap((record) => {
    const move = legalMoves.get(record.uci)
    if (!move || record.category !== EXACT_LOSS) return []
    return [{ move, record }]
  })
  if (!exactWins.length) return null
  const filterNonPureMate = preferBishopKnightObjective &&
    isBishopKnightObjectiveReachable(game, game.turn())
  const allowedWins = filterNonPureMate
    ? exactWins.filter(({ move, record }) => !isForbiddenNonPureMate(game, move, record))
    : exactWins
  const candidateWins = allowedWins.length ? allowedWins : exactWins

  const objectiveMoves = preferBishopKnightObjective
    ? candidateWins.filter(({ move }) => objectivePriority(game, move) > 0)
    : []
  const pool = objectiveMoves.length ? objectiveMoves : candidateWins
  const selected = [...pool].sort((a, b) => {
    if (objectiveMoves.length) {
      const priorityDifference = objectivePriority(game, b.move) - objectivePriority(game, a.move)
      if (priorityDifference) return priorityDifference
    }
    return compareExactWins(a, b)
  })[0]
  const line = tablebaseLine(selected, 1)
  const candidateLines = [...candidateWins]
    .sort(compareExactWins)
    .map((entry, index) => tablebaseLine(entry, index + 1))

  return {
    move: selected.move,
    source: objectiveMoves.length ? 'tablebase-objective' : 'tablebase-mate',
    score: line.score,
    rank: 1,
    line,
    bestLine: line,
    candidateLines,
    exact: true,
  }
}

export function isExactWinningMove(payload, uci) {
  return payload?.category === EXACT_WIN &&
    Array.isArray(payload.moves) &&
    payload.moves.some((record) => record.uci === uci && record.category === EXACT_LOSS)
}

function isForbiddenNonPureMate(game, move, record) {
  if (!record.checkmate) return false
  const after = new Chess(game.fen())
  after.move(move)
  return !isPureBishopKnightMatePosition(after, move.color)
}

function isPureBishopKnightMatePosition(game, color) {
  if (!game.isCheckmate()) return false
  const own = fullMaterialCounts(game, color)
  const opponent = fullMaterialCounts(game, color === 'w' ? 'b' : 'w')
  const ownMaterial = own.p + own.n + own.b + own.r + own.q
  const opponentMaterial = opponent.p + opponent.n + opponent.b + opponent.r + opponent.q
  return own.b === 1 && own.n === 1 && ownMaterial === 2 && opponentMaterial === 0
}

function compareExactWins(a, b) {
  if (a.record.checkmate !== b.record.checkmate) return a.record.checkmate ? -1 : 1
  const mateDifference = distance(a.record.dtm) - distance(b.record.dtm)
  if (mateDifference) return mateDifference
  const zeroingDifference = Number(b.record.zeroing) - Number(a.record.zeroing)
  if (zeroingDifference) return zeroingDifference
  const dtzDifference = distance(a.record.precise_dtz ?? a.record.dtz) -
    distance(b.record.precise_dtz ?? b.record.dtz)
  if (dtzDifference) return dtzDifference
  return a.record.uci.localeCompare(b.record.uci)
}

function tablebaseLine({ move, record }, rank) {
  const matePlies = distance(record.dtm)
  const mate = Number.isFinite(matePlies) ? Math.max(1, Math.ceil(matePlies / 2)) : null
  return {
    uci: record.uci,
    score: Number.isFinite(matePlies) ? 100000 - matePlies : 99000,
    mate,
    rank,
    pv: [record.uci],
    dtm: record.dtm ?? null,
    dtz: record.precise_dtz ?? record.dtz ?? null,
    tablebase: true,
    move,
  }
}

function createsBishopKnightPair(game, move) {
  if (!['b', 'n'].includes(move.promotion)) return false
  const before = materialCounts(game, move.color)
  if (before.b > 0 && before.n > 0) return false
  const after = new Chess(game.fen())
  after.move(move)
  const counts = materialCounts(after, move.color)
  return counts.b > 0 && counts.n > 0
}

function objectivePriority(game, move) {
  const before = fullMaterialCounts(game, move.color)
  const opponent = fullMaterialCounts(game, move.color === 'w' ? 'b' : 'w')
  const opponentBareKing = opponent.p + opponent.n + opponent.b + opponent.r + opponent.q === 0
  if (!opponentBareKing) return 0
  if (!isBishopKnightObjectiveReachable(game, move.color)) return 0

  const after = new Chess(game.fen())
  after.move(move)
  if (after.isGameOver()) return 0
  if (!isBishopKnightObjectiveReachable(after, move.color)) return 0
  if (move.promotion && !['b', 'n'].includes(move.promotion)) return 0
  if (before.b < 1 || before.n < 1) {
    if (createsBishopKnightPair(game, move)) return 20000
    const canBuildPair = before.p >= 2 ||
      (before.p >= 1 && (before.b >= 1 || before.n >= 1))
    if (canBuildPair && move.piece === 'p') {
      const advance = move.color === 'w'
        ? Number(move.to[1]) - Number(move.from[1])
        : Number(move.from[1]) - Number(move.to[1])
      return 6000 + advance * 200
    }
    return 0
  }
  if (!isSurplusPiece(before, move.piece)) return 0
  const capturableByKing = after.moves({ verbose: true }).some((reply) =>
    reply.piece === 'k' && reply.to === move.to && Boolean(reply.captured),
  )
  const kingSquare = findKingSquare(game, move.color === 'w' ? 'b' : 'w')
  const distanceGain = kingSquare
    ? squareDistance(move.from, kingSquare) - squareDistance(move.to, kingSquare)
    : 0
  return (capturableByKing ? 15000 : 9000) + pieceValue(move.piece) + distanceGain * 120
}

function fullMaterialCounts(game, color) {
  const counts = { p: 0, n: 0, b: 0, r: 0, q: 0 }
  for (const piece of game.board().flat()) {
    if (piece?.color === color && piece.type in counts) counts[piece.type] += 1
  }
  return counts
}

function isSurplusPiece(counts, type) {
  if (['p', 'q', 'r'].includes(type)) return counts[type] > 0
  if (type === 'b') return counts.b > 1
  if (type === 'n') return counts.n > 1
  return false
}

function pieceValue(type) {
  return { p: 100, n: 320, b: 330, r: 500, q: 900 }[type] || 0
}

function findKingSquare(game, color) {
  return game.board().flat().find((piece) => piece?.color === color && piece.type === 'k')?.square || null
}

function squareDistance(a, b) {
  return Math.max(
    Math.abs(a.charCodeAt(0) - b.charCodeAt(0)),
    Math.abs(Number(a[1]) - Number(b[1])),
  )
}

function materialCounts(game, color) {
  const counts = { b: 0, n: 0 }
  for (const piece of game.board().flat()) {
    if (piece?.color === color && piece.type in counts) counts[piece.type] += 1
  }
  return counts
}

function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}

function distance(value) {
  return Number.isFinite(value) ? Math.abs(value) : Number.POSITIVE_INFINITY
}
