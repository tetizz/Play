import { Chess } from 'chess.js'
import { classifyMove } from './bookupClassifications.js'

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
const CENTER = new Set(['d4', 'e4', 'd5', 'e5'])

export function calculationProfile(profile, beltMode = false, game = null) {
  const base = profile.strengthPolicy
  let active = beltMode && base.belt ? { ...base, ...base.belt } : base
  if (profile.capabilities.maximumEngine && game) {
    if (
      isBishopKnightMatePosition(game, 'w') ||
      isBishopKnightMatePosition(game, 'b') ||
      isBishopKnightConversionPosition(game, game.turn())
    ) {
      active = { ...active, ...base.bishopKnightMate }
    } else if (
      isConversionEndgame(game) ||
      canCreateBishopKnightMate(game, game.turn()) ||
      canPursueBishopKnightObjective(game, game.turn())
    ) {
      active = { ...active, ...base.endgame }
    }
  }
  return {
    depth: active.depth,
    moveTime: active.moveTime,
    elo: profile.capabilities.maximumEngine ? undefined : active.engineElo,
    count: active.candidates,
    styleWindowCp: active.styleWindowCp,
    bookWindowCp: active.bookWindowCp,
  }
}

export function chooseCoachMove(
  game,
  engineInput,
  profile,
  styleProfile = {},
  beltMode = false,
  random = Math.random,
) {
  const policy = calculationProfile(profile, beltMode, game)
  const candidates = normalizeEngineCandidates(game, engineInput)
  const forcedMate = selectFastestMate(candidates)
  if (forcedMate) {
    return {
      move: forcedMate.move,
      source: 'engine-mate',
      score: forcedMate.score,
      rank: forcedMate.rank,
      line: forcedMate,
      bestLine: candidates[0],
      candidateLines: candidates,
    }
  }
  const conversionMode = profile.capabilities.maximumEngine && (
    isConversionEndgame(game) ||
    isBishopKnightMatePosition(game, game.turn()) ||
    canCreateBishopKnightMate(game, game.turn()) ||
    canPursueBishopKnightObjective(game, game.turn())
  )
  const bookChoice = conversionMode
    ? null
    : findBookMove(game, styleProfile, profile, candidates, policy, random)

  if (bookChoice) {
    return {
      move: bookChoice.move,
      source: 'repertoire',
      score: bookChoice.score,
      rank: bookChoice.rank,
      line: bookChoice.line,
      bestLine: candidates[0] || null,
      candidateLines: candidates,
    }
  }

  if (candidates.length) {
    const bishopKnightPromotion = profile.capabilities.bishopKnightObjective
      ? selectBishopKnightUnderpromotion(game, candidates)
      : null
    if (bishopKnightPromotion) {
      return {
        move: bishopKnightPromotion.move,
        source: 'engine-objective',
        score: bishopKnightPromotion.score,
        rank: bishopKnightPromotion.rank,
        line: bishopKnightPromotion,
        bestLine: candidates[0],
        candidateLines: candidates,
      }
    }
    const selected = selectEngineMove(game, candidates, profile, styleProfile, policy)
    return {
      move: selected.move,
      source: selected.rank === 1 ? 'engine-best' : 'engine-style',
      score: selected.score,
      rank: selected.rank,
      line: selected,
      bestLine: candidates[0],
      candidateLines: candidates,
    }
  }

  const fallbackDepth = profile.capabilities.maximumEngine
    ? isConversionEndgame(game) ? 4 : 3
    : profile.id === 'mubassar' ? 3 : 2
  const move = fallbackSearch(game, fallbackDepth, styleProfile)
  return { move, source: 'js-fallback', score: null, rank: null }
}

export function shouldActivateBeltMode(profile, history, humanColor) {
  if (!profile.capabilities.beltMode || !history.length) return false
  const humanMoves = history.filter((_, index) =>
    humanColor === 'white' ? index % 2 === 0 : index % 2 === 1,
  )
  return humanColor === 'white'
    ? isKingsIndianAttack(humanMoves)
    : isKingsIndianDefense(humanMoves) || isPircDefense(humanMoves)
}

