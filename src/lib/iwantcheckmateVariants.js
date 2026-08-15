const MAX_UCI_ELO = 3190
const MIN_UCI_ELO = 1320
const MARTIN_ELO = 250
const MARTIN_OPENING_MOVES = 4
const MARTIN_POLICY_TYPES = new Set([
  'martin',
  'cycle',
  'random-hybrid',
  'evil-martin',
  'capture-toggle',
])

export function initialVariantElo(profile) {
  const value = profile?.variant?.initialElo
  return Number.isFinite(value) ? Number(value) : null
}

export function variantEventField(profile) {
  const trigger = profile?.variant?.trigger
  if (trigger === 'own-move') return 'botMoves'
  if (trigger === 'own-capture-or-check') return 'botCaptureChecks'
  if (trigger === 'own-capture') return 'botCaptures'
  if (trigger === 'opponent-check') return 'opponentChecks'
  if (trigger === 'opponent-best-move') return 'opponentBestMoves'
  if (trigger === 'opponent-non-best-move') return 'opponentNonBestMoves'
  if (trigger === 'opponent-worst-move') return 'opponentWorstMoves'
  return null
}

export function runningVariantElo(profile, events = {}) {
  const initial = initialVariantElo(profile)
  if (!Number.isFinite(initial)) return null

  const variant = profile?.variant || {}
  const policy = variant.movePolicy || {}
  if (policy.type === 'capture-toggle') {
    return whole(events.botCaptures) % 2 === 0
      ? Number(policy.stockfishElo ?? initial)
      : Number(policy.martinElo ?? variant.minElo ?? MARTIN_ELO)
  }
  if (Number.isFinite(events?.currentElo)) return Number(events.currentElo)

  const field = variantEventField(profile)
  const count = field ? whole(events[field]) : 0
  const unclamped = initial + Number(variant.eloDelta || 0) * count
  return clamp(
    unclamped,
    Number(variant.minElo ?? -Infinity),
    Number(variant.maxElo ?? Infinity),
  )
}

export function variantEngineElo(profile, events = {}) {
  const rating = runningVariantElo(profile, events)
  if (
    !Number.isFinite(rating) ||
    rating > MAX_UCI_ELO ||
    rating < MIN_UCI_ELO
  ) {
    return undefined
  }
  return rating
}

