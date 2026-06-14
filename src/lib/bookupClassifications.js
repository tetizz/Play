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

const BOOK_ALLOWED_KEYS = new Set(['best', 'excellent', 'good', 'inaccuracy'])
const CRITICAL_SECOND_LOSS = 0.08
const CRITICAL_CP_GAP = 90
const CRITICAL_WINNING_CP_GAP = 45
const CRITICAL_EQUAL_CP_GAP = 55
const CRITICAL_LOSING_FLOOR = -125
const BRILLIANT_MIN_PIECE_VALUE = PIECE_VALUES.n
const BEST_UNIQUENESS_THRESHOLD = 0.0005
const BEST_UNIQUENESS_CP_CEILING = 350
const BEST_EQUIVALENT_CP_GAP = 8

export const CLASSIFICATIONS = Object.freeze({
  brilliant: entry('Brilliant', '#26c6da', 'A sound near-best move with a verified material investment.'),
  great: entry('Great', '#39aeea', 'The only move that preserves the position’s advantage.'),
  best: entry('Best', '#80b64b', 'The engine’s first choice.'),
  excellent: entry('Excellent', '#96c75a', 'A strong move with almost no expected-points loss.'),
  good: entry('Good', '#c9bb82', 'A playable move with a more accurate option available.'),
  book: entry('Book', '#b38b63', 'A sound move from the selected bot’s repertoire.'),
  inaccuracy: entry('Inaccuracy', '#e1b24c', 'A small but meaningful loss of accuracy.'),
  mistake: entry('Mistake', '#e08335', 'A substantial change in the position.'),
  miss: entry('Miss', '#d99a36', 'A critical winning continuation was missed.'),
  blunder: entry('Blunder', '#d14b43', 'A decisive loss of expected points.'),
  forced: entry('Forced', '#80b64b', 'The position allowed only one legal move.'),
  unreviewed: {
    label: 'Unreviewed',
    color: '#858585',
    explanation: 'Stockfish did not return a reliable result for this move.',
    icon: null,
  },
})

export function expectedPointsFromScore(score, mate = null) {
  if (Number.isFinite(mate)) {
    if (mate === 0) return 0.5
    return mate > 0 ? 1 : 0
  }
  const cp = Math.max(-4000, Math.min(4000, Number(score) || 0))
  return 1 / (1 + Math.exp(-GRADIENT * cp))
}

export function accuracyFromExpectedPointsLoss(loss, classification = null) {
  if (['book', 'best', 'forced', 'great', 'brilliant'].includes(classification)) return 100
  if (!Number.isFinite(loss)) return null
  const winPercentLoss = Math.max(0, loss) * 100
  return roundTo(Math.max(
    0,
    Math.min(100, 103.1668 * Math.exp(-0.04354 * winPercentLoss) - 3.1669),
  ), 1)
}