export function moveContext(beforeGame, move, decision, beltMode, beltActivated = false, profile = null) {
  const afterGame = cloneGame(beforeGame)
  afterGame.move(move)
  const capturedValue = move.captured ? PIECE_VALUES[move.captured] : 0
  const priorMove = beforeGame.history({ verbose: true }).at(-1)
  const replyCapturesMovedPiece = afterGame.moves({ verbose: true })
    .some((reply) => reply.to === move.to && reply.captured)
  const queenTradeRecapture = move.captured === 'q' &&
    priorMove?.piece === 'q' &&
    priorMove?.captured === 'q' &&
    priorMove.to === move.to
  const entersBishopKnightObjective = profile?.capabilities.bishopKnightObjective &&
    !hasBishopKnightPair(beforeGame, move.color) &&
    hasBishopKnightPair(afterGame, move.color)
  const classification = decision.bestLine && decision.line
    ? classifyMove({
        beforeFen: beforeGame.fen(),
        move,
        bestLine: decision.bestLine,
        playedLine: decision.line,
        candidateLines: decision.candidateLines || [],
        legalMoveCount: beforeGame.moves().length,
        openingPhase: beforeGame.history().length < 20,
        inBook: decision.source === 'repertoire',
        isPlayerMove: true,
      })
    : null

  return {
    move,
    beltMode,
    beltActivated,
    capturedValue,
    isOpeningMove: beforeGame.history().length <= 1,
    isFreePiece: Boolean(move.captured) && !replyCapturesMovedPiece,
    isCheck: afterGame.inCheck(),
    isCheckmate: afterGame.isCheckmate(),
    isWinning: typeof decision.score === 'number' && decision.score >= 500,
    isGreatMove: decision.rank === 1 && (
      move.san.includes('+') ||
      Boolean(move.captured) ||
      typeof decision.score === 'number' && decision.score >= 250
    ),
    isQueenTradeRecapture: queenTradeRecapture,
    opponentBlunder: Boolean(move.captured) &&
      capturedValue >= 300 &&
      !replyCapturesMovedPiece &&
      !queenTradeRecapture,
    opponentHungQueen: move.captured === 'q' && !replyCapturesMovedPiece && !queenTradeRecapture,
    isBishopKnightObjective: entersBishopKnightObjective,
    isBrilliant: classification?.key === 'brilliant',
    isTheoryBest: decision.source === 'repertoire' && decision.rank === 1,
    isTrixizeFirstMove: profile?.id === 'trixize' &&
      beforeGame.history().length === 0 &&
      cleanSan(move.san) === 'Nf3',
  }
}