export function selectIWantCheckmateCandidate(
  profile,
  candidates,
  random = Math.random,
  context = {},
) {
  const policy = profile?.variant?.movePolicy || { type: 'best' }
  const martinDerived = isMartinDerived(profile, policy)
  const suppliedCandidates = normalizeCandidates(candidates)
  const boardMates = martinDerived
    ? guaranteedMateInOneCandidates(context.game)
    : []
  const boardMateUcis = new Set(boardMates.map((candidate) => candidate.uci))
  const allCandidates = normalizeCandidates([
    ...boardMates,
    ...suppliedCandidates.filter((candidate) => !boardMateUcis.has(candidate.uci)),
  ])

  const rating = Number.isFinite(context.rating)
    ? Number(context.rating)
    : runningVariantElo(profile, context.events)
  const martinMate = martinDerived ? selectMateInOne(allCandidates) : null

  if (martinMate) return martinMate

  const sorted = martinDerived
    ? martinMateSafeCandidates(context.game, allCandidates)
    : allCandidates
  if (!sorted.length) return null

  const fadingBelowUciRange =
    Number.isFinite(rating) &&
    rating < MIN_UCI_ELO &&
    (
      Number(profile?.variant?.eloDelta) < 0 ||
      policy.type === 'time-ramp-strength'
    )
  if (fadingBelowUciRange) {
    return selectCalibratedWeakMove(sorted, rating, random, context)
  }
  const dynamicHighRating =
    Number.isFinite(rating) &&
    rating > MAX_UCI_ELO &&
    rating < 3600 &&
    (
      Number(profile?.variant?.eloDelta || 0) !== 0 ||
      policy.type === 'time-ramp-strength'
    )
  if (dynamicHighRating) {
    return selectCalibratedHighRatingMove(sorted, rating, random)
  }

  if (policy.type === 'ranked-move') {
    return sorted.find((candidate) => candidate.rank === policy.rank) || sorted[0]
  }
  if (policy.type === 'random-top-n') {
    return randomChoice(
      sorted.slice(0, Math.max(1, Number(policy.count || 1))),
      random,
    )
  }
  if (policy.type === 'geometric-ranked') {
    return geometricRankChoice(
      sorted.slice(0, Math.max(1, Number(policy.count || 6))),
      Number(policy.firstWeight || 0.5),
      random,
    )
  }
  if (policy.type === 'mirror-rank') {
    const requestedRank = Math.max(1, whole(context.events?.lastOpponentMoveRank) || 1)
    return [...sorted].sort((a, b) =>
      Math.abs(a.rank - requestedRank) - Math.abs(b.rank - requestedRank) ||
      a.rank - b.rank,
    )[0]
  }
  if (policy.type === 'alternating-square') {
    const startsOn = policy.startsOn === 'dark' ? 'dark' : 'light'
    const wantsStartColor = whole(context.events?.botMoves) % 2 === 0
    const wantedColor = wantsStartColor
      ? startsOn
      : startsOn === 'light' ? 'dark' : 'light'
    return sorted.find((candidate) => squareColor(candidate?.move?.to) === wantedColor) || sorted[0]
  }
  if (policy.type === 'forcing-check') {
    return sorted.find((candidate) => candidateGivesCheck(context.game, candidate)) || sorted[0]
  }
  if (policy.type === 'queen-hunter') {
    return selectQueenHunterMove(context.game, sorted)
  }
  if (policy.type === 'pawn-as-queen') {
    return selectPawnAsQueenMove(context.game, sorted)
  }
  if (policy.type === 'random-blunder') {
    if (safeRandom(random) >= Number(policy.chance || 0)) return sorted[0]
    const bestScore = candidateScore(sorted[0])
    const minimumLoss = Number(policy.minimumLossCp || 200)
    const realBlunders = sorted.filter((candidate) =>
      Number.isFinite(bestScore) &&
      Number.isFinite(candidateScore(candidate)) &&
      bestScore - candidateScore(candidate) >= minimumLoss,
    )
    return realBlunders.sort((a, b) =>
      candidateScore(a) - candidateScore(b) || b.rank - a.rank,
    )[0] || sorted[0]
  }
  if (policy.type === 'target-evaluation') {
    const target = Number(policy.targetCp || 0)
    return [...sorted].sort((a, b) =>
      Math.abs(candidateScore(a) - target) - Math.abs(candidateScore(b) - target) ||
      a.rank - b.rank,
    )[0]
  }
  if (policy.type === 'worst-move') {
    return [...sorted].sort((a, b) =>
      candidateScore(a) - candidateScore(b) || b.rank - a.rank,
    )[0]
  }
  if (policy.type === 'martin') {
    return selectCalibratedWeakMove(sorted, MARTIN_ELO, random, context)
  }
  if (policy.type === 'capture-toggle') {
    return Number(rating) <= Number(policy.martinElo ?? MARTIN_ELO)
      ? selectCalibratedWeakMove(
          sorted,
          Number(policy.martinElo ?? MARTIN_ELO),
          random,
          context,
        )
      : sorted[0]
  }
  if (policy.type === 'cycle') {
    const stockfishMoves = Math.max(1, whole(policy.stockfishMoves))
    const martinMoves = Math.max(1, whole(policy.martinMoves))
    const period = stockfishMoves + martinMoves
    const turn = whole(context.events?.botMoves) % period
    return turn < stockfishMoves
      ? sorted[0]
      : selectCalibratedWeakMove(sorted, MARTIN_ELO, random, context)
  }
  if (policy.type === 'random-hybrid') {
    return safeRandom(random) < Number(policy.stockfishChance ?? 0.8)
      ? sorted[0]
      : selectCalibratedWeakMove(sorted, MARTIN_ELO, random, context)
  }
  if (policy.type === 'evil-martin') {
    const isAwake = isEvilMartinAwake(profile, sorted, context)
    return isAwake
      ? sorted[0]
      : selectCalibratedWeakMove(
          sorted,
          Number(policy.sleepyElo || MARTIN_ELO),
          random,
          context,
        )
  }
  if (
    ['rating-strength', 'time-ramp-strength'].includes(policy.type) &&
    Number.isFinite(rating) &&
    rating < MIN_UCI_ELO
  ) {
    return selectCalibratedWeakMove(sorted, rating, random, context)
  }
  return sorted[0]
}

