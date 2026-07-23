import { Chess } from 'chess.js'
import { isAutomaticDraw } from './gameSession.js'
import {
  accuracyFromExpectedPointsLoss,
  CLASSIFICATIONS,
  classifyMove,
  expectedPointsFromScore,
} from './bookupClassifications.js'

const REVIEW_OPTIONS = { depth: 22, depthOnly: true, count: 6, timeout: 9800 }
const TACTICAL_OPTIONS = { depth: 24, depthOnly: true, count: 8, timeout: 15000 }
const SHORT_REVIEW_OPTIONS = { depth: 12, moveTime: 260, count: 4, timeout: 1800 }
const SHORT_TACTICAL_OPTIONS = { depth: 16, moveTime: 800, count: 5, timeout: 3000 }
const MEDIUM_REVIEW_OPTIONS = { depth: 16, moveTime: 380, count: 5, timeout: 2600 }
const MEDIUM_TACTICAL_OPTIONS = { depth: 20, moveTime: 700, count: 6, timeout: 4200 }
const LONG_REVIEW_OPTIONS = { depth: 12, moveTime: 220, count: 4, timeout: 1600 }
const LONG_TACTICAL_OPTIONS = { depth: 16, moveTime: 420, count: 5, timeout: 2600 }
const HUGE_REVIEW_OPTIONS = { depth: 10, moveTime: 160, count: 4, timeout: 1200 }
const HUGE_TACTICAL_OPTIONS = { depth: 14, moveTime: 320, count: 5, timeout: 2100 }
const CLASSIFICATION_ORDER = [
  'brilliant',
  'great',
  'book',
  'best',
  'excellent',
  'good',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
  'forced',
  'unreviewed',
]
const PIECE_NAMES = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