function findBookMove(game, styleProfile, profile, engineCandidates, policy, random) {
  const openingBook = styleProfile.openingBook || {}
  const maxPlies = styleProfile.bookMaxPlies || 0
  if (game.history().length > maxPlies) return null

  const forcedFirstMove = profile.repertoireSource.forceWhiteFirstMove
  if (game.history().length === 0 && forcedFirstMove) {
    const forced = game.moves({ verbose: true }).find((move) => cleanSan(move.san) === forcedFirstMove)
    if (forced) return candidateMetadata(forced, engineCandidates)
  }

  const key = styleProfile.bookKeyType === 'position'
    ? positionKey(game)
    : game.history().join(' ')
  const options = openingBook[key]
  if (!Array.isArray(options) || !options.length) return null

  const legal = new Map(game.moves({ verbose: true }).map((move) => [cleanSan(move.san), move]))
  const playable = []
  for (const option of options) {
    const san = typeof option === 'string' ? option : option.san
    const move = legal.get(cleanSan(san))
    if (!move) continue
    const stats = typeof option === 'string' ? {} : option
    const games = Number(stats.games || 1)
    const recentWeight = Number(stats.recentWeight || 0)
    const losses = Number(stats.losses || 0)
    const wins = Number(stats.wins || 0)
    const decisive = wins + losses
    if (games >= 4 && decisive >= 3 && losses / decisive >= 0.72 && wins / decisive <= 0.18) continue

    const engineMatch = engineCandidates.find((candidate) => sameMove(candidate.move, move))
    if (engineCandidates.length && !engineMatch) continue
    if (
      engineMatch &&
      Number.isFinite(engineCandidates[0].score) &&
      Number.isFinite(engineMatch.score) &&
      engineCandidates[0].score - engineMatch.score > policy.bookWindowCp
    ) {
      continue
    }
    if (
      !stats.force &&
      recentWeight < profile.strengthPolicy.bookMinRecentWeight &&
      games < profile.strengthPolicy.bookMinGames
    ) {
      continue
    }
    playable.push({
      move,
      force: Boolean(stats.force),
      weight: stats.force ? Number.MAX_SAFE_INTEGER : Math.max(recentWeight, games),
      games,
      recentWeight,
      wins,
      losses,
      draws: Number(stats.draws || 0),
      score: engineMatch?.score ?? null,
      rank: engineMatch?.rank ?? null,
      line: engineMatch || null,
    })
  }

  if (!playable.length) return null
  const forced = playable.find((entry) => entry.force)
  if (forced) return forced
  if (profile.capabilities.weightedRepertoire) {
    const weights = playable.map((entry) => repertoireChoiceWeight(entry, profile))
    return weightedChoice(playable, weights, random)
  }
  if (profile.capabilities.perfectTheory) {
    return [...playable].sort((a, b) =>
      b.weight - a.weight || (a.rank || 99) - (b.rank || 99),
    )[0]
  }
  return weightedChoice(playable)
}

function repertoireChoiceWeight(entry, profile) {
  const games = Math.max(1, entry.games || 1)
  const recentWeight = Math.max(0.01, entry.recentWeight || 0)
  const scoreRate = (entry.wins + entry.draws * 0.5 + 1) / (games + 2)
  const performance = 0.7 + Math.min(0.65, scoreRate * 0.65)
  const familiarity = recentWeight + Math.sqrt(games) * 0.2
  const temperature = profile.repertoireSource.repertoireTemperature || 1
  return Math.pow(familiarity * performance, temperature)
}

function selectEngineMove(game, candidates, profile, styleProfile, policy) {
  const top = candidates[0]
  if (profile.capabilities.maximumEngine) return top
  if (profile.capabilities.knightSpecialist && top.move.piece === 'n') {
    const strongestNonKnight = candidates.find((candidate) => candidate.move.piece !== 'n')
    if (
      !strongestNonKnight ||
      !Number.isFinite(top.score) ||
      !Number.isFinite(strongestNonKnight.score) ||
      top.score - strongestNonKnight.score >= profile.strengthPolicy.knightRequiredGapCp
    ) {
      return top
    }
  }

  const nearBest = candidates.filter((candidate) => {
    if (candidate.rank === 1) return true
    if (!Number.isFinite(top.score) || !Number.isFinite(candidate.score)) return false
    return top.score - candidate.score <= policy.styleWindowCp
  })

  if (profile.id === 'akshit' && nearBest.length > 1) {
    const weights = nearBest.map((candidate) => {
      const rankWeight = Math.max(1, 8 - candidate.rank * 2)
      const knightBoost = candidate.move.piece === 'n' ? 2.4 : 1
      return rankWeight * knightBoost
    })
    return weightedChoice(nearBest, weights)
  }

  return [...nearBest].sort((a, b) => {
    const styleDiff = learnedStyleScore(game, b.move, styleProfile)
      - learnedStyleScore(game, a.move, styleProfile)
    if (Math.abs(styleDiff) > 0.01) return styleDiff
    return a.rank - b.rank
  })[0]
}

function selectBishopKnightUnderpromotion(game, candidates) {
  if (!canPursueBishopKnightObjective(game, game.turn())) return null
  const top = candidates[0]
  return candidates
    .filter((candidate) => {
      if (!['b', 'n'].includes(candidate.move.promotion)) return false
      if (Number.isFinite(candidate.score) && candidate.score < 700) return false
      if (
        Number.isFinite(top?.score) &&
        Number.isFinite(candidate.score) &&
        top.score - candidate.score > 350
      ) return false
      const after = new Chess(game.fen())
      after.move(candidate.move)
      return hasBishopKnightPair(after, candidate.move.color)
    })
    .sort((a, b) => {
      const scoreDiff = (b.score ?? -Infinity) - (a.score ?? -Infinity)
      return scoreDiff || a.rank - b.rank
    })[0] || null
}

