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