export async function reviewGameWithStockfish({
  history,
  client,
  playedClient = client,
  repertoire = {},
  resultOverride = null,
  onProgress = () => {},
  signal,
}) {
  const game = new Chess()
  const moments = []
  const positions = [game.fen()]
  const graph = [{ ply: 0, score: null, mate: null, percent: 50 }]
  const policy = reviewPolicyForLength(history.length)
  const { reviewOptions, tacticalOptions } = policy
  let remainingDeepPasses = policy.maxDeepPasses

  for (let index = 0; index < history.length; index += 1) {
    throwIfReviewAborted(signal)
    const beforeFen = game.fen()
    const beforeHistory = game.history()
    const legalMoveCount = game.moves().length
    const side = game.turn()
    const san = history[index]
    const verboseMove = game.moves({ verbose: true }).find((candidate) => candidate.san === san)
    if (!verboseMove) continue

    const playedUci = toUci(verboseMove)
    const phase = phaseForPosition(game, index)
    let candidates = await safeAnalyze(client, beforeFen, reviewOptions, signal)
    let playedLine = findCandidateLine(candidates, playedUci)
    if ((policy.exactCandidate || !playedLine) && candidates.length) {
      playedLine = await analyzeExactPlayedMove(
        playedClient,
        beforeFen,
        playedUci,
        reviewOptions,
        signal,
      ) ||
        playedLine
    }

    const tacticalCandidate = shouldDeepenReviewMove({
      candidates,
      move: verboseMove,
      phase,
      playedLine,
      policy,
    })
    if (tacticalCandidate && remainingDeepPasses > 0) {
      remainingDeepPasses -= 1
      const deeper = await safeAnalyze(client, beforeFen, tacticalOptions, signal)
      if (deeper.length) candidates = deeper
      const deeperCandidatePlayed = candidates.find((line) => sameUci(line.uci, playedUci))
      if (deeperCandidatePlayed && !policy.exactCandidate) {
        playedLine = deeperCandidatePlayed
      } else {
        playedLine = await analyzeExactPlayedMove(
          playedClient,
          beforeFen,
          playedUci,
          tacticalOptions,
          signal,
        ) ||
          playedLine
      }
    }

    throwIfReviewAborted(signal)
    game.move(verboseMove)
    positions.push(game.fen())
    if (!playedLine) {
      playedLine = await analyzePlayedMove(
        client,
        game,
        verboseMove,
        reviewOptions,
        signal,
      )
    }
    throwIfReviewAborted(signal)

    const bestLine = candidates[0] || null
    const beforeEvaluation = whitePerspective(side, bestLine)
    const afterEvaluation = whitePerspective(side, playedLine)
    if (index === 0 && hasEngineEvaluation(bestLine)) {
      graph[0] = graphPoint(0, beforeEvaluation.score, beforeEvaluation.mate)
    }
    const sideRepertoire = repertoire.white || repertoire.black
      ? repertoire[side === 'w' ? 'white' : 'black'] || {}
      : repertoire
    const inBook = isRepertoireMove(sideRepertoire, beforeHistory, beforeFen, san)
    const hasEvaluation = hasEngineEvaluation(bestLine) && hasEngineEvaluation(playedLine)
    const classification = hasEvaluation
      ? classifyMove({
          beforeFen,
          move: verboseMove,
          bestLine,
          playedLine,
          candidateLines: candidates,
          legalMoveCount,
          openingPhase: phase === 'opening',
          inBook,
          isPlayerMove: true,
        })
      : fallbackClassification(game)

    const bestLineUci = principalVariation(bestLine)
    const playedLineUci = principalVariation(playedLine)
    const bestLineSan = uciLineToSan(beforeFen, bestLineUci)
    const playedLineSan = uciLineToSan(beforeFen, playedLineUci)
    const moment = {
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      side,
      phase,
      san,
      uci: toUci(verboseMove),
      beforeFen,
      afterFen: game.fen(),
      bestMove: bestLine?.uci || null,
      bestMoveSan: bestLineSan[0] || null,
      bestLine: bestLineUci,
      bestLineSan,
      playedLine: playedLineUci,
      playedLineSan,
      scoreBefore: beforeEvaluation.score,
      scoreAfter: afterEvaluation.score,
      mateBefore: beforeEvaluation.mate,
      mateAfter: afterEvaluation.mate,
      evaluationChange: scoreChange(beforeEvaluation.score, afterEvaluation.score),
      centipawnLoss: scoreDifference(bestLine?.score, playedLine?.score),
      accuracy: accuracyFromExpectedPointsLoss(
        classification.expectedPointsLoss,
        classification.key,
      ),
      ...classification,
    }
    moment.explanation = explainMove({
      beforeFen,
      move: verboseMove,
      moment,
    })
    moments.push(moment)
    const previousGraphPoint = graph.at(-1)
    const graphEvaluation = hasEngineEvaluation(playedLine)
      ? afterEvaluation
      : {
          score: previousGraphPoint?.score ?? null,
          mate: previousGraphPoint?.mate ?? null,
        }
    graph.push(graphPoint(
      index + 1,
      graphEvaluation.score,
      graphEvaluation.mate,
      classification.key === 'unreviewed' ? null : classification,
    ))
    throwIfReviewAborted(signal)
    onProgress({ completed: index + 1, total: history.length, moment })
  }

  return finalizeReview({
    engine: 'Stockfish 18',
    game,
    positions,
    moments,
    graph,
    resultOverride,
  })
}

