import { Chess } from 'chess.js'
import { BOOK_MAX_PLIES, OPENING_BOOK } from '../data/openingBook.js'
import { phraseForMove } from '../data/coachPhrases.js'

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
const MIN_RANDOM_BOOK_GAMES = 12
const MIN_RANDOM_BOOK_RECENT_WEIGHT = 1.2
const RANDOM_BOOK_FLOOR_RATIO = 0.16
const RANDOM_BOOK_TOP_COUNT = 4
const STYLE_ENGINE_WINDOW_CP = 55
const BOOK_ENGINE_WINDOW_CP = 85
const CORRECTION_LINES = [
  'I have played this position before, but that old habit scored badly. Cleaner plan this time.',
  'Same Ayden ideas, but I am fixing the loose version of this position.',
  'I know this setup. The old choice was shaky, so I am upgrading the plan.',
  'This is familiar, but I am cutting out the mistake and keeping the good parts.',
]

export function chooseCoachMove(game, rating = 1900, engineInput = null, styleProfile = {}) {
  const engineCandidates = normalizeEngineCandidates(game, engineInput)
  const engineMove = engineCandidates[0]?.move || null
  const openingBook = styleProfile.openingBook || OPENING_BOOK
  const maxBookPlies = styleProfile.bookMaxPlies ?? BOOK_MAX_PLIES
  const bookChoice = findBookMove(
    game,
    openingBook,
    maxBookPlies,
    styleProfile.bookKeyType || 'history',
  )
  const correctionReason = bookChoice
    ? bookCorrectionReason(game, bookChoice, engineCandidates)
    : null
  if (bookChoice && !correctionReason && isConfidentBookChoice(bookChoice, engineMove)) {
    const { move } = bookChoice
    return {
      move,
      note: withPhrase(move, game, 'book', rating),
      source: 'repertoire',
    }
  }

  if (engineCandidates.length) {
    const selected = selectStyleAwareEngineMove(game, engineCandidates, styleProfile)
    return {
      move: selected.move,
      note: correctionReason
        ? randomLine(CORRECTION_LINES)
        : buildEngineNote(game, selected.move, rating),
      source: correctionReason ? 'corrected-repertoire' : 'engine-style',
      correction: correctionReason
        ? {
            reason: correctionReason,
            historicalMove: bookChoice.move.san,
            replacementMove: selected.move.san,
          }
        : null,
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
    const score = -search(branch, depth - 1, -Infinity, Infinity)
      + styleBonus(move, branch, styleProfile, game.turn())
    if (score > bestScore) {
      best = move
      bestScore = score
    }
  }

  return {
    move: best,
    note: buildCoachNote(game, best, bestScore, rating),
    source: 'js-style-fallback',
  }
}

export function calculationProfile(rating = 1900) {
  if (rating >= 2700) return { depth: 12, moveTime: 1100, elo: 2700 }
  if (rating >= 2500) return { depth: 10, moveTime: 900, elo: 2500 }
  if (rating >= 2200) return { depth: 8, moveTime: 650, elo: Math.round(rating) }
  if (rating >= 2000) return { depth: 7, moveTime: 540, elo: Math.round(rating) }
  return { depth: 6, moveTime: 420, elo: Math.max(1320, Math.round(rating)) }
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

function findBookMove(game, openingBook, bookMaxPlies, bookKeyType) {
  if (game.history().length > bookMaxPlies) return null
  const key = bookKeyType === 'position'
    ? game.fen().split(' ').slice(0, 4).join(' ')
    : game.history().join(' ')
  const options = openingBook[key]
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
            recentWeight: option.recentWeight,
            latestPlayedAt: option.latestPlayedAt,
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
    return repertoireScore(b) - repertoireScore(a)
  })
  const candidates = sorted.length ? sorted : [...options].sort((a, b) => repertoireScore(b) - repertoireScore(a))

  const forced = candidates.find((option) => option.force)
  if (forced) return forced

  const randomChoice = randomKnownRepertoireMove(game, candidates)
  if (randomChoice) return randomChoice

  for (const option of candidates) {
    if (option.force || !isClearlyBadBookMove(game, option.move)) return option
  }

  return candidates[0]
}