export function guaranteedMateInOneCandidates(game) {
  if (!game?.fen || !game?.moves) return []
  const startingFen = game.fen()
  const working = new game.constructor(startingFen)
  return game.moves({ verbose: true }).flatMap((move) => {
    try {
      working.move(move)
    } catch {
      return []
    }
    const isMate = working.isCheckmate()
    working.undo()
    if (!isMate) return []
    const uci = `${move.from}${move.to}${move.promotion || ''}`
    return [{
      uci,
      score: 100000,
      mate: 1,
      rank: 0,
      pv: [uci],
      move,
      mateSafety: true,
    }]
  })
}

function martinMateSafeCandidates(game, candidates) {
  if (!game?.fen || !game?.moves) return candidates

  const safeCandidates = candidates.filter((candidate) =>
    isMateSafeMove(game, candidateUci(candidate)),
  )
  if (safeCandidates.length) return safeCandidates

  const safeMoves = game.moves({ verbose: true }).filter((move) =>
    isMateSafeMove(game, move),
  )
  if (!safeMoves.length) return candidates

  const finiteScores = candidates
    .map(candidateScore)
    .filter(Number.isFinite)
  const fallbackScore = finiteScores.length
    ? Math.min(...finiteScores) - 1
    : -100000

  return safeMoves.map((move, index) => {
    const uci = moveUci(move)
    return {
      uci,
      score: fallbackScore - index,
      rank: candidates.length + index + 1,
      pv: [uci],
      move,
      mateSafety: true,
    }
  })
}

function isMateSafeMove(game, move) {
  let after
  try {
    after = new game.constructor(game.fen())
    after.move(move)
  } catch {
    return false
  }
  return after.isGameOver() || !hasMateInOne(after)
}

function hasMateInOne(game) {
  for (const move of game.moves({ verbose: true })) {
    game.move(move)
    const isMate = game.isCheckmate()
    game.undo()
    if (isMate) return true
  }
  return false
}

export function isMartinDerivedProfile(profile) {
  return isMartinDerived(profile, profile?.variant?.movePolicy)
}

export function isEvilMartinAwake(profile, candidates, context = {}) {
  const policy = profile?.variant?.movePolicy
  if (policy?.type !== 'evil-martin') return false
  const events = context?.events || context
  if (policy.permanentWake !== false && events?.evilAwake === true) return true

  const sorted = normalizeCandidates(candidates)
  const threshold = Number.isFinite(policy.wakeThresholdCp)
    ? Number(policy.wakeThresholdCp)
    : -600
  const evaluation = Number.isFinite(context?.evaluation)
    ? Number(context.evaluation)
    : candidateScore(sorted[0])
  return Number.isFinite(evaluation) && evaluation <= threshold
}

export function resolveIWantCheckmateAvatar(profile, events = {}) {
  if (
    profile?.variant?.movePolicy?.type === 'capture-toggle' &&
    profile.avatarStates
  ) {
    const policy = profile.variant.movePolicy
    const rating = runningVariantElo(profile, events)
    const avatarState = rating <= Number(policy.martinElo ?? MARTIN_ELO)
      ? 'martin'
      : 'stockfish'
    const identity = profile.identityStates?.[avatarState] || {}
    return Object.freeze({
      ...profile,
      ...identity,
      fullName: identity.name || profile.fullName,
      avatar: profile.avatarStates[avatarState] || profile.avatar,
      avatarState,
    })
  }
  if (
    profile?.variant?.movePolicy?.type !== 'evil-martin' ||
    !profile.avatarStates
  ) {
    return profile
  }
  const avatarState = events?.evilAwake ? 'evil' : 'sleepy'
  const avatar = profile.avatarStates[avatarState] || profile.avatar
  return Object.freeze({
    ...profile,
    avatar,
    avatarState,
  })
}