export function buildFallbackFinalReview(history, resultOverride = null) {
  const game = new Chess()
  const positions = [game.fen()]
  const moments = []
  const graph = [{ ply: 0, score: 0, mate: null, percent: 50 }]
  history.forEach((san, index) => {
    const beforeFen = game.fen()
    const side = game.turn()
    const phase = phaseForPosition(game, index)
    const move = game.move(san)
    if (!move) return
    positions.push(game.fen())
    const classification = fallbackClassification(game)
    const moment = {
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      side,
      phase,
      san,
      uci: toUci(move),
      beforeFen,
      afterFen: game.fen(),
      bestMove: null,
      bestMoveSan: null,
      bestLine: [],
      bestLineSan: [],
      playedLine: [],
      playedLineSan: [],
      scoreBefore: 0,
      scoreAfter: 0,
      mateBefore: null,
      mateAfter: null,
      evaluationChange: 0,
      centipawnLoss: null,
      accuracy: accuracyFromExpectedPointsLoss(
        classification.expectedPointsLoss,
        classification.key,
      ),
      ...classification,
    }
    moment.explanation = explainMove({ beforeFen, move, moment })
    moments.push(moment)
    graph.push(graphPoint(index + 1, 0, null, classification))
  })
  return finalizeReview({
    engine: 'Local fallback',
    game,
    positions,
    moments,
    graph,
    resultOverride,
  })
}

export function evaluationToWhitePercent(score, mate = null) {
  if (Number.isFinite(mate)) return mate > 0 ? 100 : 0
  if (!Number.isFinite(score)) return 50
  return roundTo(100 / (1 + Math.exp(-score / 220)), 2)
}

export function reviewPolicyForLength(totalPlies) {
  if (totalPlies <= 8) {
    return {
      reviewOptions: SHORT_REVIEW_OPTIONS,
      tacticalOptions: SHORT_TACTICAL_OPTIONS,
      maxDeepPasses: Number.POSITIVE_INFINITY,
      tacticalLossThreshold: 40,
      quietLossThreshold: 40,
      exactCandidate: true,
    }
  }
  if (totalPlies <= 40) {
    return {
      reviewOptions: REVIEW_OPTIONS,
      tacticalOptions: TACTICAL_OPTIONS,
      maxDeepPasses: Number.POSITIVE_INFINITY,
      tacticalLossThreshold: 40,
      quietLossThreshold: 40,
      exactCandidate: true,
    }
  }
  if (totalPlies <= 80) {
    return {
      reviewOptions: MEDIUM_REVIEW_OPTIONS,
      tacticalOptions: MEDIUM_TACTICAL_OPTIONS,
      maxDeepPasses: 28,
      tacticalLossThreshold: 45,
      quietLossThreshold: 70,
      exactCandidate: false,
    }
  }
  if (totalPlies <= 120) {
    return {
      reviewOptions: LONG_REVIEW_OPTIONS,
      tacticalOptions: LONG_TACTICAL_OPTIONS,
      maxDeepPasses: 18,
      tacticalLossThreshold: 55,
      quietLossThreshold: 90,
      exactCandidate: false,
    }
  }
  return {
    reviewOptions: HUGE_REVIEW_OPTIONS,
    tacticalOptions: HUGE_TACTICAL_OPTIONS,
    maxDeepPasses: 12,
    tacticalLossThreshold: 65,
    quietLossThreshold: 110,
    exactCandidate: false,
  }
}

function findCandidateLine(candidates, playedUci) {
  if (!playedUci) return null
  return candidates.find((line) => sameUci(line.uci, playedUci)) || null
}

function shouldDeepenReviewMove({ candidates, move, phase, playedLine, policy }) {
  if (!candidates.length) return false
  if (move.san.includes('#')) return true
  if (Number.isFinite(candidates[0]?.mate) || Number.isFinite(playedLine?.mate)) return true

  const loss = scoreDifference(candidates[0]?.score, playedLine?.score)
  const forcingMove = Boolean(
    move.captured ||
    move.promotion ||
    move.san.includes('+'),
  )
  if (!Number.isFinite(loss)) return forcingMove
  if (forcingMove) return loss >= policy.tacticalLossThreshold
  if (phase === 'opening') return false
  return loss >= policy.quietLossThreshold
}

async function analyzeExactPlayedMove(client, fen, playedUci, options, signal) {
  const lines = await safeAnalyze(client, fen, {
    ...options,
    count: 1,
    searchMoves: [playedUci],
  }, signal)
  const line = lines.find((candidate) => sameUci(candidate.uci, playedUci))
  if (!line) return null
  return {
    ...line,
    uci: playedUci,
    rank: null,
  }
}

