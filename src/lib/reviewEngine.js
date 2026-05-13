import { Chess } from 'chess.js'
import { OPENING_BOOK } from '../data/openingBook'

const values = { p: 100, n: 315, b: 330, r: 500, q: 900, k: 0 }
const EXPECTED_POINTS_GRADIENT = 0.0035
const MAX_STOCKFISH_REVIEW_PLIES = 48
const classificationData = {
  book: {
    label: 'Book',
    icon: './assets/move-classifications/book.png',
    color: '#b68b5d',
    note: 'Known opening theory or repertoire memory.',
  },
  brilliant: {
    label: 'Brilliant',
    icon: './assets/move-classifications/brilliant.png',
    color: '#25c7d9',
    note: 'A tactical move that wins material or creates a decisive forcing line.',
  },
  great: {
    label: 'Great',
    icon: './assets/move-classifications/great.png',
    color: '#37b6ff',
    note: 'A forcing accurate move that keeps serious pressure.',
  },
  best: {
    label: 'Best',
    icon: './assets/move-classifications/best.png',
    color: '#83c84a',
    note: 'Engine-approved and clean.',
  },
  excellent: {
    label: 'Excellent',
    icon: './assets/move-classifications/excellent.png',
    color: '#95d35b',
    note: 'A strong practical move with almost no evaluation loss.',
  },
  good: {
    label: 'Good',
    icon: './assets/move-classifications/good.png',
    color: '#f1c75b',
    note: 'Playable, but there was a more precise continuation.',
  },
  inaccuracy: {
    label: 'Inaccuracy',
    icon: './assets/move-classifications/inaccuracy.png',
    color: '#f0a13a',
    note: 'A small drift. Check the candidate move order here.',
  },
  mistake: {
    label: 'Mistake',
    icon: './assets/move-classifications/mistake.png',
    color: '#e26b35',
    note: 'The position changed enough that calculation should slow down.',
  },
  blunder: {
    label: 'Blunder',
    icon: './assets/move-classifications/blunder.png',
    color: '#d93a32',
    note: 'This gives away too much. Look for checks, captures, and threats first.',
  },
  miss: {
    label: 'Miss',
    icon: './assets/move-classifications/miss.png',
    color: '#d9912b',
    note: 'Fails to convert the stronger continuation.',
  },
  forced: {
    label: 'Forced',
    icon: './assets/move-classifications/best.png',
    color: '#83c84a',
    note: 'Only move or forced response.',
  },
}

export function reviewGame(history) {
  const game = new Chess()
  const moments = []
  let previous = evaluateForSide(game, 'w')

  history.forEach((san, index) => {
    const side = game.turn()
    const move = game.move(san)
    if (!move) return
    const current = evaluateForSide(game, side)
    const swing = current - previous
    if (swing < -180) {
      moments.push({
        move: index + 1,
        san,
        ...classificationForKey(swing < -420 ? 'blunder' : 'mistake'),
        note: `${san} changed the evaluation sharply. Look for forcing replies before committing.`,
      })
    } else if (move.san.includes('#')) {
      moments.push({
        move: index + 1,
        san,
        ...classificationForKey('best'),
        note: `${san} ended the game by force.`,
      })
    } else if (move.san.includes('+')) {
      moments.push({
        move: index + 1,
        san,
        ...classificationForKey('great'),
        note: `${san} forced the king to respond. Always check the follow-up.`,
      })
    } else if (move.captured) {
      moments.push({
        move: index + 1,
        san,
        ...classificationForKey('great'),
        note: `${san} is forcing. Check the candidate moves and count material after the sequence.`,
      })
    }
    previous = -evaluateForSide(game, game.turn())
  })

  return moments.slice(-5).reverse()
}