export function classificationKeyFromLoss(loss, isBestMove = false) {
  return isBestMove ? 'best' : bandKey(Math.max(0, Number(loss) || 0))
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
  const playedUci = toUci(verboseMove)
  const bestExpected = expectedPointsFromRecord(bestLine)
  const moveExpected = expectedPointsFromRecord(playedLine)
  const loss = Math.max(0, bestExpected - moveExpected)
  const rank = findRank(candidateLines, playedUci)
  const isBest = Boolean(playedUci && sameUci(playedUci, bestLine?.uci))
  const secondLine = candidateLines.find((line) => Number(line.rank) === 2) || candidateLines[1] || null
  const secondLoss = secondLine
    ? Math.max(0, bestExpected - expectedPointsFromRecord(secondLine))
    : 0

  if (legalMoveCount <= 1) return payload('forced', loss, moveExpected, 'forced move')

  let key = classificationKeyFromLoss(loss, isBest)
  key = applyPracticalEdgeFloor(key, { bestLine, playedLine, loss, rank, openingPhase })
  key = applyBranchQualityFloor(key, { loss, rank, openingPhase })
  key = promoteNearBest(key, { bestLine, playedLine, rank })
  key = applyLowerRankExcellentFloor(key, { bestLine, playedLine, loss, rank })

  if (
    key === 'best' &&
    secondLine &&
    secondLoss <= BEST_UNIQUENESS_THRESHOLD &&
    scoreType(bestLine) === 'centipawn' &&
    Math.abs(scoreValue(bestLine)) <= BEST_UNIQUENESS_CP_CEILING
  ) {
    key = 'excellent'
  }

  const after = new Chess(beforeFen)
  if (verboseMove) after.move(verboseMove)
  const isDirectMate = after.isCheckmate()
  if (isDirectMate) return payload('best', loss, moveExpected, 'engine top move')

  let isOnlyMoveThatKeepsAdvantage = false
  if (
    isBest &&
    isCriticalCandidate(game, verboseMove, playedLine, secondLine) &&
    isCriticalSeparation(bestLine, secondLine, secondLoss, verboseMove)
  ) {
    key = 'great'
    isOnlyMoveThatKeepsAdvantage = true
  }

  const givesCheck = after.inCheck()
  const topCandidate = Number.isFinite(rank) && rank <= 3 && loss <= 0.05
  const couldBeBrilliant = (
    moveExpected >= 0.45 &&
    (isBest || loss <= (givesCheck ? 0.07 : 0.02) || topCandidate)
  )
  if (couldBeBrilliant && verifySacrifice(new Chess(beforeFen), verboseMove, playedLine?.pv || [])) {
    return {
      ...payload('brilliant', loss, moveExpected, 'best or nearly-best move plus a good piece sacrifice'),
      isRealPieceSacrifice: true,
    }
  }

  if (openingPhase && inBook && BOOK_ALLOWED_KEYS.has(key)) {
    return payload('book', loss, moveExpected, 'opening book move')
  }

  const bestWasCritical = (
    secondLine &&
    isCriticalCandidate(game, resolveMove(game, bestLine?.uci), bestLine, secondLine) &&
    isCriticalSeparation(
      bestLine,
      secondLine,
      secondLoss,
      resolveMove(game, bestLine?.uci),
    )
  )
  if (
    isPlayerMove &&
    !isBest &&
    bestExpected >= 0.78 &&
    moveExpected <= 0.55 &&
    loss >= 0.08 &&
    bestWasCritical
  ) {
    return payload('miss', loss, moveExpected, 'misses the critical continuation')
  }

  return {
    ...payload(
      key,
      loss,
      moveExpected,
      isOnlyMoveThatKeepsAdvantage
        ? 'only move that keeps the advantage'
        : reasonFor(key),
    ),
    ...(isOnlyMoveThatKeepsAdvantage ? { isOnlyMoveThatKeepsAdvantage: true } : {}),
  }
}

export function verifySacrifice(game, move, pv = []) {
  if (!move || move.piece === 'k') return false
  const mover = move.color
  const movedValue = PIECE_VALUES[move.piece] || 0
  if (movedValue < BRILLIANT_MIN_PIECE_VALUE) return false

  const beforeBalance = materialBalance(game, mover)
  const investment = Math.max(0, -staticExchangeEval(game, move))
  if (investment < 100) return false

  game.move(move)
  const afterBalance = materialBalance(game, mover)
  const lineGame = new Chess(game.fen())
  const continuation = pv[0] && sameUci(pv[0], toUci(move)) ? pv.slice(1) : pv
  let minimumBalance = afterBalance
  let finalBalance = afterBalance
  let replyTakesInvestment = false
  let promotionAfterAcceptance = false
  for (const uci of continuation.slice(0, 8)) {
    const next = resolveMove(lineGame, uci)
    if (!next) break
    if (
      lineGame.turn() !== mover &&
      next.to === move.to &&
      next.captured === move.piece
    ) {
      replyTakesInvestment = true
    } else if (replyTakesInvestment && lineGame.turn() === mover && next.promotion) {
      promotionAfterAcceptance = true
    }
    lineGame.move(next)
    finalBalance = materialBalance(lineGame, mover)
    minimumBalance = Math.min(minimumBalance, finalBalance)
  }
  const materialSwing = finalBalance - minimumBalance
  const highValueThreat = boardSquares().some((square) => {
    const target = game.get(square)
    return target &&
      target.color !== mover &&
      (PIECE_VALUES[target.type] || 0) > movedValue &&
      pieceAttacksSquare(game, move.to, move.piece, square, mover)
  })
  const forcingCompensation = (
    game.inCheck() ||
    highValueThreat ||
    promotionAfterAcceptance ||
    materialSwing >= 100
  )
  const toleratedDeficit = -(investment + PIECE_VALUES.b)
  return (
    replyTakesInvestment &&
    beforeBalance - minimumBalance >= investment &&
    finalBalance - beforeBalance >= toleratedDeficit &&
    forcingCompensation
  )
}

function applyPracticalEdgeFloor(key, { bestLine, playedLine, loss, rank, openingPhase }) {
  if (!['excellent', 'good'].includes(key) || openingPhase) return key
  if (!Number.isFinite(rank) || rank <= 1 || rank > 5) return key
  if (scoreType(bestLine) !== 'centipawn' || scoreType(playedLine) !== 'centipawn') return key
  const bestCp = scoreValue(bestLine)
  const cpDrop = bestCp - scoreValue(playedLine)
  if (cpDrop < 25 || loss < 0.045 || Math.abs(bestCp) > 120) return key
  return 'inaccuracy'
}