async function analyzePlayedMove(client, game, verboseMove, reviewOptions, signal) {
  if (game.isCheckmate()) {
    return {
      uci: toUci(verboseMove),
      rank: null,
      score: 100000,
      mate: 1,
      pv: [toUci(verboseMove)],
    }
  }
  if (isAutomaticDraw(game)) {
    return {
      uci: toUci(verboseMove),
      rank: null,
      score: 0,
      mate: null,
      pv: [toUci(verboseMove)],
    }
  }
  const afterLines = await safeAnalyze(client, game.fen(), {
    ...reviewOptions,
    count: 1,
    moveTime: Math.min(150, reviewOptions.moveTime),
    timeout: Math.min(1250, reviewOptions.timeout),
  }, signal)
  const reply = afterLines[0]
  return {
    uci: toUci(verboseMove),
    rank: 99,
    score: Number.isFinite(reply?.score) ? -reply.score : null,
    mate: Number.isFinite(reply?.mate) ? -reply.mate : null,
    pv: [toUci(verboseMove), ...(reply?.pv || [])],
  }
}

function finalizeReview({ engine, game, positions, moments, graph, resultOverride = null }) {
  const whiteMoments = moments.filter((moment) => moment.side === 'w')
  const blackMoments = moments.filter((moment) => moment.side === 'b')
  const accuracy = {
    white: aggregateAccuracy(moments, 'w'),
    black: aggregateAccuracy(moments, 'b'),
  }
  const result = resultOverride || finalResult(game)
  const finalizedGraph = graphWithFinalOutcome(graph, result)
  return {
    complete: true,
    engine,
    result,
    positions,
    moments,
    graph: finalizedGraph,
    counts: classificationCounts(moments),
    accuracy,
    gameRating: {
      white: gameRating(accuracy.white),
      black: gameRating(accuracy.black),
    },
    phaseAccuracy: {
      white: summarizePhases(whiteMoments),
      black: summarizePhases(blackMoments),
    },
  }
}

async function safeAnalyze(client, fen, options, signal) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    throwIfReviewAborted(signal)
    try {
      const lines = await client.analyze(fen, attempt === 0 ? options : {
        ...options,
        depth: Math.min(options.depth || 10, 9),
        moveTime: Math.min(options.moveTime || 300, 180),
        timeout: Math.min(options.timeout || 1800, 1600),
        count: Math.min(options.count || 3, 3),
      }) || []
      throwIfReviewAborted(signal)
      if (lines.length) return lines
    } catch (error) {
      if (error?.name === 'AbortError' || signal?.aborted) {
        throw abortError(error)
      }
      // A second bounded pass handles a worker startup or timeout failure.
    }
  }
  return []
}

function throwIfReviewAborted(signal) {
  if (signal?.aborted) throw abortError(signal.reason)
}

function abortError(reason) {
  if (reason?.name === 'AbortError') return reason
  return new DOMException('Review cancelled', 'AbortError')
}

function graphWithFinalOutcome(graph, result) {
  if (!graph.length) return graph
  const normalized = String(result || '').toLowerCase()
  let percent = null
  if (/^(white|player) wins/.test(normalized) || normalized === '1-0') percent = 100
  else if (/^black wins/.test(normalized) || normalized === '0-1') percent = 0
  else if (normalized.includes('draw') || normalized === '1/2-1/2') percent = 50
  if (!Number.isFinite(percent)) return graph
  return graph.map((point, index) =>
    index === graph.length - 1 ? { ...point, percent, terminal: true } : point,
  )
}

