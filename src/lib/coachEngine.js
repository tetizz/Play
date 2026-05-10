import { Chess } from 'chess.js'
import { BOOK_MAX_PLIES, OPENING_BOOK } from '../data/openingBook'
import { phraseForMove } from '../data/coachPhrases'

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
const MIN_CONFIDENT_BOOK_GAMES = 8

export function chooseCoachMove(game, rating = 2300, engineUciMove = null) {
  const engineMove = moveFromUci(game, engineUciMove)
  const bookChoice = findBookMove(game)
  if (bookChoice && isConfidentBookChoice(bookChoice, engineMove)) {
    const { move } = bookChoice
    return {
      move,
      note: withPhrase(
        move,
        game,
        `${move.san}. Your move.`,
        'book',
      ),
    }
  }

  if (engineMove) {
    return {
      move: engineMove,
      note: buildEngineNote(game, engineMove, rating),
    }
  }

  const depth = rating >= 2700 ? 4 : rating >= 2500 ? 3 : rating >= 2200 ? 2 : 1
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
    note: buildCoachNote(game, best, bestScore),
  }
}

export function calculationProfile(rating = 2300) {
  if (rating >= 2700) return { depth: 12, moveTime: 1100, elo: 2700 }
  if (rating >= 2500) return { depth: 10, moveTime: 900, elo: 2500 }
  if (rating >= 2200) return { depth: 8, moveTime: 650, elo: 2300 }
  return { depth: 6, moveTime: 420, elo: 1600 }
}

export function shouldActivateBeltMode(history, humanColor) {
  if (!history.length) return false
  const humanMoves = history.filter((_, index) =>
    humanColor === 'white' ? index % 2 === 0 : index % 2 === 1,
  )
  return humanColor === 'white'
    ? isKingsIndianAttack(humanMoves)
    : isKingsIndianDefense(humanMoves) || isPircDefense(humanMoves)
}

export function explainHumanMove(game, move) {
  if (game.isCheckmate()) {
    return `${move.san}. Checkmate. Alright, you earned that one.`
  }
  if (move.flags.includes('c')) {
    return `${move.san}. Nice, you grabbed something. Now prove it does not get trapped.`
  }
  if (move.san.includes('+')) {
    return `${move.san}. Check. Now show me the follow-up.`
  }
  if (centerSquares.has(move.to)) {
    return `${move.san}. Good, you are fighting for the middle. Keep going.`
  }
  if (move.piece === 'n' || move.piece === 'b') {
    return `${move.san}. Development is fine. Now what is the threat?`
  }
  return `${move.san}. Okay, now I get a turn.`
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
    if (option.force || !isClearlyBadBookMove(game, option.move)) return option
  }

  return candidates[0]
}

function isConfidentBookChoice(choice, engineMove) {
  if (choice.force) return true
  if (!engineMove) return true
  return choice.games >= MIN_CONFIDENT_BOOK_GAMES
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

function buildCoachNote(game, move, score) {
  if (!move) return 'No legal moves.'
  if (move.san.includes('#')) return withPhrase(move, game, `${move.san}. That is mate.`, 'search')
  if (move.san.includes('+')) return withPhrase(move, game, `${move.san}. Your king has to answer me first.`, 'search')
  if (move.captured) return withPhrase(move, game, `${move.san}. I like my material clean.`, 'search')
  if (centerSquares.has(move.to)) return withPhrase(move, game, `${move.san}. I want the center.`, 'search')
  if (score > 80) return withPhrase(move, game, `${move.san}. This is already getting uncomfortable for you.`, 'great')
  return withPhrase(move, game, `${move.san}. Simple move, annoying position.`, 'search')
}

function buildEngineNote(game, move, rating) {
  if (move.san.includes('#')) return withPhrase(move, game, `${move.san}. That is mate.`, 'engine')
  if (move.captured) return withPhrase(move, game, `${move.san}. That tactic works.`, 'great')
  if (move.san.includes('+')) return withPhrase(move, game, `${move.san}. You have to deal with the king first.`, 'great')
  if (rating >= 2700) return withPhrase(move, game, `${move.san}. Belt mode does not give free moves.`, 'great')
  return withPhrase(move, game, `${move.san}. This is the practical move.`, 'engine')
}

function withPhrase(move, game, note, source) {
  const phrase = phraseForMove(move, {
    isOpeningMove: game.history().length === 0,
    isFreePieceCapture: isFreePieceCapture(game, move),
    isGreatMove: source === 'great',
    isCenterMove: centerSquares.has(move.to),
    source,
  })
  return `${phrase.replace(/[.!?]+$/, '')}. ${note}`
}

function isFreePieceCapture(game, move) {
  if (!move?.captured) return false
  const branch = new Chess(game.fen())
  branch.move(move)
  return !branch.moves({ verbose: true }).some((reply) => reply.to === move.to && reply.captured)
}

function isKingsIndianAttack(moves) {
  const played = new Set(moves.map(cleanSan))
  return played.has('Nf3') && played.has('g3') && (played.has('Bg2') || played.has('O-O'))
}

function isKingsIndianDefense(moves) {
  const played = new Set(moves.map(cleanSan))
  return played.has('Nf6') && played.has('g6') && (played.has('Bg7') || played.has('d6') || played.has('O-O'))
}

function isPircDefense(moves) {
  const played = new Set(moves.map(cleanSan))
  return played.has('d6') && played.has('Nf6') && (played.has('g6') || played.has('Bg7'))
}

function cleanSan(san) {
  return san.replace(/[+#?!]+/g, '')
}