function randomKnownRepertoireMove(game, candidates) {
  if (!candidates.length) return null
  const usesRecentWeights = candidates.some((option) => typeof option.recentWeight === 'number')
  const topScore = Math.max(...candidates.map(repertoireScore))
  const absoluteFloor = usesRecentWeights ? MIN_RANDOM_BOOK_RECENT_WEIGHT : MIN_RANDOM_BOOK_GAMES
  const knownFloor = Math.max(absoluteFloor, topScore * RANDOM_BOOK_FLOOR_RATIO)
  const knownMoves = candidates
    .filter((option) => repertoireScore(option) >= knownFloor)
    .filter((option) => !isClearlyBadBookMove(game, option.move))
    .slice(0, RANDOM_BOOK_TOP_COUNT)

  if (knownMoves.length < 2) return null
  return weightedRandomBookMove(knownMoves)
}

function weightedRandomBookMove(options) {
  const weights = options.map((option) => Math.max(0.01, repertoireScore(option)))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = Math.random() * totalWeight

  for (let index = 0; index < options.length; index += 1) {
    roll -= weights[index]
    if (roll <= 0) return options[index]
  }

  return options[0]
}

function isConfidentBookChoice(choice, engineMove) {
  if (choice.force) return true
  if (!engineMove) return true
  if (typeof choice.recentWeight === 'number') return choice.recentWeight >= MIN_RANDOM_BOOK_RECENT_WEIGHT
  return choice.games >= MIN_CONFIDENT_BOOK_GAMES
}

function bookCorrectionReason(game, choice, engineCandidates) {
  if (choice.force) return null
  if (isKnownWeakBookChoice(choice)) return 'poor historical results'
  if (isClearlyBadBookMove(game, choice.move)) return 'material or positional loss'
  if (!engineCandidates.length) return null

  const matchingCandidate = engineCandidates.find(({ move }) => sameMove(move, choice.move))
  if (!matchingCandidate) return null
  const topScore = engineCandidates[0].score
  if (
    typeof topScore === 'number' &&
    typeof matchingCandidate.score === 'number' &&
    topScore - matchingCandidate.score > BOOK_ENGINE_WINDOW_CP
  ) {
    return 'engine-verified inaccuracy'
  }
  return null
}

function isKnownWeakBookChoice(choice) {
  if (typeof choice.wins !== 'number' || typeof choice.losses !== 'number') return false
  const decisiveGames = choice.wins + choice.losses
  if (choice.games < 4 || decisiveGames < 3) return false
  return choice.losses / decisiveGames >= 0.65 && choice.wins / decisiveGames <= 0.25
}