function fallbackClassification(game) {
  const key = game.isCheckmate() ? 'best' : 'unreviewed'
  return {
    key,
    ...CLASSIFICATIONS[key],
    expectedPointsLoss: key === 'best' ? 0 : null,
    expectedPoints: expectedPointsFromScore(0),
    reason: key === 'best' ? 'checkmate' : 'analysis unavailable',
  }
}

function isRepertoireMove(repertoire, history, fen, san) {
  const historyOptions = repertoire.openingBook?.[history.join(' ')]
  const positionKey = fen.split(' ').slice(0, 4).join(' ')
  const positionOptions = repertoire.openingBook?.[positionKey]
  return [...(historyOptions || []), ...(positionOptions || [])].some((option) =>
    cleanSan(typeof option === 'string' ? option : option.san) === cleanSan(san),
  )
}

function whitePerspective(side, line) {
  const multiplier = side === 'w' ? 1 : -1
  return {
    score: Number.isFinite(line?.score) ? line.score * multiplier : null,
    mate: Number.isFinite(line?.mate) ? line.mate * multiplier : null,
  }
}

function hasEngineEvaluation(line) {
  return Number.isFinite(line?.score) || Number.isFinite(line?.mate)
}

function graphPoint(ply, score, mate, classification = null) {
  return {
    ply,
    score,
    mate,
    percent: evaluationToWhitePercent(score, mate),
    classification: classification?.key || null,
    color: classification?.color || null,
  }
}

function scoreDifference(best, played) {
  if (!Number.isFinite(best) || !Number.isFinite(played)) return null
  return Math.max(0, best - played)
}

function scoreChange(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null
  return after - before
}

function classificationCounts(moments) {
  return CLASSIFICATION_ORDER.map((key) => {
    const classification = CLASSIFICATIONS[key]
    return {
      key,
      ...classification,
      white: moments.filter((moment) => moment.side === 'w' && moment.key === key).length,
      black: moments.filter((moment) => moment.side === 'b' && moment.key === key).length,
    }
  })
}

function summarizePhases(moments) {
  return Object.fromEntries(['opening', 'middlegame', 'endgame'].map((phase) => {
    const phaseMoves = moments.filter((moment) => moment.phase === phase)
    const accuracy = aggregateAccuracy(phaseMoves)
    const key = phaseGrade(accuracy)
    return [phase, {
      accuracy,
      moves: phaseMoves.length,
      key,
      ...(key ? CLASSIFICATIONS[key] : {}),
    }]
  }))
}

function phaseGrade(accuracy) {
  if (!Number.isFinite(accuracy)) return null
  if (accuracy >= 97) return 'best'
  if (accuracy >= 90) return 'excellent'
  if (accuracy >= 80) return 'good'
  if (accuracy >= 65) return 'inaccuracy'
  if (accuracy >= 45) return 'mistake'
  return 'blunder'
}

function gameRating(accuracy) {
  if (!Number.isFinite(accuracy)) return null
  return Math.max(100, Math.min(3200, Math.round((350 + accuracy * 20) / 50) * 50))
}

function phaseForPosition(game, ply) {
  if (ply < 16) return 'opening'
  const pieces = game.board().flat().filter(Boolean)
  const queens = pieces.filter((piece) => piece.type === 'q').length
  const nonPawnMaterial = pieces.reduce((sum, piece) => {
    if (piece.type === 'p' || piece.type === 'k') return sum
    return sum + ({ n: 320, b: 330, r: 500, q: 900 }[piece.type] || 0)
  }, 0)
  if (pieces.length <= 14 || (queens === 0 && nonPawnMaterial <= 2600)) return 'endgame'
  return 'middlegame'
}

