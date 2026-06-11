import { Chess } from 'chess.js'

// Browser port of tetizz/Bookup's GPL-3.0 classification policy.
const GRADIENT = 0.0035
const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
const BANDS = [
  ['excellent', 0.02],
  ['good', 0.05],
  ['inaccuracy', 0.10],
  ['mistake', 0.20],
  ['blunder', 1],
]

export const CLASSIFICATIONS = Object.freeze({
  brilliant: entry('Brilliant', '#26c6da', 'A sound near-best move with a verified material investment.'),
  great: entry('Great', '#39aeea', 'A uniquely strong move that keeps the position together.'),
  best: entry('Best', '#80b64b', 'The engine’s first choice.'),
  excellent: entry('Excellent', '#96c75a', 'A strong move with almost no expected-points loss.'),
  good: entry('Good', '#c9bb82', 'A playable move with a more accurate option available.'),
  book: entry('Book', '#b38b63', 'A sound move from the selected bot’s repertoire.'),
  inaccuracy: entry('Inaccuracy', '#e1b24c', 'A small but meaningful loss of accuracy.'),
  mistake: entry('Mistake', '#e08335', 'A substantial change in the position.'),
  miss: entry('Miss', '#d99a36', 'A critical winning continuation was missed.'),
  blunder: entry('Blunder', '#d14b43', 'A decisive loss of expected points.'),
  forced: entry('Forced', '#80b64b', 'The position allowed only one legal move.'),
})

export function expectedPointsFromScore(score, mate = null) {
  if (mate !== null && mate !== undefined) return mate > 0 ? 1 : 0
  const cp = Math.max(-4000, Math.min(4000, Number(score) || 0))
  return 1 / (1 + Math.exp(-GRADIENT * cp))
}

export function classifyMove({
  beforeFen,
  move,
  bestLine,
  playedLine,
  candidateLines = [],
  legalMoveCount,
  openingPhase = false,
  inBook = false,
  isPlayerMove = true,
}) {
  const game = new Chess(beforeFen)
  const verboseMove = resolveMove(game, move)
  const bestExpected = expectedPointsFromScore(bestLine?.score, bestLine?.mate)
  const moveExpected = expectedPointsFromScore(playedLine?.score, playedLine?.mate)
  const loss = Math.max(0, bestExpected - moveExpected)
  const scoreGap = scoreDifference(bestLine?.score, playedLine?.score)
  const rank = playedLine?.rank || findRank(candidateLines, move) || null
  const isBest = sameUci(toUci(verboseMove), bestLine?.uci)
  let key = isBest ? 'best' : bandKey(loss)

  if (legalMoveCount <= 1) return payload('forced', loss, moveExpected)
  key = applyPracticalFloors(key, { loss, scoreGap, rank })
  if (openingPhase && inBook && ['best', 'excellent', 'good', 'inaccuracy'].includes(key)) {
    return payload('book', loss, moveExpected)
  }

  const secondLine = candidateLines.find((line) => line.rank === 2)
  const secondExpected = expectedPointsFromScore(secondLine?.score, secondLine?.mate)
  const uniqueBest = isBest && bestExpected - secondExpected >= 0.025
  const after = new Chess(beforeFen)
  if (verboseMove) after.move(verboseMove)
  const isDirectMate = after.isCheckmate()

  if (!isDirectMate && couldBeBrilliant({ isBest, loss, rank, bestExpected, moveExpected })) {
    const sacrifice = verifySacrifice(new Chess(beforeFen), verboseMove, playedLine?.pv || [])
    if (sacrifice) {
      return {
        ...payload('brilliant', loss, moveExpected),
        isRealPieceSacrifice: true,
      }
    }
  }

  if (
    isPlayerMove &&
    !isBest &&
    bestExpected >= 0.78 &&
    moveExpected <= 0.55 &&
    loss >= 0.08 &&
    (uniqueBest || bestExpected - secondExpected >= 0.04)
  ) {
    return payload('miss', loss, moveExpected)
  }
  if (isDirectMate) return payload('best', loss, moveExpected)
  if (uniqueBest && bestExpected >= 0.53 && loss <= 0.02) return payload('great', loss, moveExpected)
  return payload(key, loss, moveExpected)
}