function selectFastestMate(candidates) {
  return candidates
    .filter((candidate) => Number.isFinite(candidate.mate) && candidate.mate > 0)
    .sort((a, b) => a.mate - b.mate || a.rank - b.rank)[0] || null
}

function normalizeEngineCandidates(game, engineInput) {
  if (!engineInput) return []
  const raw = Array.isArray(engineInput) ? engineInput : [engineInput]
  return raw.flatMap((candidate, index) => {
    const uci = typeof candidate === 'string' ? candidate : candidate?.uci
    const move = moveFromUci(game, uci)
    if (!move) return []
    return [{
      ...candidate,
      move,
      score: Number.isFinite(candidate?.score) ? candidate.score : null,
      rank: Number(candidate?.rank || index + 1),
    }]
  }).sort((a, b) => a.rank - b.rank)
}

function candidateMetadata(move, candidates) {
  const match = candidates.find((candidate) => sameMove(candidate.move, move))
  return {
    move,
    force: true,
    score: match?.score ?? null,
    rank: match?.rank ?? null,
    line: match || null,
  }
}

function weightedChoice(options, explicitWeights = null, random = Math.random) {
  const weights = explicitWeights || options.map((option) => Math.max(0.01, option.weight || 1))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = random() * total
  for (let index = 0; index < options.length; index += 1) {
    roll -= weights[index]
    if (roll <= 0) return options[index]
  }
  return options[0]
}

function learnedStyleScore(game, move, styleProfile) {
  const colorKey = game.turn() === 'w' ? 'white' : 'black'
  const learned = styleProfile.learnedStyle?.byColor?.[colorKey]
  if (!learned) return 0
  const motifs = learned.motifWeights || {}
  let score = (learned.pieceSquareWeights?.[`${move.piece}:${move.to}`] || 0) * 42
  if (move.captured) score += (motifs.capture || 0) * 40
  if (move.san.includes('+') || move.san.includes('#')) score += (motifs.check || 0) * 70
  if (move.flags.includes('k') || move.flags.includes('q')) score += (motifs.castle || 0) * 80
  if (CENTER.has(move.to)) score += (motifs.center || 0) * 45
  return score
}

function fallbackSearch(game, depth, styleProfile) {
  let bestMove = null
  let bestScore = -Infinity
  for (const move of orderMoves(game.moves({ verbose: true }))) {
    const branch = cloneGame(game)
    branch.move(move)
    const score = -search(branch, depth - 1, -Infinity, Infinity)
      + learnedStyleScore(game, move, styleProfile)
    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }
  return bestMove
}

function search(game, depth, alpha, beta) {
  if (depth <= 0 || game.isGameOver()) return evaluate(game)
  let best = -Infinity
  for (const move of orderMoves(game.moves({ verbose: true }))) {
    const branch = cloneGame(game)
    branch.move(move)
    best = Math.max(best, -search(branch, depth - 1, -beta, -alpha))
    alpha = Math.max(alpha, best)
    if (alpha >= beta) break
  }
  return best
}

function evaluate(game) {
  if (game.isCheckmate()) return -999999
  if (game.isDraw()) return 0
  let score = 0
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue
      score += (piece.color === game.turn() ? 1 : -1) * PIECE_VALUES[piece.type]
      if (piece.type === 'p') {
        const rank = Number(piece.square?.[1] || 0)
        const advance = piece.color === 'w' ? rank - 2 : 7 - rank
        score += (piece.color === game.turn() ? 1 : -1) * advance * advance * 8
      }
    }
  }
  return score
}