function selectCalibratedWeakMove(candidates, rating, random, context = {}) {
  if (candidates.length === 1) return candidates[0]
  const belowMartin = clamp(
    (MARTIN_ELO - Number(rating || 0)) / MARTIN_ELO,
    0,
    1,
  )
  const linearStrength = clamp(
    (Number(rating || MARTIN_ELO) - MARTIN_ELO) / (MIN_UCI_ELO - MARTIN_ELO),
    0,
    1,
  )
  const strength = smoothStep(linearStrength)
  const botMoves = whole(context.events?.botMoves)
  const openingMemoryChance =
    interpolate(0.68, 0.9, strength) * (1 - belowMartin * 0.8)
  if (
    botMoves < MARTIN_OPENING_MOVES &&
    candidates.some((candidate) => candidate?.move?.piece) &&
    safeRandom(random) < openingMemoryChance
  ) {
    const optionCount = Math.min(
      candidates.length,
      Math.max(2, Math.round(interpolate(5, 2, strength))),
    )
    return selectOpeningMemoryMove(
      candidates.slice(0, optionCount),
      strength,
      botMoves,
      random,
    )
  }

  const findsBestChance =
    interpolate(0.01, 0.78, strength ** 1.7) * (1 - belowMartin)
  if (safeRandom(random) < findsBestChance) return candidates[0]

  const bestScore = candidateScore(candidates[0])
  if (Number.isFinite(bestScore)) {
    const targetLoss = martinTargetLoss(strength, random) * (1 + belowMartin * 1.2)
    return [...candidates].sort((a, b) =>
      martinTargetDistance(a, bestScore, targetLoss, strength, botMoves) -
        martinTargetDistance(b, bestScore, targetLoss, strength, botMoves) ||
      a.rank - b.rank,
    )[0]
  }

  const targetIndex = Math.round((1 - strength) * (candidates.length - 1))
  const jitterSpan = Math.max(0, Math.round((1 - strength) * 2))
  const jitter = jitterSpan
    ? Math.floor(safeRandom(random) * (jitterSpan * 2 + 1)) - jitterSpan
    : 0
  return candidates[clamp(targetIndex + jitter, 0, candidates.length - 1)]
}

function selectCalibratedHighRatingMove(candidates, rating, random) {
  const best = candidates[0]
  if (!best || candidates.length === 1) return best || null

  const strength = clamp(
    (Number(rating) - MAX_UCI_ELO) / (3600 - MAX_UCI_ELO),
    0,
    1,
  )
  const bestScore = candidateScore(best)
  if (!Number.isFinite(bestScore)) return best

  const maximumLoss = interpolate(55, 0, strength ** 1.1)
  const alternatives = candidates.slice(1).filter((candidate) => {
    const score = candidateScore(candidate)
    return Number.isFinite(score) && bestScore - score <= maximumLoss
  })
  if (!alternatives.length) return best

  const bestMoveChance = interpolate(0.78, 1, strength)
  if (safeRandom(random) < bestMoveChance) return best

  return alternatives
    .sort((a, b) =>
      candidateScore(b) - candidateScore(a) || a.rank - b.rank,
    )[0]
}

function selectOpeningMemoryMove(candidates, strength, botMoves, random) {
  const weights = candidates.map((candidate) => {
    const rankWeight = 1 / Math.max(1, candidate.rank) ** interpolate(0.7, 2.3, strength)
    const pieceWeight = 1 + martinStyleBonus(candidate, 0, strength, botMoves) / 180
    return rankWeight * pieceWeight
  })
  return weightedRandomChoice(candidates, weights, random)
}

function martinTargetLoss(strength, random) {
  const center = interpolate(760, 35, strength ** 0.85)
  const spread = interpolate(0.52, 0.12, strength)
  const scale = 1 - spread + safeRandom(random) * spread * 2
  return center * scale
}