export function verifySacrifice(game, move, pv = []) {
  if (!move) return false
  const mover = move.color
  const beforeBalance = materialBalance(game, mover)
  const movedValue = PIECE_VALUES[move.piece]
  const capturedValue = PIECE_VALUES[move.captured] || 0
  game.move(move)
  const afterBalance = materialBalance(game, mover)
  const attacked = game.moves({ verbose: true }).some((reply) =>
    reply.to === move.to && (PIECE_VALUES[reply.captured] || 0) >= movedValue,
  )
  const immediateInvestment = beforeBalance - afterBalance >= 100 || attacked && movedValue - capturedValue >= 100
  if (!immediateInvestment) return false

  const lineGame = new Chess(game.fen())
  let minimumBalance = afterBalance
  let confirmedReply = false
  for (const uci of pv.slice(1, 7)) {
    const next = resolveMove(lineGame, uci)
    if (!next) break
    if (next.to === move.to && next.captured) confirmedReply = true
    lineGame.move(next)
    minimumBalance = Math.min(minimumBalance, materialBalance(lineGame, mover))
  }
  return confirmedReply && beforeBalance - minimumBalance >= 100
}

function applyPracticalFloors(key, { loss, scoreGap, rank }) {
  if (rank && rank <= 5 && scoreGap >= 25 && scoreGap <= 120 && loss >= 0.045) return 'inaccuracy'
  if (key === 'excellent' && rank && rank >= 5 && loss >= 0.012 && scoreGap >= 15) return 'good'
  return key
}

function couldBeBrilliant({ isBest, loss, rank, bestExpected, moveExpected }) {
  return moveExpected >= 0.45 &&
    bestExpected < 0.90 &&
    (isBest || loss <= 0.02 || (rank && rank <= 3 && loss <= 0.05))
}

function bandKey(loss) {
  return BANDS.find(([, maximum]) => loss <= maximum)?.[0] || 'blunder'
}

function payload(key, loss, expectedPoints) {
  return {
    key,
    ...CLASSIFICATIONS[key],
    expectedPointsLoss: round(loss),
    expectedPoints: round(expectedPoints),
  }
}

function entry(label, color, explanation) {
  return {
    label,
    color,
    explanation,
    icon: `./assets/move-classifications/${label === 'Forced' ? 'best' : label.toLowerCase()}.png`,
  }
}

function resolveMove(game, move) {
  if (!move) return null
  if (typeof move === 'object' && move.from && move.to) {
    return game.moves({ verbose: true }).find((candidate) =>
      candidate.from === move.from &&
      candidate.to === move.to &&
      (!move.promotion || candidate.promotion === move.promotion),
    ) || null
  }
  const text = String(move)
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(text)) {
    return game.moves({ verbose: true }).find((candidate) => sameUci(toUci(candidate), text)) || null
  }
  return game.moves({ verbose: true }).find((candidate) => candidate.san === text) || null
}

function toUci(move) {
  return move ? `${move.from}${move.to}${move.promotion || ''}` : ''
}

function sameUci(a, b) {
  return String(a || '') === String(b || '')
}

function findRank(lines, move) {
  const gameMove = typeof move === 'string' ? move : toUci(move)
  return lines.find((line) => sameUci(line.uci, gameMove))?.rank || null
}

function scoreDifference(best, played) {
  if (!Number.isFinite(best) || !Number.isFinite(played)) return 0
  return Math.max(0, best - played)
}

function materialBalance(game, color) {
  let total = 0
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue
      total += (piece.color === color ? 1 : -1) * PIECE_VALUES[piece.type]
    }
  }
  return total
}

function round(value) {
  return Math.round(value * 10000) / 10000
}
