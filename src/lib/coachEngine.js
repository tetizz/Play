import { Chess } from 'chess.js'
import { classifyMove } from './bookupClassifications.js'

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
const CENTER = new Set(['d4', 'e4', 'd5', 'e5'])
export const BAD_MANNERS_ROUTE_WEIGHTS = Object.freeze({
  createsPair: 26000,
  minorPromotion: 15000,
  pureKbnk: 18000,
  surplusCanBeTaken: 15000,
  surplusNearKing: 1100,
  surplusCheck: 1200,
  captureMaterial: 24,
  pawnAdvance: 900,
  routeProgressGain: 620,
  routePressureDrop: 260,
  stablePawnGain: 1200,
  kingBlocksRoute: 380,
  kbnCornerProgress: 1300,
  preserveWinMargin: 0.16,
  objectiveLostPenalty: -120000,
  keyPieceHangingPenalty: -32000,
  queenPromotionPenalty: -60000,
  immediateNonKbnMatePenalty: -90000,
  drawPenalty: -90000,
})

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
  const badMannersChallenge = profile.capabilities.bishopKnightObjective &&
    isBishopKnightObjectiveReachable(game, game.turn())
  const playableCandidates = badMannersChallenge
    ? candidates.filter((candidate) =>
        !rejectsBadMannersPureFinal(game, candidate) &&
        !rejectsBadMannersCriticalRoute(game, candidate),
      )
    : candidates
  const bishopKnightPromotion = profile.capabilities.bishopKnightObjective
    ? selectBishopKnightUnderpromotion(game, playableCandidates)
    : null
  const bishopKnightConversion = profile.capabilities.bishopKnightObjective
    ? selectBishopKnightConversionMove(game, playableCandidates)
    : null
  const bishopKnightCapture = profile.capabilities.bishopKnightObjective
    ? selectBishopKnightEnemyCapture(game, playableCandidates)
    : null
  const forcedMate = selectFastestMate(playableCandidates)
  if (bishopKnightConversion) {
    return {
      move: bishopKnightConversion.move,
      source: 'engine-objective',
      score: bishopKnightConversion.score,
      rank: bishopKnightConversion.rank,
      line: bishopKnightConversion,
      bestLine: candidates[0],
      candidateLines: candidates,
    }
  }
  if (bishopKnightPromotion && (!forcedMate || bishopKnightPromotion.mate > 0)) {
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
  if (bishopKnightCapture) {
    return {
      move: bishopKnightCapture.move,
      source: 'engine-objective',
      score: bishopKnightCapture.score,
      rank: bishopKnightCapture.rank,
      line: bishopKnightCapture,
      bestLine: candidates[0],
      candidateLines: candidates,
    }
  }
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

  if (playableCandidates.length) {
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
    const selected = selectEngineMove(game, playableCandidates, profile, styleProfile, policy, random)
    return {
      move: selected.move,
      source: selected.rank === 1 ? 'engine-best' : 'engine-style',
      score: selected.score,
      rank: selected.rank,
      line: selected,
      bestLine: playableCandidates[0],
      candidateLines: playableCandidates,
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

  const historyKey = game.history().join(' ')
  const positionBookKey = positionKey(game)
  const keys = styleProfile.bookKeyType === 'position'
    ? [positionBookKey]
    : styleProfile.bookKeyType === 'mixed'
      ? [positionBookKey, historyKey]
      : [historyKey]
  const options = preferredBookOptions(keys.flatMap((key) => openingBook[key] || []))
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
  return weightedChoice(playable, null, random)
}

function preferredBookOptions(options) {
  const byMove = new Map()
  for (const option of options) {
    const san = typeof option === 'string' ? option : option?.san
    const key = cleanSan(san)
    if (!key) continue
    const current = byMove.get(key)
    if (!current || bookOptionPriority(option) > bookOptionPriority(current)) {
      byMove.set(key, option)
    }
  }
  return [...byMove.values()]
}

function bookOptionPriority(option) {
  if (typeof option === 'string') return 0
  if (option?.force) return Number.MAX_SAFE_INTEGER
  const recentWeight = Number(option?.recentWeight || 0)
  const games = Number(option?.games || 0)
  return (recentWeight > 0 ? 1_000_000 : 0) + recentWeight * 100 + games
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

function selectEngineMove(game, candidates, profile, styleProfile, policy, random) {
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
    return weightedChoice(nearBest, weights, random)
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
  return candidates
    .filter((candidate) => {
      if (!['b', 'n'].includes(candidate.move.promotion)) return false
      const verified = candidate.objectiveVerified === true
      if (!verified) return false
      if (!isWinningObjectiveCandidate(candidate)) return false
      const after = new Chess(game.fen())
      after.move(candidate.move)
      if (after.isDraw()) return false
      return hasBishopKnightPair(after, candidate.move.color)
    })
    .sort((a, b) => {
      const routeDiff = badMannersRouteScore(game, b.move, b) - badMannersRouteScore(game, a.move, a)
      const scoreDiff = (b.score ?? -Infinity) - (a.score ?? -Infinity)
      return routeDiff || scoreDiff || a.rank - b.rank
    })[0] || null
}

function selectBishopKnightConversionMove(game, candidates) {
  const color = game.turn()
  if (!isBishopKnightDisrespectPosition(game, color)) return null

  return candidates
    .filter((candidate) => {
      if (!isWinningObjectiveCandidate(candidate)) return false
      if (candidate.objectiveVerified !== true) return false
      const after = cloneGame(game)
      after.move(candidate.move)
      return !after.isGameOver() && bishopKnightObjectivePriority(game, after, candidate.move) > 0
    })
    .sort((a, b) => {
      const priorityDiff = badMannersRouteScore(game, b.move, b) -
        badMannersRouteScore(game, a.move, a)
      return priorityDiff || (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.rank - b.rank
    })[0] || null
}

function selectBishopKnightEnemyCapture(game, candidates) {
  const color = game.turn()
  const own = materialCounts(game, color)
  const opponent = materialCounts(game, oppositeColor(color))
  const opponentMaterial = opponent.p + opponent.n + opponent.b + opponent.r + opponent.q
  if (opponentMaterial === 0) return null
  if (own.b === 0 && own.n === 0) return null

  return candidates
    .filter((candidate) => {
      if (candidate.badManners !== true || candidate.objectiveVerified !== true) return false
      if (!isWinningObjectiveCandidate(candidate)) return false
      if (!candidate.move.captured || candidate.move.captured === 'k') return false
      const after = cloneGame(game)
      after.move(candidate.move)
      return !after.isGameOver() && (
        isBishopKnightDisrespectPosition(after, color) ||
        canPursueBishopKnightObjective(after, color)
      )
    })
    .sort((a, b) => {
      const captureDiff = PIECE_VALUES[b.move.captured] - PIECE_VALUES[a.move.captured]
      return captureDiff || (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.rank - b.rank
    })[0] || null
}

function isWinningObjectiveCandidate(candidate) {
  return Number.isFinite(candidate.mate)
    ? candidate.mate > 0
    : Number.isFinite(candidate.score) && candidate.score >= objectiveScoreFloor(candidate)
}

function objectiveScoreFloor(candidate) {
  return candidate.objectiveVerified === true || candidate.badManners === true ? 120 : 650
}

function rejectsBadMannersPureFinal(game, candidate) {
  if (!candidate?.move) return false
  const after = cloneGame(game)
  after.move(candidate.move)
  return after.isCheckmate() && !isBishopKnightMatePosition(after, candidate.move.color)
}

function rejectsBadMannersCriticalRoute(game, candidate) {
  if (!candidate?.move) return false
  const color = candidate.move.color
  const after = cloneGame(game)
  after.move(candidate.move)
  if (after.isGameOver()) return false

  const own = materialCounts(after, color)
  const missingBishop = own.b === 0
  const missingKnight = own.n === 0

  return after.moves({ verbose: true }).some((reply) => {
    if (!reply.captured) return false
    if (reply.captured === 'b' && own.b <= 1) return true
    if (reply.captured === 'n' && own.n <= 1) return true
    if (reply.captured !== 'p' || (!missingBishop && !missingKnight)) return false

    const afterReply = cloneGame(after)
    afterReply.move(reply)
    return !canStillBuildBishopKnight(afterReply, color)
  })
}

function canStillBuildBishopKnight(game, color) {
  const own = materialCounts(game, color)
  const viablePawns = Math.max(
    viablePromotionPawnCount(game, color),
    potentialPromotionPawnCount(game, color),
  )
  if (own.b >= 1 && own.n >= 1) return true
  if (own.b >= 1 && own.n === 0) return viablePawns >= 1
  if (own.n >= 1 && own.b === 0) return viablePawns >= 1
  return viablePawns >= 2
}

export function isBishopKnightObjectiveReachable(game, color = game?.turn?.()) {
  if (!game || !color || game.isDraw()) return false
  const own = materialCounts(game, color)
  const opponent = materialCounts(game, oppositeColor(color))
  const opponentBareKing = opponent.p + opponent.n + opponent.b + opponent.r + opponent.q === 0
  if (!opponentBareKing) return false
  if (own.b >= 1 && own.n >= 1) return true
  return canStillBuildBishopKnight(game, color)
}

function viablePromotionPawnCount(game, color) {
  return game.board().flat().filter((piece) =>
    piece?.color === color &&
    piece.type === 'p' &&
    hasClearForwardPromotionLane(game, piece.square, color),
  ).length
}

function hasClearForwardPromotionLane(game, square, color) {
  const file = square[0]
  let rank = Number(square[1])
  const step = color === 'w' ? 1 : -1
  const promotionRank = color === 'w' ? 8 : 1
  while (rank !== promotionRank) {
    rank += step
    if (game.get(`${file}${rank}`)) return false
  }
  return true
}

function potentialPromotionPawnCount(game, color) {
  return game.board().flat().filter((piece) =>
    piece?.color === color &&
    piece.type === 'p' &&
    hasPotentialForwardPromotionLane(game, piece.square, color),
  ).length
}

function hasPotentialForwardPromotionLane(game, square, color) {
  const file = square[0]
  let rank = Number(square[1])
  const step = color === 'w' ? 1 : -1
  const promotionRank = color === 'w' ? 8 : 1
  while (rank !== promotionRank) {
    rank += step
    const blocker = game.get(`${file}${rank}`)
    if (blocker && !(blocker.color === color && blocker.type === 'p')) return false
  }
  return true
}

function bishopKnightObjectivePriority(before, after, move) {
  const learnedScore = badMannersRouteScore(before, move, null, after)
  if (learnedScore > 0) return learnedScore

  const color = move.color
  const beforeOwn = materialCounts(before, color)
  const afterOwn = materialCounts(after, color)
  const hadPair = beforeOwn.b >= 1 && beforeOwn.n >= 1
  const hasPair = afterOwn.b >= 1 && afterOwn.n >= 1
  if (move.promotion && !['b', 'n'].includes(move.promotion)) return 0
  if (!hadPair && hasPair && ['b', 'n'].includes(move.promotion)) return 20000
  if (!hadPair && ['b', 'n'].includes(move.promotion)) return 12000

  const routeBefore = promotionRouteInfo(before, color)
  const routeAfter = promotionRouteInfo(after, color)
  const routePressureGain = routeBefore.pressure - routeAfter.pressure
  const routeProgressGain = routeAfter.bestProgress - routeBefore.bestProgress

  if (hadPair) {
    const extraType = isSurplusPiece(beforeOwn, move.piece)
    if (!extraType) return 0
    if (canOpponentKingCaptureMovedPiece(after, move)) {
      return 15000 + PIECE_VALUES[move.piece]
    }
    const kingSquare = findKingSquare(before, oppositeColor(color))
    const distanceGain = kingSquare
      ? squareDistance(move.from, kingSquare) - squareDistance(move.to, kingSquare)
      : 0
    return 9000 + PIECE_VALUES[move.piece] + distanceGain * 120
  }

  if (move.captured && canStillBuildBishopKnight(after, color)) {
    return 7000 +
      PIECE_VALUES[move.captured] +
      routePressureGain * 80 +
      routeProgressGain * 260 +
      routeAfter.stablePawns * 300
  }

  if (move.piece === 'k' && canStillBuildBishopKnight(after, color)) {
    const kingSquare = findKingSquare(before, oppositeColor(color))
    const afterKingSquare = findKingSquare(after, oppositeColor(color))
    const routeSquare = routeAfter.bestPawn
    const blocksEnemyKing = kingSquare && afterKingSquare && routeSquare
      ? squareDistance(afterKingSquare, routeSquare) - squareDistance(kingSquare, routeSquare)
      : 0
    if (routePressureGain > 0 || blocksEnemyKing > 0) {
      return 4200 + routePressureGain * 70 + blocksEnemyKing * 180
    }
  }

  if (move.piece === 'p') {
    const advance = color === 'w'
      ? Number(move.to[1]) - Number(move.from[1])
      : Number(move.from[1]) - Number(move.to[1])
    return 6000 + advance * 260 + routePressureGain * 90 + routeProgressGain * 220
  }
  return 0
}

export function badMannersRouteScore(before, move, candidate = null, afterInput = null) {
  if (!before || !move) return 0
  const after = afterInput || cloneGame(before)
  if (!afterInput) after.move(move)
  const features = badMannersRouteFeatures(before, after, move, candidate)
  return Object.entries(BAD_MANNERS_ROUTE_WEIGHTS)
    .reduce((total, [key, weight]) => total + (features[key] || 0) * weight, 0)
}

export function badMannersRouteFeatures(before, after, move, candidate = null) {
  const color = move.color
  const opponent = oppositeColor(color)
  const beforeOwn = materialCounts(before, color)
  const afterOwn = materialCounts(after, color)
  const beforeOpponent = materialCounts(before, opponent)
  const afterOpponent = materialCounts(after, opponent)
  const hadPair = beforeOwn.b >= 1 && beforeOwn.n >= 1
  const hasPair = afterOwn.b >= 1 && afterOwn.n >= 1
  const opponentBareKing = afterOpponent.p + afterOpponent.n + afterOpponent.b + afterOpponent.r + afterOpponent.q === 0
  const routeBefore = promotionRouteInfo(before, color)
  const routeAfter = promotionRouteInfo(after, color)
  const enemyKingBefore = findKingSquare(before, opponent)
  const enemyKingAfter = findKingSquare(after, opponent)
  const routeSquare = routeAfter.bestPawn
  const keyPieceHanging = keyBishopKnightResourceCanBeCaptured(after, color)
  const pureKbnk = isBishopKnightMatePosition(after, color)
  const preserveWinMargin = Number.isFinite(candidate?.score)
    ? Math.max(0, Math.min(candidate.score, 1200))
    : 0
  const kbnCornerProgress = hasPair && opponentBareKing
    ? bishopKnightCornerProgress(before, after, color)
    : 0
  const surplusCanBeTaken = hadPair && isSurplusPiece(beforeOwn, move.piece) &&
    canOpponentKingCaptureMovedPiece(after, move)
      ? 1
      : 0
  const surplusNearKing = hadPair && isSurplusPiece(beforeOwn, move.piece) && enemyKingAfter
    ? Math.max(0, 8 - squareDistance(move.to, enemyKingAfter))
    : 0
  const kingBlocksRoute = move.piece === 'k' && enemyKingBefore && enemyKingAfter && routeSquare
    ? Math.max(0, squareDistance(enemyKingAfter, routeSquare) - squareDistance(enemyKingBefore, routeSquare))
    : 0
  const pawnAdvance = move.piece === 'p'
    ? Math.max(0, color === 'w'
      ? Number(move.to[1]) - Number(move.from[1])
      : Number(move.from[1]) - Number(move.to[1]))
    : 0
  const objectiveReachableAfter = isBishopKnightObjectiveReachable(after, color)

  return {
    createsPair: !hadPair && hasPair ? 1 : 0,
    minorPromotion: ['b', 'n'].includes(move.promotion) ? 1 : 0,
    pureKbnk: pureKbnk ? 1 : 0,
    surplusCanBeTaken,
    surplusNearKing,
    surplusCheck: hadPair && isSurplusPiece(beforeOwn, move.piece) && move.san.includes('+') ? 1 : 0,
    captureMaterial: move.captured ? PIECE_VALUES[move.captured] || 0 : 0,
    pawnAdvance,
    routeProgressGain: Math.max(0, routeAfter.bestProgress - routeBefore.bestProgress),
    routePressureDrop: Math.max(0, routeBefore.pressure - routeAfter.pressure),
    stablePawnGain: Math.max(0, routeAfter.stablePawns - routeBefore.stablePawns),
    kingBlocksRoute,
    kbnCornerProgress,
    preserveWinMargin,
    objectiveLostPenalty: objectiveReachableAfter ? 0 : 1,
    keyPieceHangingPenalty: keyPieceHanging ? 1 : 0,
    queenPromotionPenalty: move.promotion && !['b', 'n'].includes(move.promotion) ? 1 : 0,
    immediateNonKbnMatePenalty: after.isCheckmate() && !pureKbnk ? 1 : 0,
    drawPenalty: after.isDraw() ? 1 : 0,
    hadPair: hadPair ? 1 : 0,
    hasPair: hasPair ? 1 : 0,
    opponentMaterialBefore: beforeOpponent.p + beforeOpponent.n + beforeOpponent.b + beforeOpponent.r + beforeOpponent.q,
  }
}

function keyBishopKnightResourceCanBeCaptured(game, color) {
  const own = materialCounts(game, color)
  const missingBishop = own.b === 0
  const missingKnight = own.n === 0
  return game.moves({ verbose: true }).some((reply) => {
    if (!reply.captured) return false
    if (reply.captured === 'b' && own.b <= 1) return true
    if (reply.captured === 'n' && own.n <= 1) return true
    if (reply.captured !== 'p' || (!missingBishop && !missingKnight)) return false
    const afterReply = cloneGame(game)
    afterReply.move(reply)
    return !canStillBuildBishopKnight(afterReply, color)
  })
}

function bishopKnightCornerProgress(before, after, color) {
  const beforeKing = findKingSquare(before, oppositeColor(color))
  const afterKing = findKingSquare(after, oppositeColor(color))
  const bishop = after.board().flat().find((piece) => piece?.color === color && piece.type === 'b')
  if (!beforeKing || !afterKing || !bishop) return 0
  const targetCorners = bishopSquareColor(bishop.square) === 0
    ? ['a1', 'h8']
    : ['a8', 'h1']
  const beforeDistance = Math.min(...targetCorners.map((corner) => squareDistance(beforeKing, corner)))
  const afterDistance = Math.min(...targetCorners.map((corner) => squareDistance(afterKing, corner)))
  return Math.max(0, beforeDistance - afterDistance)
}

function bishopSquareColor(square) {
  return (square.charCodeAt(0) - 'a'.charCodeAt(0) + Number(square[1])) % 2
}

function promotionRouteInfo(game, color) {
  const opponent = oppositeColor(color)
  const opponentMoves = legalMovesForColor(game, opponent)
  const info = { stablePawns: 0, pressure: 0, bestProgress: 0, bestPawn: null }
  for (const piece of game.board().flat()) {
    if (piece?.color !== color || piece.type !== 'p') continue
    if (!hasClearForwardPromotionLane(game, piece.square, color)) continue
    const progress = color === 'w' ? Number(piece.square[1]) : 9 - Number(piece.square[1])
    if (progress > info.bestProgress) {
      info.bestProgress = progress
      info.bestPawn = piece.square
    }
    let pawnPressure = 0
    for (const square of promotionPathSquares(piece.square, color)) {
      pawnPressure += opponentMoves.filter((move) => move.to === square).length
    }
    if (pawnPressure === 0) info.stablePawns += 1
    info.pressure += pawnPressure
  }
  return info
}

function promotionPathSquares(square, color) {
  const file = square[0]
  let rank = Number(square[1])
  const step = color === 'w' ? 1 : -1
  const promotionRank = color === 'w' ? 8 : 1
  const path = [square]
  while (rank !== promotionRank) {
    rank += step
    path.push(`${file}${rank}`)
  }
  return path
}

function legalMovesForColor(game, color) {
  if (game.turn() === color) return game.moves({ verbose: true })
  const parts = game.fen().split(' ')
  parts[1] = color
  try {
    return new Chess(parts.join(' ')).moves({ verbose: true })
  } catch {
    return []
  }
}

function isSurplusPiece(counts, type) {
  if (['p', 'q', 'r'].includes(type)) return counts[type] > 0
  if (type === 'b') return counts.b > 1
  if (type === 'n') return counts.n > 1
  return false
}

function canOpponentKingCaptureMovedPiece(game, move) {
  return game.moves({ verbose: true }).some((reply) =>
    reply.piece === 'k' &&
    reply.to === move.to &&
    Boolean(reply.captured),
  )
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
  if (own.b >= 1 && own.n >= 1) return isBishopKnightObjectiveReachable(game, color)
  return isBishopKnightObjectiveReachable(game, color) && bishopKnightPromotionUcis(game, color).length > 0
}

export function bishopKnightPromotionUcis(game, color = game.turn()) {
  const own = materialCounts(game, color)
  if (!((own.b >= 1 && own.n === 0) || (own.n >= 1 && own.b === 0))) return []
  return game.moves({ verbose: true })
    .filter((move) => move.color === color && ['b', 'n'].includes(move.promotion))
    .map((move) => `${move.from}${move.to}${move.promotion}`)
}

export function bishopKnightObjectiveUcis(game, color = game.turn()) {
  if (!isBishopKnightObjectiveReachable(game, color)) return []
  if (!isBishopKnightDisrespectPosition(game, color)) {
    return bishopKnightPromotionUcis(game, color)
  }
  const own = materialCounts(game, color)
  const hasPair = own.b >= 1 && own.n >= 1
  return game.moves({ verbose: true })
    .filter((move) => {
      if (move.color !== color) return false
      if (move.promotion) return ['b', 'n'].includes(move.promotion)
      if (hasPair) return isSurplusPiece(own, move.piece)
      return move.piece === 'p'
    })
    .map(moveToUci)
}

function hasBishopKnightPair(game, color) {
  const own = materialCounts(game, color)
  return own.b >= 1 && own.n >= 1
}

export function isBishopKnightDisrespectPosition(game, color) {
  const opponent = materialCounts(game, oppositeColor(color))
  const opponentBareKing = opponent.p === 0 &&
    opponent.n === 0 &&
    opponent.b === 0 &&
    opponent.r === 0 &&
    opponent.q === 0
  if (!opponentBareKing || isBishopKnightMatePosition(game, color)) return false
  return isBishopKnightObjectiveReachable(game, color)
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

function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}

function oppositeColor(color) {
  return color === 'w' ? 'b' : 'w'
}

function findKingSquare(game, color) {
  return game.board().flat().find((piece) => piece?.color === color && piece.type === 'k')?.square || null
}

function squareDistance(a, b) {
  return Math.max(
    Math.abs(a.charCodeAt(0) - b.charCodeAt(0)),
    Math.abs(Number(a[1]) - Number(b[1])),
  )
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
