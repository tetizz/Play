import { Chess } from 'chess.js'
import { BOOK_MAX_PLIES, OPENING_BOOK } from '../data/openingBook'

const pieceValue = {
  p: 100,
  n: 315,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
}

const centerSquares = new Set(['d4', 'e4', 'd5', 'e5'])
const nearCenterSquares = new Set(['c3', 'd3', 'e3', 'f3', 'c4', 'f4', 'c5', 'f5', 'c6', 'd6', 'e6', 'f6'])

export function chooseCoachMove(game, rating = 2300, engineUciMove = null) {
  const bookMove = findBookMove(game)
  if (bookMove) {
    return {
      move: bookMove,
      note: `Mubassar prep: ${bookMove.san}. I am following the most-played repertoire move from this position.`,
    }
  }

  if (engineUciMove) {
    const engineMove = moveFromUci(game, engineUciMove)
    if (engineMove) {
      return {
        move: engineMove,
        note: buildEngineNote(engineMove, rating),
      }
    }
  }

  const depth = rating >= 2500 ? 3 : rating >= 2200 ? 2 : 1
  const candidates = game.moves({ verbose: true })
  if (!candidates.length) return { move: null, note: 'The game is over.' }

  let best = null
  let bestScore = -Infinity

  for (const move of candidates) {
    const branch = new Chess(game.fen())
    branch.move(move)
    const score = -search(branch, depth - 1, -Infinity, Infinity) + styleBonus(move, branch)
    if (score > bestScore) {
      best = move
      bestScore = score
    }
  }

  return {
    move: best,
    note: buildCoachNote(best, bestScore),
  }
}

export function calculationProfile(rating = 2300) {
  if (rating >= 2500) return { depth: 10, moveTime: 900, elo: 2500 }
  if (rating >= 2200) return { depth: 8, moveTime: 650, elo: 2300 }
  return { depth: 6, moveTime: 420, elo: 1600 }
}

export function explainHumanMove(game, move) {
  if (move.flags.includes('c')) {
    return `${move.san} wins material, but remember: after a capture, check whether the piece can stay there.`
  }
  if (centerSquares.has(move.to)) {
    return `${move.san} is a grown-up chess move: you are claiming central space instead of drifting.`
  }
  if (move.piece === 'n' || move.piece === 'b') {
    return `${move.san} develops a piece. Good. Now connect that development to king safety.`
  }
  if (game.inCheck()) {
    return `${move.san} gives check. Checks are forcing, but the follow-up has to be just as serious.`
  }
  return `${move.san} is on the board. Now ask what your opponent wants before you make the next move.`
}

function findBookMove(game) {
  if (game.history().length > BOOK_MAX_PLIES) return null
  const key = game.history().join(' ')
  const options = OPENING_BOOK[key]
  if (!options) return null
  const legalMoves = game.moves({ verbose: true })
  const legalBySan = new Map(legalMoves.map((move) => [move.san, move]))
  const playable = options
    .map((option) => {
      const san = typeof option === 'string' ? option : option.san
      const move = legalBySan.get(san)
      return move
        ? {
            move,
            games: option.games || 1,
            wins: option.wins,
            losses: option.losses,
            force: option.force,
          }
        : null
    })
    .filter(Boolean)
  if (!playable.length) return null
  return bestRepertoireMove(game, playable)
}

function bestRepertoireMove(game, options) {
  const sorted = [...options].filter(isStatisticallyPlayable).sort((a, b) => {
    if (a.force && !b.force) return -1
    if (!a.force && b.force) return 1
    return b.games - a.games
  })
  const candidates = sorted.length ? sorted : [...options].sort((a, b) => b.games - a.games)

  for (const option of candidates) {
    if (option.force || !isClearlyBadBookMove(game, option.move)) return option.move
  }

  return candidates[0].move
}

function isStatisticallyPlayable(option) {
  if (option.force) return true
  if (typeof option.wins !== 'number' || typeof option.losses !== 'number') return true
  if (option.games < 5) return option.wins > 0
  return !(option.wins === 0 && option.losses >= Math.max(2, option.games - 1))
}