function repertoireScore(option) {
  return typeof option.recentWeight === 'number' ? option.recentWeight : option.games || 1
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

function normalizeEngineCandidates(game, engineInput) {
  if (!engineInput) return []
  const inputs = Array.isArray(engineInput) ? engineInput : [engineInput]
  return inputs
    .map((candidate, index) => {
      const uci = typeof candidate === 'string' ? candidate : candidate?.uci
      const move = moveFromUci(game, uci)
      if (!move) return null
      return {
        move,
        score: typeof candidate?.score === 'number' ? candidate.score : null,
        rank: candidate?.rank || index + 1,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank)
}

function selectStyleAwareEngineMove(game, candidates, styleProfile) {
  const topScore = candidates[0].score
  const nearBest = candidates.filter((candidate, index) => {
    if (index === 0) return true
    if (typeof topScore !== 'number' || typeof candidate.score !== 'number') return false
    return topScore - candidate.score <= STYLE_ENGINE_WINDOW_CP
  })

  return [...nearBest].sort((a, b) => {
    const styleDifference = learnedStyleScore(game, b.move, styleProfile)
      - learnedStyleScore(game, a.move, styleProfile)
    if (Math.abs(styleDifference) > 0.01) return styleDifference
    return a.rank - b.rank
  })[0]
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

function styleBonus(move, game, styleProfile = {}, playerColor = game.turn()) {
  let bonus = 0
  if (move.flags.includes('c')) bonus += pieceValue[move.captured] / 8
  if (move.san.includes('+')) bonus += 22
  if (centerSquares.has(move.to)) bonus += 16
  if ((move.piece === 'n' || move.piece === 'b') && ['c6', 'f6', 'c3', 'f3'].includes(move.to)) bonus += 10
  if (game.inCheck()) bonus += 12
  bonus += learnedStyleScoreForColor(move, styleProfile, playerColor, countPieces(game))
  return bonus
}

function learnedStyleScore(game, move, styleProfile) {
  return learnedStyleScoreForColor(move, styleProfile, game.turn(), countPieces(game))
}

function learnedStyleScoreForColor(move, styleProfile, playerColor, pieceCount) {
  const colorKey = playerColor === 'w' ? 'white' : 'black'
  const learned = styleProfile.learnedStyle?.byColor?.[colorKey]
  if (!learned) return 0

  const motifs = learned.motifWeights || {}
  let score = (learned.pieceSquareWeights?.[`${move.piece}:${move.to}`] || 0) * 42
  if (move.captured) score += (motifs.capture || 0) * 48
  if (move.san.includes('+') || move.san.includes('#')) score += (motifs.check || 0) * 80
  if (move.flags.includes('k') || move.flags.includes('q')) score += (motifs.castle || 0) * 90
  if (move.piece === 'p') score += (motifs.pawnPush || 0) * 18
  if (move.piece === 'q') score += (motifs.queenMove || 0) * 26
  if (move.piece === 'r') score += (motifs.rookMove || 0) * 22
  if (move.piece === 'p' && ['a', 'b', 'g', 'h'].includes(move.to[0])) {
    score += (motifs.flankPawn || 0) * 55
  }
  if (centerSquares.has(move.to)) score += (motifs.center || 0) * 45
  if (
    (move.piece === 'n' || move.piece === 'b') &&
    ['1', '8'].includes(move.from[1])
  ) {
    score += (motifs.development || 0) * 52
  }
  if (pieceCount <= 12) {
    const endgame = learned.endgameHabits || {}
    if (move.piece === 'k') score += (endgame.kingMoveRate || 0) * 30
    if (move.piece === 'p') score += (endgame.pawnMoveRate || 0) * 22
    if (move.captured) score += (endgame.captureRate || 0) * 26
  }
  return score
}

function orderMoves(moves) {
  return [...moves].sort((a, b) => {
    const captureA = a.captured ? pieceValue[a.captured] - pieceValue[a.piece] / 10 : 0
    const captureB = b.captured ? pieceValue[b.captured] - pieceValue[b.piece] / 10 : 0
    return captureB - captureA
  })
}

function buildCoachNote(game, move, score, rating) {
  if (!move) return 'No legal moves.'
  const source = score > 80 ? 'great' : 'search'
  return withPhrase(move, game, source, rating)
}

function buildEngineNote(game, move, rating) {
  const source = move.captured || move.san.includes('+') || rating >= 2700 ? 'great' : 'engine'
  return withPhrase(move, game, source, rating)
}

function withPhrase(move, game, source, rating = 2300) {
  return phraseForMove(move, {
    isOpeningMove: game.history().length === 0,
    isFreePieceCapture: isFreePieceCapture(game, move),
    isGreatMove: source === 'great',
    isWinning: isWinningAfterMove(game, move),
    isBeltMode: rating >= 2700,
    isCenterMove: centerSquares.has(move.to),
    isCastle: move.flags.includes('k') || move.flags.includes('q'),
    isPromotion: Boolean(move.promotion),
    isQueenMove: move.piece === 'q',
    isRookMove: move.piece === 'r',
    isPawnBreak: isPawnBreak(game, move),
    isRecapture: isRecapture(game, move),
    isEscapingCheck: game.inCheck(),
    isOnlyMove: game.moves().length === 1,
    isEndgame: countPieces(game) <= 10,
    source,
  })
}

function isFreePieceCapture(game, move) {
  if (!move?.captured) return false
  const branch = new Chess(game.fen())
  branch.move(move)
  return !branch.moves({ verbose: true }).some((reply) => reply.to === move.to && reply.captured)
}

function isWinningAfterMove(game, move) {
  const branch = new Chess(game.fen())
  branch.move(move)
  return -evaluate(branch) > 520
}

function isPawnBreak(game, move) {
  if (move.piece !== 'p') return false
  const fromRank = Number(move.from[1])
  const toRank = Number(move.to[1])
  const movedTwoSquares = Math.abs(toRank - fromRank) === 2
  return movedTwoSquares || centerSquares.has(move.to) || move.captured
}

function isRecapture(game, move) {
  if (!move.captured) return false
  const verboseHistory = game.history({ verbose: true })
  const previousMove = verboseHistory.at(-1)
  return previousMove?.to === move.to
}

function countPieces(game) {
  return game.board().flat().filter(Boolean).length
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

function sameMove(a, b) {
  return a?.from === b?.from && a?.to === b?.to && a?.promotion === b?.promotion
}

function randomLine(lines) {
  return lines[Math.floor(Math.random() * lines.length)]
}