function explainMove({ beforeFen, move, moment }) {
  const game = new Chess(beforeFen)
  const after = new Chess(beforeFen)
  after.move(move)
  const idea = describeMoveIdea(game, after, move)
  const evaluation = evaluationSentence(moment)
  const bestMove = moment.bestMoveSan
  const line = moment.bestLineSan.slice(0, 6).join(' ')

  if (moment.key === 'unreviewed') {
    return `${move.san} could not be classified because Stockfish did not return a reliable comparison.`
  }
  if (moment.key === 'brilliant') {
    return joinSentences(
      `${move.san} is a sound tactical investment rather than a free giveaway.`,
      idea,
      evaluation,
      line ? `The point is shown by ${line}.` : '',
    )
  }
  if (moment.key === 'great') {
    return joinSentences(
      `${move.san} is the critical move in the position.`,
      idea,
      bestMove && bestMove !== move.san ? `The engine’s first choice was ${bestMove}.` : '',
      evaluation,
    )
  }
  if (moment.key === 'book') {
    return joinSentences(
      `${move.san} follows reliable opening theory.`,
      idea,
      evaluation,
    )
  }
  if (moment.key === 'best' || moment.key === 'forced') {
    return joinSentences(
      moment.key === 'forced'
        ? `${move.san} was the only legal continuation.`
        : moment.reason === 'checkmate'
          ? `${move.san} delivers checkmate.`
        : `${move.san} was Stockfish’s first choice.`,
      idea,
      evaluation,
    )
  }
  if (moment.key === 'excellent' || moment.key === 'good') {
    return joinSentences(
      `${move.san} keeps the position playable.`,
      idea,
      bestMove && bestMove !== move.san ? `${bestMove} was a little more precise.` : '',
      evaluation,
    )
  }
  return joinSentences(
    `${move.san} ${negativeClassificationText(moment.key)}.`,
    bestMove && bestMove !== move.san ? `The stronger move was ${bestMove}.` : '',
    evaluation,
    tacticalConsequence(after, move),
    line ? `A stronger line begins ${line}.` : '',
  )
}

function describeMoveIdea(before, after, move) {
  if (after.isCheckmate()) return 'It ends the game immediately.'
  const ideas = []
  if (move.captured) ideas.push(`It captures the ${PIECE_NAMES[move.captured]}.`)
  if (move.san.includes('+')) ideas.push('It checks the king and gains a tempo.')
  if (move.flags.includes('k') || move.flags.includes('q')) {
    ideas.push('It castles, improving king safety and connecting the rooks.')
  }
  if (
    (move.piece === 'n' || move.piece === 'b') &&
    ['1', '8'].includes(move.from[1]) &&
    !['1', '8'].includes(move.to[1])
  ) {
    ideas.push(`It develops the ${PIECE_NAMES[move.piece]} toward an active square.`)
  }
  if (move.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].includes(move.to)) {
    ideas.push('It claims central space.')
  }
  if (move.promotion) ideas.push(`It promotes the pawn to a ${PIECE_NAMES[move.promotion]}.`)
  if (!ideas.length && before.inCheck()) ideas.push('It answers the check and keeps the king safe.')
  if (!ideas.length) ideas.push('It improves the position without creating an immediate tactical weakness.')
  return ideas.join(' ')
}

function tacticalConsequence(after, move) {
  const recapture = after.moves({ verbose: true }).find((reply) =>
    reply.to === move.to && reply.captured === move.piece,
  )
  if (recapture) {
    return `The ${PIECE_NAMES[move.piece]} on ${move.to} can be taken by ${recapture.san}.`
  }
  return ''
}

function evaluationSentence(moment) {
  const before = formatEvaluation(moment.scoreBefore, moment.mateBefore)
  const after = formatEvaluation(moment.scoreAfter, moment.mateAfter)
  if (before === after) return `The evaluation stays at ${after}.`
  return `The evaluation changes from ${before} to ${after}, from White’s perspective.`
}

function negativeClassificationText(key) {
  if (key === 'inaccuracy') return 'gives away part of the advantage'
  if (key === 'mistake') return 'creates a serious positional or tactical problem'
  if (key === 'miss') return 'misses a critical opportunity'
  return 'allows a decisive swing'
}

