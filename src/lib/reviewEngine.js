import { Chess } from 'chess.js'
import { isAutomaticDraw } from './gameSession.js'
import { CLASSIFICATIONS, classifyMove, expectedPointsFromScore } from './bookupClassifications.js'

const REVIEW_OPTIONS = { depth: 12, moveTime: 420, count: 5, timeout: 2600 }
const TACTICAL_OPTIONS = { depth: 18, moveTime: 1600, count: 6, timeout: 6000 }
const SHORT_REVIEW_OPTIONS = { depth: 10, moveTime: 160, count: 4, timeout: 1400 }
const SHORT_TACTICAL_OPTIONS = { depth: 13, moveTime: 360, count: 5, timeout: 1800 }
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
]
const CLASSIFICATION_ACCURACY = Object.freeze({
  brilliant: 100,
  great: 100,
  book: 100,
  best: 100,
  forced: 100,
  excellent: 90,
  good: 75,
  inaccuracy: 50,
  mistake: 20,
  miss: 10,
  blunder: 0,
})
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
  onProgress = () => {},
  signal,
}) {
  const game = new Chess()
  const moments = []
  const positions = [game.fen()]
  const graph = [{ ply: 0, score: null, mate: null, percent: 50 }]
  const reviewOptions = history.length <= 8 ? SHORT_REVIEW_OPTIONS : REVIEW_OPTIONS
  const tacticalOptions = history.length <= 8 ? SHORT_TACTICAL_OPTIONS : TACTICAL_OPTIONS

  for (let index = 0; index < history.length; index += 1) {
    if (signal?.aborted) throw new DOMException('Review cancelled', 'AbortError')
    const beforeFen = game.fen()
    const beforeHistory = game.history()
    const legalMoveCount = game.moves().length
    const side = game.turn()
    const san = history[index]
    const verboseMove = game.moves({ verbose: true }).find((candidate) => candidate.san === san)
    if (!verboseMove) continue

    const playedUci = toUci(verboseMove)
    let [candidates, exactPlayedLine] = await Promise.all([
      safeAnalyze(client, beforeFen, reviewOptions),
      analyzeExactPlayedMove(playedClient, beforeFen, playedUci, reviewOptions),
    ])
    const candidatePlayedLine = candidates.find((line) => sameUci(line.uci, playedUci))
    let playedLine = sameUci(candidates[0]?.uci, playedUci)
      ? candidates[0]
      : exactPlayedLine || candidatePlayedLine
    const tacticalCandidate = Boolean(
      verboseMove.captured ||
      verboseMove.san.includes('+') ||
      verboseMove.san.includes('#') ||
      !playedLine ||
      scoreDifference(candidates[0]?.score, playedLine?.score) >= 30,
    )
    if (tacticalCandidate) {
      const [deeper, deeperPlayedLine] = await Promise.all([
        safeAnalyze(client, beforeFen, tacticalOptions),
        analyzeExactPlayedMove(playedClient, beforeFen, playedUci, tacticalOptions),
      ])
      if (deeper.length) candidates = deeper
      const deeperCandidatePlayed = candidates.find((line) => sameUci(line.uci, playedUci))
      playedLine = sameUci(candidates[0]?.uci, playedUci)
        ? candidates[0]
        : deeperPlayedLine || deeperCandidatePlayed || playedLine
    }

    const phase = phaseForPosition(game, index)
    game.move(verboseMove)
    positions.push(game.fen())
    if (!playedLine) {
      playedLine = await analyzePlayedMove(client, game, verboseMove, reviewOptions)
    }

    const bestLine = candidates[0] || playedLine
    const beforeEvaluation = whitePerspective(side, bestLine)
    const afterEvaluation = whitePerspective(side, playedLine)
    if (index === 0) {
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

    const bestLineSan = uciLineToSan(beforeFen, bestLine?.pv || [])
    const playedLineSan = uciLineToSan(beforeFen, playedLine?.pv || [])
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
      bestLine: bestLine?.pv || [],
      bestLineSan,
      playedLine: playedLine?.pv || [],
      playedLineSan,
      scoreBefore: beforeEvaluation.score,
      scoreAfter: afterEvaluation.score,
      mateBefore: beforeEvaluation.mate,
      mateAfter: afterEvaluation.mate,
      evaluationChange: scoreChange(beforeEvaluation.score, afterEvaluation.score),
      centipawnLoss: scoreDifference(bestLine?.score, playedLine?.score),
      accuracy: moveAccuracy(classification.expectedPointsLoss, classification.key),
      ...classification,
    }
    moment.explanation = explainMove({
      beforeFen,
      move: verboseMove,
      moment,
    })
    moments.push(moment)
    graph.push(graphPoint(index + 1, afterEvaluation.score, afterEvaluation.mate, classification))
    onProgress({ completed: index + 1, total: history.length, moment })
  }

  return finalizeReview({
    engine: 'Stockfish 18',
    game,
    positions,
    moments,
    graph,
  })
}

export function buildFallbackFinalReview(history) {
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
      accuracy: moveAccuracy(classification.expectedPointsLoss, classification.key),
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
  })
}

export function evaluationToWhitePercent(score, mate = null) {
  if (Number.isFinite(mate)) return mate > 0 ? 100 : 0
  if (!Number.isFinite(score)) return 50
  return roundTo(100 / (1 + Math.exp(-score / 220)), 2)
}

async function analyzeExactPlayedMove(client, fen, playedUci, options) {
  const lines = await safeAnalyze(client, fen, {
    ...options,
    count: 1,
    searchMoves: [playedUci],
  })
  const line = lines.find((candidate) => sameUci(candidate.uci, playedUci))
  if (!line) return null
  return {
    ...line,
    uci: playedUci,
    rank: null,
  }
}

async function analyzePlayedMove(client, game, verboseMove, reviewOptions) {
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
  })
  const reply = afterLines[0]
  return {
    uci: toUci(verboseMove),
    rank: 99,
    score: Number.isFinite(reply?.score) ? -reply.score : null,
    mate: Number.isFinite(reply?.mate) ? -reply.mate : null,
    pv: [toUci(verboseMove), ...(reply?.pv || [])],
  }
}

function finalizeReview({ engine, game, positions, moments, graph }) {
  const whiteMoments = moments.filter((moment) => moment.side === 'w')
  const blackMoments = moments.filter((moment) => moment.side === 'b')
  const accuracy = {
    white: average(whiteMoments.map((moment) => moment.accuracy)),
    black: average(blackMoments.map((moment) => moment.accuracy)),
  }
  return {
    complete: true,
    engine,
    result: finalResult(game),
    positions,
    moments,
    graph,
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

async function safeAnalyze(client, fen, options) {
  try {
    return await client.analyze(fen, options) || []
  } catch {
    return []
  }
}

function fallbackClassification(game) {
  const key = game.isCheckmate() ? 'best' : 'good'
  return {
    key,
    ...CLASSIFICATIONS[key],
    expectedPointsLoss: key === 'best' ? 0 : 0.04,
    expectedPoints: expectedPointsFromScore(0),
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

function moveAccuracy(loss = 0, classification = null) {
  if (Number.isFinite(CLASSIFICATION_ACCURACY[classification])) {
    return CLASSIFICATION_ACCURACY[classification]
  }
  const winPercentLoss = Math.max(0, loss) * 100
  return Math.round(Math.max(
    0,
    Math.min(100, 103.1668 * Math.exp(-0.04354 * winPercentLoss) - 3.1669),
  ))
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
    const accuracy = average(phaseMoves.map((moment) => moment.accuracy))
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

function average(values) {
  return values.length
    ? roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, 1)
    : null
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
