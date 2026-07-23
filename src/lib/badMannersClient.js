import { Chess } from 'chess.js'
import { isBishopKnightObjectiveReachable } from './coachEngine.js'

const DEFAULT_ENDPOINT = 'http://127.0.0.1:47818'
const BAD_MANNERS_PIECE_LIMIT = 12
const BAD_MANNERS_MIN_PLIES = 40

export function createBadMannersClient({
  fetchImpl = globalThis.fetch,
  endpoint = import.meta.env?.VITE_BAD_MANNERS_ENDPOINT || DEFAULT_ENDPOINT,
  timeoutMs = 9000,
} = {}) {
  const controllers = new Set()
  let generation = 0

  async function bestMoves(fen, options = {}) {
    if (typeof fetchImpl !== 'function' || !fen) return []
    const requestGeneration = generation
    const controller = new AbortController()
    controllers.add(controller)
    const timeout = setTimeout(() => controller.abort(), options.timeout || timeoutMs)
    const requestUrl = `${String(endpoint).replace(/\/+$/, '')}/bestmove`

    try {
      const response = await fetchImpl(requestUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          fen,
          options: {
            depth: options.depth,
            moveTime: options.moveTime,
            count: options.count,
            searchMoves: options.searchMoves,
          },
        }),
      })
      if (!response.ok || requestGeneration !== generation) return []
      const payload = await response.json()
      if (requestGeneration !== generation || !Array.isArray(payload.lines)) return []
      const seen = new Set()
      return payload.lines
        .filter((line) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(line?.uci || ''))
        .filter((line) => {
          if (seen.has(line.uci)) return false
          seen.add(line.uci)
          return true
        })
        .map((line, index) => ({
          uci: line.uci,
          score: Number.isFinite(line.score) ? line.score : null,
          mate: Number.isFinite(line.mate) ? line.mate : null,
          rank: Number(line.rank || index + 1),
          pv: Array.isArray(line.pv)
            ? line.pv.filter((move) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))
            : [line.uci],
          objectiveVerified: line.objectiveVerified === true,
          badManners: true,
        }))
    } catch {
      return []
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
    bestMoves,
    cancelAll,
    destroy: cancelAll,
  }
}

export function isBadMannersDecisionSafe(
  decision,
  {
    hasObjectiveMoves = false,
    exactPayloadAvailable = false,
    exactWinning = false,
    minimumScore = 120,
  } = {},
) {
  if (!decision?.move) return false
  if (exactPayloadAvailable) return exactWinning
  if (!hasObjectiveMoves) return true
  return decision.source === 'engine-objective' ||
    decision.source === 'engine-mate' ||
    Number.isFinite(decision.score) && decision.score >= minimumScore
}

export function shouldUseBadMannersTakeover(game, profile) {
  if (!game || !profile?.capabilities?.badMannersTakeover || game.isGameOver()) return false
  if (game.history().length < BAD_MANNERS_MIN_PLIES && countPieces(game) > BAD_MANNERS_PIECE_LIMIT) {
    return false
  }

  const side = game.turn()
  const own = materialCounts(game, side)
  const opponent = materialCounts(game, oppositeColor(side))
  const opponentBareKing = opponent.p + opponent.n + opponent.b + opponent.r + opponent.q === 0
  if (!opponentBareKing) return false
  return canBadMannersBareKing(own, game, side)
}

export function annotateBadMannersCandidates(game, candidates) {
  const objectiveMoves = new Set(badMannersSearchUcis(game))
  return candidates.map((candidate) => ({
    ...candidate,
    objectiveVerified: candidate.objectiveVerified === true || objectiveMoves.has(candidate.uci),
    badManners: true,
  }))
}

export function badMannersSearchUcis(game) {
  const side = game.turn()
  const opponent = materialCounts(game, oppositeColor(side))
  const opponentBareKing = opponent.p + opponent.n + opponent.b + opponent.r + opponent.q === 0
  if (opponentBareKing) return badMannersBareKingUcis(game)
  return []
}

function badMannersBareKingUcis(game) {
  const side = game.turn()
  const own = materialCounts(game, side)
  const opponent = materialCounts(game, oppositeColor(side))
  const opponentBareKing = opponent.p + opponent.n + opponent.b + opponent.r + opponent.q === 0
  if (!opponentBareKing || !isBishopKnightObjectiveReachable(game, side)) return []

  const hasPair = own.b >= 1 && own.n >= 1
  const needsBishop = own.b === 0 && own.n >= 1
  const needsKnight = own.n === 0 && own.b >= 1
  const candidates = game.moves({ verbose: true }).filter((move) => {
      if (move.color !== side) return false
      if (move.promotion) {
        if (needsBishop) return move.promotion === 'b'
        if (needsKnight) return move.promotion === 'n'
        return hasPair && ['b', 'n'].includes(move.promotion)
      }
      if (hasPair) return isSurplusPiece(own, move.piece)
      return move.piece === 'p'
    })
  if (hasPair) {
    const disposalMoves = candidates.filter((move) => surplusDisposalProgress(game, move))
    if (disposalMoves.length) return disposalMoves.map(moveToUci)
  }
  return candidates.map(moveToUci)
}

function surplusDisposalProgress(game, move) {
  const enemyKing = findKingSquare(game, oppositeColor(move.color))
  const after = new Chess(game.fen())
  after.move(move)
  const kingCanTake = after.moves({ verbose: true }).some((reply) =>
    reply.piece === 'k' && reply.to === move.to && Boolean(reply.captured))
  return kingCanTake || distance(move.to, enemyKing) <= 2 || move.san.includes('+')
}

function canBadMannersBareKing(own, game, side) {
  if (!isBishopKnightObjectiveReachable(game, side)) return false
  if (own.b >= 1 && own.n >= 1) return true
  return game.moves({ verbose: true }).some((move) =>
    move.color === side && (
      (own.b >= 1 && own.n === 0 && move.promotion === 'n') ||
      (own.n >= 1 && own.b === 0 && move.promotion === 'b')
    ),
  )
}

function countPieces(game) {
  return game.board().flat().filter(Boolean).length
}

function materialCounts(game, color) {
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

function oppositeColor(color) {
  return color === 'w' ? 'b' : 'w'
}

function findKingSquare(game, color) {
  return game.board().flat().find((piece) => piece?.color === color && piece.type === 'k')?.square || null
}

function distance(a, b) {
  if (!a || !b) return 0
  return Math.max(
    Math.abs(a.charCodeAt(0) - b.charCodeAt(0)),
    Math.abs(Number(a[1]) - Number(b[1])),
  )
}

function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}

export function gameFromFen(fen) {
  try {
    return new Chess(fen)
  } catch {
    return null
  }
}