function orderMoves(moves) {
  return [...moves].sort((a, b) => {
    const aPromotion = a.promotion ? PIECE_VALUES[a.promotion] || 0 : 0
    const bPromotion = b.promotion ? PIECE_VALUES[b.promotion] || 0 : 0
    const aValue = a.captured ? PIECE_VALUES[a.captured] : 0
    const bValue = b.captured ? PIECE_VALUES[b.captured] : 0
    return bPromotion + bValue - aPromotion - aValue
  })
}

function moveFromUci(game, uci) {
  if (!uci || uci === '(none)') return null
  return game.moves({ verbose: true }).find((move) =>
    move.from === uci.slice(0, 2) &&
    move.to === uci.slice(2, 4) &&
    (!uci[4] || move.promotion === uci[4]),
  ) || null
}

function positionKey(game) {
  return game.fen().split(' ').slice(0, 4).join(' ')
}

function cloneGame(game) {
  return new Chess(game.fen())
}

function sameMove(a, b) {
  return a?.from === b?.from && a?.to === b?.to && a?.promotion === b?.promotion
}

function cleanSan(san) {
  return String(san || '').replace(/[+#?!]+/g, '')
}

export function isBishopKnightMatePosition(game, color) {
  const own = materialCounts(game, color)
  const opponent = materialCounts(game, color === 'w' ? 'b' : 'w')
  return own.b === 1 &&
    own.n === 1 &&
    own.p === 0 &&
    own.r === 0 &&
    own.q === 0 &&
    opponent.p === 0 &&
    opponent.n === 0 &&
    opponent.b === 0 &&
    opponent.r === 0 &&
    opponent.q === 0
}

function canCreateBishopKnightMate(game, color) {
  const own = materialCounts(game, color)
  const opponent = materialCounts(game, color === 'w' ? 'b' : 'w')
  const opponentBareKing = opponent.p === 0 &&
    opponent.n === 0 &&
    opponent.b === 0 &&
    opponent.r === 0 &&
    opponent.q === 0
  const hasOnePromotingPawn = own.p === 1 &&
    game.moves({ verbose: true }).some((move) => move.color === color && ['b', 'n'].includes(move.promotion))
  const missingKnight = own.b === 1 && own.n === 0
  const missingBishop = own.n === 1 && own.b === 0
  return opponentBareKing &&
    hasOnePromotingPawn &&
    own.r === 0 &&
    own.q === 0 &&
    (missingKnight || missingBishop)
}

function canPursueBishopKnightObjective(game, color) {
  const own = materialCounts(game, color)
  const canUnderpromote = game.moves({ verbose: true })
    .some((move) => move.color === color && ['b', 'n'].includes(move.promotion))
  return canUnderpromote && (
    (own.b >= 1 && own.n === 0) ||
    (own.n >= 1 && own.b === 0)
  )
}

function hasBishopKnightPair(game, color) {
  const own = materialCounts(game, color)
  return own.b >= 1 && own.n >= 1
}

function isBishopKnightConversionPosition(game, color) {
  if (!hasBishopKnightPair(game, color)) return false
  const own = materialCounts(game, color)
  const opponent = materialCounts(game, color === 'w' ? 'b' : 'w')
  const ownExtraPieces = own.p + own.r + own.q + Math.max(0, own.b - 1) + Math.max(0, own.n - 1)
  const opponentPieces = opponent.p + opponent.n + opponent.b + opponent.r + opponent.q
  return ownExtraPieces <= 1 && opponentPieces <= 1
}

function isConversionEndgame(game) {
  const pieces = game.board().flat().filter(Boolean)
  const nonPawnMaterial = pieces.reduce((total, piece) =>
    total + (piece.type === 'p' || piece.type === 'k' ? 0 : PIECE_VALUES[piece.type]), 0)
  const hasAdvancedPawn = pieces.some((piece) =>
    piece.type === 'p' && (
      piece.color === 'w' ? Number(piece.square[1]) >= 6 : Number(piece.square[1]) <= 3
    ),
  )
  return pieces.length <= 10 || nonPawnMaterial <= 1400 || hasAdvancedPawn
}

function materialCounts(game, color) {
  const counts = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 }
  for (const piece of game.board().flat()) {
    if (piece?.color === color) counts[piece.type] += 1
  }
  return counts
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