function isClearlyBadBookMove(game, move) {
  const before = evaluate(game)
  const branch = new Chess(game.fen())
  branch.move(move)
  const after = -evaluate(branch)
  const capturedValue = move.captured ? pieceValue[move.captured] : 0
  return before - after > 220 + capturedValue / 2
}

function moveFromUci(game, uci) {
  if (!uci || uci === '(none)') return null
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.slice(4, 5) || undefined
  const legalMoves = game.moves({ verbose: true })
  return legalMoves.find(
    (move) =>
      move.from === from &&
      move.to === to &&
      (!promotion || move.promotion === promotion),
  )
}

function search(game, depth, alpha, beta) {
  if (depth === 0 || game.isGameOver()) return evaluate(game)

  let score = -Infinity
  const moves = orderMoves(game.moves({ verbose: true }))
  for (const move of moves) {
    const branch = new Chess(game.fen())
    branch.move(move)
    score = Math.max(score, -search(branch, depth - 1, -beta, -alpha))
    alpha = Math.max(alpha, score)
    if (alpha >= beta) break
  }
  return score
}

function evaluate(game) {
  if (game.isCheckmate()) return -999999
  if (game.isDraw()) return 0

  const board = game.board()
  let score = 0
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank][file]
      if (!piece) continue
      const square = `${'abcdefgh'[file]}${8 - rank}`
      const sign = piece.color === game.turn() ? 1 : -1
      score += sign * (pieceValue[piece.type] + squareBonus(piece.type, square))
    }
  }
  if (game.inCheck()) score -= 35
  return score
}

function squareBonus(piece, square) {
  if (centerSquares.has(square)) return piece === 'p' ? 28 : 18
  if (nearCenterSquares.has(square)) return 9
  return 0
}

function styleBonus(move, game) {
  let bonus = 0
  if (move.flags.includes('c')) bonus += pieceValue[move.captured] / 8
  if (move.san.includes('+')) bonus += 22
  if (centerSquares.has(move.to)) bonus += 16
  if ((move.piece === 'n' || move.piece === 'b') && ['c6', 'f6', 'c3', 'f3'].includes(move.to)) bonus += 10
  if (game.inCheck()) bonus += 12
  return bonus
}

function orderMoves(moves) {
  return [...moves].sort((a, b) => {
    const captureA = a.captured ? pieceValue[a.captured] - pieceValue[a.piece] / 10 : 0
    const captureB = b.captured ? pieceValue[b.captured] - pieceValue[b.piece] / 10 : 0
    return captureB - captureA
  })
}

function buildCoachNote(move, score) {
  if (!move) return 'No legal moves.'
  if (move.san.includes('#')) return `${move.san}. Checkmate. That is why forcing moves matter.`
  if (move.san.includes('+')) return `${move.san}. A check with purpose: force the king, then improve the pieces.`
  if (move.captured) return `${move.san}. I am taking material because the tactic is clean enough to justify it.`
  if (centerSquares.has(move.to)) return `${move.san}. Central control first; attacks are easier when the middle belongs to you.`
  if (score > 80) return `${move.san}. The position is starting to lean my way, so I am increasing the pressure.`
  return `${move.san}. Quiet, useful, and hard to meet. That is often the NM way.`
}

function buildEngineNote(move, rating) {
  const depthText = rating >= 2500 ? 'about ten moves of calculation' : rating >= 2200 ? 'seven to eight moves of calculation' : 'a lighter training search'
  if (move.san.includes('#')) return `${move.san}. The calculation ends in mate.`
  if (move.captured) return `${move.san}. After ${depthText}, the tactic holds up.`
  if (move.san.includes('+')) return `${move.san}. A forcing check from the engine line, still played in a human NM style.`
  return `${move.san}. Out of book now, so I am using ${depthText} and choosing the most practical continuation.`
}
