import { Chess } from 'chess.js'
import { gameFromHistory } from './gameSession.js'

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

const CAPTURE_ORDER = ['p', 'b', 'n', 'r', 'q']

export function materialDisplayFromHistory(history = [], viewPly = history.length) {
  const visibleHistory = history.slice(0, Math.max(0, viewPly))
  const game = gameFromHistory(visibleHistory)
  const captures = {
    w: emptyCaptureCounts(),
    b: emptyCaptureCounts(),
  }

  for (const move of game.history({ verbose: true })) {
    if (move.captured && captures[move.color]) {
      captures[move.color][move.captured] += 1
    }
  }

  const material = boardMaterial(game)
  const balance = material.w - material.b

  return {
    white: {
      captures: orderedCaptures(captures.w),
      advantage: Math.max(0, balance),
    },
    black: {
      captures: orderedCaptures(captures.b),
      advantage: Math.max(0, -balance),
    },
  }
}

function boardMaterial(game) {
  const totals = { w: 0, b: 0 }
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece) totals[piece.color] += PIECE_VALUES[piece.type] || 0
    }
  }
  return totals
}

function emptyCaptureCounts() {
  return Object.fromEntries(Object.keys(PIECE_VALUES).map((piece) => [piece, 0]))
}

function orderedCaptures(counts) {
  return CAPTURE_ORDER.flatMap((piece) =>
    Array.from({ length: counts[piece] || 0 }, () => piece))
}

export function materialDisplayFromFen(fen) {
  const game = new Chess(fen)
  const material = boardMaterial(game)
  const balance = material.w - material.b
  return {
    white: Math.max(0, balance),
    black: Math.max(0, -balance),
  }
}
