const MAX_UCI_ELO = 3190
const MIN_UCI_ELO = 1320

export function initialVariantElo(profile) {
  return Number(profile?.variant?.initialElo ?? profile?.displayRating ?? 0)
}

export function runningVariantElo(profile, events = {}) {
  const variant = profile?.variant
  if (!variant) return initialVariantElo(profile)

  const eventCount = variantEventCount(variant.type, events)
  const unclamped = initialVariantElo(profile) + Number(variant.eloDelta || 0) * eventCount
  return clamp(unclamped, Number(variant.minElo ?? -Infinity), Number(variant.maxElo ?? Infinity))
}

export function variantEngineElo(profile, events = {}) {
  const rating = runningVariantElo(profile, events)
  if (rating >= MAX_UCI_ELO) return undefined
  return clamp(rating, MIN_UCI_ELO, MAX_UCI_ELO)
}

export function selectIWantCheckmateCandidate(profile, candidates, random = Math.random) {
  const sorted = normalizeCandidates(candidates)
  if (!sorted.length) return null

  const variant = profile?.variant || {}
  if (variant.type === 'ranked-move') {
    return sorted.find((candidate) => candidate.rank === variant.rank) || sorted[0]
  }
  if (variant.type === 'random-top-n') {
    const options = sorted.slice(0, Math.max(1, Number(variant.count || 1)))
    return options[Math.min(options.length - 1, Math.floor(safeRandom(random) * options.length))]
  }
  if (variant.type === 'random-blunder') {
    if (safeRandom(random) >= Number(variant.chance || 0)) return sorted[0]
    const blunders = sorted.slice(Math.min(1, sorted.length - 1))
    return blunders[Math.min(blunders.length - 1, Math.floor(safeRandom(random) * blunders.length))]
  }
  if (variant.type === 'target-evaluation') {
    const target = Number(variant.targetCp || 0)
    return [...sorted].sort((a, b) =>
      Math.abs(candidateScore(a) - target) - Math.abs(candidateScore(b) - target) || a.rank - b.rank,
    )[0]
  }
  return sorted[0]
}

function variantEventCount(type, events) {
  if (type === 'own-move') return whole(events.botMoves)
  if (type === 'opponent-check') return whole(events.opponentChecks)
  if (type === 'opponent-best-move') return whole(events.opponentBestMoves)
  if (type === 'opponent-worst-move') return whole(events.opponentWorstMoves)
  return 0
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

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}