function uciLineToSan(fen, line) {
  const game = new Chess(fen)
  const sans = []
  for (const uci of line) {
    const move = game.moves({ verbose: true }).find((candidate) =>
      sameUci(toUci(candidate), uci),
    )
    if (!move) break
    sans.push(move.san)
    game.move(move)
  }
  return sans
}

function principalVariation(line) {
  if (!line) return []
  const variation = Array.isArray(line.pv) ? line.pv.filter(Boolean) : []
  if (!line.uci || sameUci(variation[0], line.uci)) return variation
  return [line.uci, ...variation]
}

function formatEvaluation(score, mate) {
  if (Number.isFinite(mate)) return mate > 0 ? `mate in ${mate}` : `mate in ${Math.abs(mate)} for Black`
  if (!Number.isFinite(score)) return 'an unclear position'
  const pawns = Math.abs(score / 100).toFixed(1)
  return score >= 0 ? `+${pawns}` : `-${pawns}`
}

function finalResult(game) {
  if (game.isCheckmate()) return game.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate'
  if (isAutomaticDraw(game)) return 'Draw'
  return 'Game complete'
}

export function aggregateAccuracy(moments, side = null) {
  const measured = moments.filter((moment) =>
    Number.isFinite(moment?.accuracy) && (!side || moment.side === side),
  )
  if (!measured.length) return null
  if (measured.length === 1) return roundTo(measured[0].accuracy, 1)

  const accuracies = measured.map((moment) => clampAccuracy(moment.accuracy))
  const volatility = volatilityWeights(moments)
  const weights = measured.map((moment) => volatility.get(moment) ?? 0.5)
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
  const weightedMean = accuracies.reduce(
    (sum, accuracy, index) => sum + accuracy * weights[index],
    0,
  ) / weightTotal
  const harmonicMean = accuracies.some((accuracy) => accuracy === 0)
    ? 0
    : accuracies.length / accuracies.reduce((sum, accuracy) => sum + (1 / accuracy), 0)

  return roundTo((weightedMean + harmonicMean) / 2, 1)
}

function volatilityWeights(moments) {
  const measuredPositions = moments.filter((moment) =>
    Number.isFinite(moment?.scoreAfter) || Number.isFinite(moment?.mateAfter),
  )
  if (!measuredPositions.length) return new Map()

  const first = measuredPositions[0]
  const winPercents = [
    evaluationToWhitePercent(first.scoreBefore, first.mateBefore),
    ...measuredPositions.map((moment) =>
      evaluationToWhitePercent(moment.scoreAfter, moment.mateAfter),
    ),
  ]
  const windowSize = Math.max(2, Math.min(8, Math.round(measuredPositions.length / 10)))
  const firstWindow = winPercents.slice(0, windowSize)
  const windows = [
    ...Array.from(
      { length: Math.max(0, Math.min(windowSize, winPercents.length) - 2) },
      () => firstWindow,
    ),
  ]
  for (let index = 0; index <= winPercents.length - windowSize; index += 1) {
    windows.push(winPercents.slice(index, index + windowSize))
  }

  const weights = new Map()
  measuredPositions.forEach((moment, index) => {
    weights.set(moment, Math.max(0.5, Math.min(12, standardDeviation(windows[index] || firstWindow))))
  })
  return weights
}

function standardDeviation(values) {
  if (!values.length) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce(
    (sum, value) => sum + ((value - mean) ** 2),
    0,
  ) / values.length
  return Math.sqrt(variance)
}

function clampAccuracy(value) {
  return Math.max(0, Math.min(100, Number(value) || 0))
}

function toUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}

function sameUci(a, b) {
  return String(a || '') === String(b || '')
}

function cleanSan(value) {
  return String(value || '').replace(/[+#?!]+/g, '')
}

function joinSentences(...sentences) {
  return sentences.filter(Boolean).join(' ')
}

function roundTo(value, places) {
  const multiplier = 10 ** places
  return Math.round(value * multiplier) / multiplier
}