function martinTargetDistance(candidate, bestScore, targetLoss, strength, botMoves) {
  const loss = Math.max(0, bestScore - candidateScore(candidate))
  return Math.abs(loss - targetLoss) -
    martinStyleBonus(candidate, loss, strength, botMoves)
}

function martinStyleBonus(candidate, loss, strength, botMoves) {
  const novice = 1 - strength
  const piece = candidate?.move?.piece
  let bonus = 0

  if (piece === 'p') {
    bonus += 105 * novice
    if (/^[ah][27][ah][3456]/.test(candidate?.uci || '')) bonus += 35 * novice
  }
  if (piece === 'q' && botMoves < 8) bonus += 95 * novice
  if (loss >= 180 && ['n', 'b', 'r', 'q'].includes(piece)) {
    bonus += 75 * novice
  }
  return bonus
}

function selectMateInOne(candidates) {
  return candidates
    .filter((candidate) => Number(candidate?.mate) === 1)
    .sort((a, b) => a.rank - b.rank)[0] || null
}

function candidateUci(candidate) {
  return candidate?.uci || moveUci(candidate?.move)
}

function moveUci(move) {
  if (!move?.from || !move?.to) return ''
  return `${move.from}${move.to}${move.promotion || ''}`
}

function isMartinDerived(profile, policy) {
  return profile?.category === 'martin' || MARTIN_POLICY_TYPES.has(policy?.type)
}

function randomChoice(options, random) {
  if (!options.length) return null
  return options[Math.min(options.length - 1, Math.floor(safeRandom(random) * options.length))]
}

function geometricRankChoice(options, firstWeight, random) {
  if (!options.length) return null
  if (options.length === 1) return options[0]

  const leadingWeight = clamp(firstWeight, 0.01, 0.99)
  const weights = options.map((_, index) =>
    index === options.length - 1
      ? 0
      : leadingWeight * ((1 - leadingWeight) ** index),
  )
  weights[weights.length - 1] = Math.max(
    0,
    1 - weights.reduce((total, weight) => total + weight, 0),
  )

  const roll = safeRandom(random)
  let cumulative = 0
  for (let index = 0; index < options.length; index += 1) {
    cumulative += weights[index]
    if (roll < cumulative) return options[index]
  }
  return options.at(-1)
}

function weightedRandomChoice(options, weights, random) {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0)
  if (total <= 0) return options[0] || null
  let roll = safeRandom(random) * total
  for (let index = 0; index < options.length; index += 1) {
    roll -= Math.max(0, weights[index])
    if (roll <= 0) return options[index]
  }
  return options.at(-1) || null
}

function normalizeCandidates(candidates) {
  return (Array.isArray(candidates) ? candidates : [])
    .filter(Boolean)
    .map((candidate, index) => ({ ...candidate, rank: Number(candidate.rank || index + 1) }))
    .sort((a, b) => a.rank - b.rank)
}

function candidateScore(candidate) {
  return Number.isFinite(candidate?.score) ? candidate.score : Number.POSITIVE_INFINITY
}

function squareColor(square) {
  if (!/^[a-h][1-8]$/.test(String(square || ''))) return null
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  return (file + rank) % 2 === 0 ? 'light' : 'dark'
}

