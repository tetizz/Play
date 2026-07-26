const MAX_UCI_ELO = 3190
const MIN_UCI_ELO = 1320
const MARTIN_ELO = 250
const MARTIN_OPENING_MOVES = 4
const MARTIN_POLICY_TYPES = new Set([
  'martin',
  'cycle',
  'random-hybrid',
  'evil-martin',
])

export function initialVariantElo(profile) {
  const value = profile?.variant?.initialElo
  return Number.isFinite(value) ? Number(value) : null
}

export function variantEventField(profile) {
  const trigger = profile?.variant?.trigger
  if (trigger === 'own-move') return 'botMoves'
  if (trigger === 'own-capture-or-check') return 'botCaptureChecks'
  if (trigger === 'opponent-check') return 'opponentChecks'
  if (trigger === 'opponent-best-move') return 'opponentBestMoves'
  if (trigger === 'opponent-worst-move') return 'opponentWorstMoves'
  return null
}

export function runningVariantElo(profile, events = {}) {
  const initial = initialVariantElo(profile)
  if (!Number.isFinite(initial)) return null
  if (Number.isFinite(events?.currentElo)) return Number(events.currentElo)

  const variant = profile?.variant || {}
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
    Number(profile?.variant?.eloDelta) < 0
  if (fadingBelowUciRange) {
    return selectCalibratedWeakMove(sorted, rating, random, context)
  }
  const dynamicHighRating =
    Number.isFinite(rating) &&
    rating > MAX_UCI_ELO &&
    rating < 3600 &&
    Number(profile?.variant?.eloDelta || 0) !== 0
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
    const isAwake = Number(context.evaluation ?? candidateScore(sorted[0])) < -80
    return isAwake
      ? sorted[0]
      : selectCalibratedWeakMove(
          sorted,
          Number(policy.sleepyElo || MARTIN_ELO),
          random,
          context,
        )
  }
  if (policy.type === 'rating-strength' && Number.isFinite(rating) && rating < MIN_UCI_ELO) {
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

export function isEvilMartinAwake(profile, candidates) {
  if (profile?.variant?.movePolicy?.type !== 'evil-martin') return false
  const sorted = normalizeCandidates(candidates)
  return Number(candidateScore(sorted[0])) < -80
}

export function resolveIWantCheckmateAvatar(profile, events = {}) {
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