export async function reviewGameWithStockfish(history, evaluateFen) {
  if (!history.length || !evaluateFen) return buildFallbackFinalReview(history)

  const game = new Chess()
  const moments = []
  let accuracyTotal = 0
  let reviewedMoves = 0

  for (let index = 0; index < history.length; index += 1) {
    const san = history[index]
    const beforeFen = game.fen()
    const legalMoveCount = game.moves().length
    const bookKey = game.history().join(' ')
    const isBookMove = Boolean(OPENING_BOOK[bookKey]?.some((option) =>
      (typeof option === 'string' ? option : option.san) === san,
    ))
    const beforeScore = index < MAX_STOCKFISH_REVIEW_PLIES
      ? await safeEvaluate(evaluateFen, beforeFen, { depth: 6, moveTime: 180 })
      : null
    const side = game.turn()
    const move = game.move(san)
    if (!move) continue

    const afterScore = index < MAX_STOCKFISH_REVIEW_PLIES
      ? await safeEvaluate(evaluateFen, game.fen(), { depth: 6, moveTime: 180 })
      : null
    if (typeof beforeScore !== 'number' || typeof afterScore !== 'number') {
      moments.push(fallbackMoment(move, index))
      continue
    }

    const moverBefore = beforeScore
    const moverAfter = -afterScore
    const loss = Math.max(0, moverBefore - moverAfter)
    const expectedLoss = expectedPointsFromCp(moverBefore) - expectedPointsFromCp(moverAfter)
    const classification = classifyLoss(expectedLoss, move, index, legalMoveCount, isBookMove, expectedPointsFromCp(moverBefore))
    const accuracy = accuracyFromLoss(loss)
    accuracyTotal += accuracy
    reviewedMoves += 1

    moments.push({
      move: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      san,
      side,
      ...classification,
      scoreLoss: loss,
      expectedPointsLoss: expectedLoss,
    })
  }

  const completedWithStockfish = reviewedMoves > 0
  const counts = buildClassificationCounts(moments)
  return {
    complete: true,
    engine: completedWithStockfish ? 'Stockfish 18' : 'JS fallback',
    accuracy: reviewedMoves ? Math.round(accuracyTotal / reviewedMoves) : null,
    result: finalResult(game),
    counts,
    moments,
  }
}

export function buildFallbackFinalReview(history) {
  const moments = reviewGame(history)
  return {
    complete: true,
    engine: 'JS fallback',
    accuracy: null,
    result: 'Game over',
    counts: buildClassificationCounts(moments),
    moments,
  }
}

async function safeEvaluate(evaluateFen, fen, options) {
  try {
    return await evaluateFen(fen, options)
  } catch {
    return null
  }
}

function evaluateForSide(game, side) {
  if (game.isCheckmate()) return game.turn() === side ? -99999 : 99999
  if (game.isDraw()) return 0
  let score = 0
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue
      score += (piece.color === side ? 1 : -1) * values[piece.type]
    }
  }
  return score
}

function classifyLoss(loss, move, index, legalMoveCount, isBookMove, expectedBefore) {
  if (legalMoveCount <= 1) return classificationForKey('forced')
  if (index < 14 && isBookMove && loss <= 0.05) return classificationForKey('book')
  if (move.san.includes('#')) {
    return classificationForKey('best')
  }
  if (loss <= 0.02 && move.captured && move.piece !== 'p') return classificationForKey('brilliant')
  if (loss <= 0.02 && move.captured && values[move.captured] >= values[move.piece]) return classificationForKey('brilliant')
  if (move.san.includes('+') && loss <= 0.05) {
    return classificationForKey('great')
  }
  if (loss <= 0.02 && (move.captured || move.san.includes('+'))) {
    return classificationForKey('great')
  }
  if (expectedBefore >= 0.75 && loss >= 0.05 && loss <= 0.20) return classificationForKey('miss')
  if (loss <= 0.005) return classificationForKey('best')
  if (loss <= 0.02) return classificationForKey('excellent')
  if (loss <= 0.05) return classificationForKey('good')
  if (loss <= 0.10) return classificationForKey('inaccuracy')
  if (loss <= 0.20) return classificationForKey('mistake')
  return classificationForKey('blunder')
}

function accuracyFromLoss(loss) {
  if (loss <= 12) return 100
  if (loss <= 45) return 94
  if (loss <= 90) return 84
  if (loss <= 160) return 68
  if (loss <= 320) return 42
  return 18
}

function fallbackMoment(move, index) {
  const key = move.san.includes('#') ? 'best' : move.san.includes('+') || move.captured ? 'great' : 'good'
  return {
    move: index + 1,
    moveNumber: Math.floor(index / 2) + 1,
    san: move.san,
    side: move.color,
    ...classificationForKey(key),
    expectedPointsLoss: null,
  }
}

function finalResult(game) {
  if (game.isCheckmate()) return game.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate'
  if (game.isDraw()) return 'Draw'
  return 'Game over'
}

function expectedPointsFromCp(cp) {
  const clamped = Math.max(-4000, Math.min(4000, Number(cp) || 0))
  return 1 / (1 + Math.exp(-EXPECTED_POINTS_GRADIENT * clamped))
}

function classificationForKey(key) {
  return {
    key,
    ...classificationData[key],
  }
}

function buildClassificationCounts(moments) {
  const counts = {}
  for (const moment of moments) counts[moment.key] = (counts[moment.key] || 0) + 1
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count, ...classificationData[key] }))
    .sort((a, b) => b.count - a.count)
}
