import { Chess } from 'chess.js'

const values = { p: 100, n: 315, b: 330, r: 500, q: 900, k: 0 }

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
        label: swing < -420 ? 'Blunder' : 'Mistake',
        note: `${san} changed the evaluation sharply. Look for forcing replies before committing.`,
      })
    } else if (move.captured || move.san.includes('+')) {
      moments.push({
        move: index + 1,
        san,
        label: 'Tactical moment',
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
    const beforeScore = await evaluateFen(beforeFen, { depth: 8, moveTime: 360 })
    const side = game.turn()
    const move = game.move(san)
    if (!move) continue

    const afterScore = await evaluateFen(game.fen(), { depth: 8, moveTime: 360 })
    if (typeof beforeScore !== 'number' || typeof afterScore !== 'number') {
      moments.push(fallbackMoment(move, index))
      continue
    }

    const moverBefore = beforeScore
    const moverAfter = -afterScore
    const loss = Math.max(0, moverBefore - moverAfter)
    const classification = classifyLoss(loss, move)
    const accuracy = accuracyFromLoss(loss)
    accuracyTotal += accuracy
    reviewedMoves += 1

    if (classification.keep || move.captured || move.san.includes('+') || index === history.length - 1) {
      moments.push({
        move: index + 1,
        san,
        side,
        label: classification.label,
        scoreLoss: loss,
        note: classification.note,
      })
    }
  }

  return {
    complete: true,
    engine: 'Stockfish 18',
    accuracy: reviewedMoves ? Math.round(accuracyTotal / reviewedMoves) : null,
    result: finalResult(game),
    moments: moments.slice(-8).reverse(),
  }
}

function buildFallbackFinalReview(history) {
  return {
    complete: true,
    engine: 'JS fallback',
    accuracy: null,
    result: 'Game over',
    moments: reviewGame(history),
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

function classifyLoss(loss, move) {
  if (move.san.includes('#')) {
    return { label: 'Best', keep: true, note: 'The move ends the game by force.' }
  }
  if (loss <= 12 && (move.captured || move.san.includes('+'))) {
    return { label: 'Great', keep: true, note: 'Forcing and accurate: this is the kind of tactical move Bookup should remember.' }
  }
  if (loss <= 18) return { label: 'Best', keep: false, note: 'Engine-approved and clean.' }
  if (loss <= 45) return { label: 'Excellent', keep: false, note: 'A strong practical move with almost no evaluation loss.' }
  if (loss <= 90) return { label: 'Good', keep: false, note: 'Playable, but there was a more precise continuation.' }
  if (loss <= 160) return { label: 'Inaccuracy', keep: true, note: 'A small drift. Check the candidate move order here.' }
  if (loss <= 320) return { label: 'Mistake', keep: true, note: 'The position changed enough that calculation should slow down.' }
  return { label: 'Blunder', keep: true, note: 'This gives away too much. Look for checks, captures, and threats before this move.' }
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
  return {
    move: index + 1,
    san: move.san,
    label: move.captured || move.san.includes('+') ? 'Tactical moment' : 'Reviewed',
    note: 'Stockfish did not return an evaluation for this move.',
  }
}

function finalResult(game) {
  if (game.isCheckmate()) return game.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate'
  if (game.isDraw()) return 'Draw'
  return 'Game over'
}