function applyBranchQualityFloor(key, { loss, rank, openingPhase }) {
  if (Number.isFinite(rank)) return key
  const excellentFloor = openingPhase ? 0.012 : 0.008
  const goodFloor = openingPhase ? 0.05 : 0.04
  const inaccuracyFloor = openingPhase ? 0.13 : 0.11
  if (key === 'excellent' && loss >= excellentFloor) return 'good'
  if (key === 'good' && loss >= goodFloor) return 'inaccuracy'
  if (key === 'inaccuracy' && loss >= inaccuracyFloor) return 'mistake'
  return key
}

function promoteNearBest(key, { bestLine, playedLine, rank }) {
  if (!['excellent', 'good'].includes(key)) return key
  if (Number.isFinite(rank) && rank > 3) return key
  if (recordsAreEffectivelyTied(bestLine, playedLine)) return 'best'
  if (
    key === 'good' &&
    Number.isFinite(rank) &&
    rank <= 2 &&
    scoreType(bestLine) === 'centipawn' &&
    scoreType(playedLine) === 'centipawn' &&
    Math.abs(scoreValue(bestLine) - scoreValue(playedLine)) <= 18
  ) {
    return 'excellent'
  }
  return key
}

function applyLowerRankExcellentFloor(key, { bestLine, playedLine, loss, rank }) {
  if (key !== 'excellent' || !Number.isFinite(rank) || rank < 5 || loss < 0.012) return key
  if (scoreType(bestLine) !== 'centipawn' || scoreType(playedLine) !== 'centipawn') return key
  return Math.abs(scoreValue(bestLine) - scoreValue(playedLine)) >= 15 ? 'good' : key
}

function isCriticalCandidate(game, move, moveLine, secondLine) {
  if (!move || !secondLine) return false
  if (move.promotion === 'q') return false
  if (
    scoreType(moveLine) === 'centipawn' &&
    scoreValue(moveLine) < CRITICAL_LOSING_FLOOR
  ) return false
  if (scoreType(secondLine) === 'centipawn' && scoreValue(secondLine) >= 700) return false
  if (move.captured && !capturedPieceWasSafe(game, move)) return false
  return true
}

function isCriticalSeparation(bestLine, secondLine, secondLoss, move = null) {
  if (!secondLine) return false
  if (secondLoss >= CRITICAL_SECOND_LOSS) return true

  const bestType = scoreType(bestLine)
  const secondType = scoreType(secondLine)
  if (bestType === 'mate') {
    return scoreValue(bestLine) > 0 && (
      secondType !== 'mate' ||
      scoreValue(secondLine) <= 0
    )
  }
  if (bestType !== 'centipawn' || secondType !== 'centipawn') return false
  const bestScore = scoreValue(bestLine)
  const gap = bestScore - scoreValue(secondLine)
  if (gap >= CRITICAL_CP_GAP) return true
  if (bestScore > 0 && gap >= CRITICAL_WINNING_CP_GAP) return true
  return bestScore === 0 && (
    gap >= CRITICAL_EQUAL_CP_GAP ||
    (gap >= CRITICAL_WINNING_CP_GAP && move?.san?.includes('+'))
  )
}

function capturedPieceWasSafe(game, move) {
  const capturedValue = PIECE_VALUES[move.captured] || 0
  const attackers = game.moves({ verbose: true }).filter((candidate) =>
    candidate.to === move.to && candidate.captured === move.captured,
  )
  if (!attackers.length) return true
  if (attackers.some((candidate) => (PIECE_VALUES[candidate.piece] || 0) < capturedValue)) {
    return false
  }

  let smallestDefenderSet = null
  for (const attacker of attackers) {
    const afterCapture = new Chess(game.fen())
    afterCapture.move(attacker)
    const defenders = afterCapture.moves({ verbose: true }).filter((reply) =>
      reply.to === move.to && reply.captured === attacker.piece,
    )
    if (smallestDefenderSet === null || defenders.length < smallestDefenderSet.length) {
      smallestDefenderSet = defenders
    }
  }
  const defenders = smallestDefenderSet || []
  if (attackers.length <= defenders.length) return true

  const lowestAttackerValue = Math.min(
    ...attackers.map((candidate) => PIECE_VALUES[candidate.piece] || 0),
  )
  if (
    capturedValue < lowestAttackerValue &&
    defenders.some((reply) => (PIECE_VALUES[reply.piece] || 0) < lowestAttackerValue)
  ) {
    return true
  }
  return defenders.some((reply) => reply.piece === 'p')
}