function candidateGivesCheck(game, candidate) {
  if (/[+#]/.test(candidate?.move?.san || '')) return true
  const after = gameAfterCandidate(game, candidate)
  return Boolean(after?.isCheck?.())
}

function selectQueenHunterMove(game, candidates) {
  if (!game?.fen || !game?.get) return candidates[0]
  const botColor = game.turn()
  const opponentColor = botColor === 'w' ? 'b' : 'w'
  const queenSquare = findPieceSquare(game, opponentColor, 'q')
  if (!queenSquare) return candidates[0]

  return [...candidates].sort((a, b) =>
    queenHunterPriority(game, b, botColor, opponentColor) -
      queenHunterPriority(game, a, botColor, opponentColor) ||
    a.rank - b.rank,
  )[0]
}

function queenHunterPriority(game, candidate, botColor, opponentColor) {
  if (candidate?.move?.captured === 'q') return 1000000
  const queenCapturePly = principalVariationQueenCapturePly(
    game,
    candidate,
    botColor,
    opponentColor,
  )
  if (Number.isFinite(queenCapturePly)) return 500000 - queenCapturePly * 1000

  const after = gameAfterCandidate(game, candidate)
  if (!after) return 0
  const queenSquare = findPieceSquare(after, opponentColor, 'q')
  if (!queenSquare) return 1000000
  return after.attackers?.(queenSquare, botColor)?.length ? 100000 : 0
}

function principalVariationQueenCapturePly(game, candidate, botColor, opponentColor) {
  const after = cloneGame(game)
  if (!after) return null
  const line = [candidateUci(candidate), ...(candidate?.pv || [])]
    .filter(Boolean)
    .filter((uci, index, values) => index === 0 || uci !== values[index - 1])
  for (let index = 0; index < Math.min(10, line.length); index += 1) {
    const mover = after.turn()
    let played
    try {
      played = after.move(line[index])
    } catch {
      return null
    }
    if (
      mover === botColor &&
      played?.captured === 'q' &&
      findPieceSquare(after, opponentColor, 'q') === null
    ) {
      return index
    }
  }
  return null
}

function selectPawnAsQueenMove(game, candidates) {
  if (!game?.fen || !game?.get) return candidates[0]
  const botColor = game.turn()
  const opponentColor = botColor === 'w' ? 'b' : 'w'
  return [...candidates].sort((a, b) =>
    pawnAsQueenPriority(game, b, botColor, opponentColor) -
      pawnAsQueenPriority(game, a, botColor, opponentColor) ||
    a.rank - b.rank,
  )[0]
}

function pawnAsQueenPriority(game, candidate, botColor, opponentColor) {
  let priority = candidate?.move?.captured === 'p' ? 8000 : 0
  const after = gameAfterCandidate(game, candidate)
  if (!after) return priority

  for (const square of pieceSquares(after, opponentColor, 'p')) {
    priority += (after.attackers?.(square, botColor)?.length || 0) * 500
  }
  const destination = candidate?.move?.to
  if (destination && pawnAttacksSquare(after, opponentColor, destination)) {
    priority -= 6000
  }
  return priority
}

function pawnAttacksSquare(game, color, target) {
  const targetFile = target.charCodeAt(0) - 97
  const targetRank = Number(target[1])
  const pawnRank = targetRank + (color === 'w' ? -1 : 1)
  if (pawnRank < 1 || pawnRank > 8) return false
  return [-1, 1].some((offset) => {
    const pawnFile = targetFile + offset
    if (pawnFile < 0 || pawnFile > 7) return false
    const square = `${String.fromCharCode(97 + pawnFile)}${pawnRank}`
    const piece = game.get(square)
    return piece?.color === color && piece?.type === 'p'
  })
}

function gameAfterCandidate(game, candidate) {
  const after = cloneGame(game)
  if (!after) return null
  try {
    after.move(candidateUci(candidate))
    return after
  } catch {
    return null
  }
}

function cloneGame(game) {
  if (!game?.fen || !game?.constructor) return null
  try {
    return new game.constructor(game.fen())
  } catch {
    return null
  }
}

function findPieceSquare(game, color, type) {
  return pieceSquares(game, color, type)[0] || null
}

function pieceSquares(game, color, type) {
  const squares = []
  for (let rank = 1; rank <= 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const square = `${String.fromCharCode(97 + file)}${rank}`
      const piece = game.get(square)
      if (piece?.color === color && piece?.type === type) squares.push(square)
    }
  }
  return squares
}

function safeRandom(random) {
  const value = Number(random())
  return Number.isFinite(value) ? clamp(value, 0, 0.999999999) : 0
}

function whole(value) {
  return Math.max(0, Math.floor(Number(value) || 0))
}

function interpolate(start, end, amount) {
  return start + (end - start) * amount
}

function smoothStep(value) {
  return value * value * (3 - 2 * value)
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}
