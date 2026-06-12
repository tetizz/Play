import { Chess } from 'chess.js'

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

  const objectiveMoves = preferBishopKnightObjective
    ? exactWins.filter(({ move }) => createsBishopKnightPair(game, move))
    : []
  const pool = objectiveMoves.length ? objectiveMoves : exactWins
  const selected = [...pool].sort(compareExactWins)[0]
  const line = tablebaseLine(selected, 1)
  const candidateLines = [...exactWins]
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