function recordsAreEffectivelyTied(first, second) {
  if (!first || !second || scoreType(first) !== scoreType(second)) return false
  const firstValue = scoreValue(first)
  const secondValue = scoreValue(second)
  if (scoreType(first) === 'mate') {
    return (firstValue > 0) === (secondValue > 0) && Math.abs(firstValue - secondValue) <= 1
  }
  return Math.abs(firstValue - secondValue) <= BEST_EQUIVALENT_CP_GAP
}

function expectedPointsFromRecord(record) {
  return expectedPointsFromScore(record?.score, record?.mate)
}

function scoreType(record) {
  return Number.isFinite(record?.mate) ? 'mate' : 'centipawn'
}

function scoreValue(record) {
  return scoreType(record) === 'mate'
    ? Number(record?.mate || 0)
    : Number(record?.score || 0)
}

function bandKey(loss) {
  return BANDS.find(([, maximum]) => loss <= maximum)?.[0] || 'blunder'
}

function payload(key, loss, expectedPoints, reason = '') {
  return {
    key,
    ...CLASSIFICATIONS[key],
    expectedPointsLoss: roundTo(loss, 4),
    expectedPoints: roundTo(expectedPoints, 4),
    reason,
  }
}

function reasonFor(key) {
  return {
    best: 'engine top move',
    excellent: 'very close to best',
    good: 'solid but slightly below best',
    inaccuracy: 'small drop',
    mistake: 'meaningful drop',
    blunder: 'large drop',
  }[key] || CLASSIFICATIONS[key]?.explanation || ''
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

function findRank(lines, moveUci) {
  return lines.find((line) => sameUci(line.uci, moveUci))?.rank || null
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

function staticExchangeEval(game, move) {
  const capturedValue = PIECE_VALUES[move.captured] || 0
  const after = new Chess(game.fen())
  after.move(move)
  const opponentGain = staticExchangeGain(after, move.to, oppositeColor(move.color))
  return capturedValue - Math.max(0, opponentGain)
}

function staticExchangeGain(game, square, color, depth = 0) {
  if (depth > 16) return 0
  const probe = gameWithTurn(game, color)
  const victim = probe.get(square)
  if (!victim || victim.color === color || victim.type === 'k') return 0

  const captures = probe.moves({ verbose: true })
    .filter((candidate) => candidate.to === square && candidate.captured)
    .sort((first, second) =>
      (PIECE_VALUES[first.piece] || 0) - (PIECE_VALUES[second.piece] || 0),
    )
  let bestGain = 0
  for (const capture of captures) {
    const reply = new Chess(probe.fen())
    reply.move(capture)
    const replyGain = staticExchangeGain(reply, square, oppositeColor(color), depth + 1)
    bestGain = Math.max(
      bestGain,
      (PIECE_VALUES[victim.type] || 0) - Math.max(0, replyGain),
    )
  }
  return bestGain
}

function gameWithTurn(game, color) {
  const parts = game.fen().split(' ')
  parts[1] = color
  return new Chess(parts.join(' '))
}

function oppositeColor(color) {
  return color === 'w' ? 'b' : 'w'
}

function boardSquares() {
  const squares = []
  for (const file of 'abcdefgh') {
    for (const rank of '12345678') squares.push(`${file}${rank}`)
  }
  return squares
}

function pieceAttacksSquare(game, from, piece, to, color) {
  const fromFile = from.charCodeAt(0) - 97
  const fromRank = Number(from[1]) - 1
  const toFile = to.charCodeAt(0) - 97
  const toRank = Number(to[1]) - 1
  const fileDelta = toFile - fromFile
  const rankDelta = toRank - fromRank
  const absFile = Math.abs(fileDelta)
  const absRank = Math.abs(rankDelta)
  if (piece === 'n') return absFile * absRank === 2
  if (piece === 'p') return absFile === 1 && rankDelta === (color === 'w' ? 1 : -1)
  if (piece === 'k') return Math.max(absFile, absRank) === 1
  const diagonal = absFile === absRank
  const straight = fileDelta === 0 || rankDelta === 0
  if (piece === 'b' && !diagonal) return false
  if (piece === 'r' && !straight) return false
  if (piece === 'q' && !diagonal && !straight) return false
  const steps = Math.max(absFile, absRank)
  const fileStep = Math.sign(fileDelta)
  const rankStep = Math.sign(rankDelta)
  for (let step = 1; step < steps; step += 1) {
    const square = `${String.fromCharCode(97 + fromFile + fileStep * step)}${fromRank + rankStep * step + 1}`
    if (game.get(square)) return false
  }
  return true
}

function roundTo(value, places) {
  if (!Number.isFinite(value)) return value
  const multiplier = 10 ** places
  return Math.round(value * multiplier) / multiplier
}
