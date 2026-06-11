import { Chess } from 'chess.js'
import { CLASSIFICATIONS, classifyMove, expectedPointsFromScore } from './bookupClassifications.js'

const REVIEW_OPTIONS = { depth: 8, moveTime: 190, count: 4, timeout: 1450 }
const TACTICAL_OPTIONS = { depth: 10, moveTime: 330, count: 5, timeout: 1900 }

export async function reviewGameWithStockfish({
  history,
  client,
  repertoire = {},
  onProgress = () => {},
  signal,
}) {
  const game = new Chess()
  const moments = []
  const positions = [game.fen()]
  const graph = [{ ply: 0, score: 0 }]
  const accuracy = { w: [], b: [] }

  for (let index = 0; index < history.length; index += 1) {
    if (signal?.aborted) throw new DOMException('Review cancelled', 'AbortError')
    const beforeFen = game.fen()
    const beforeHistory = game.history()
    const legalMoveCount = game.moves().length
    const side = game.turn()
    const san = history[index]
    const verboseMove = game.moves({ verbose: true }).find((candidate) => candidate.san === san)
    if (!verboseMove) continue

    let candidates = await safeAnalyze(client, beforeFen, REVIEW_OPTIONS)
    let playedLine = candidates.find((line) => sameUci(line.uci, toUci(verboseMove)))
    const tacticalCandidate = Boolean(verboseMove.captured || verboseMove.san.includes('+') || playedLine?.rank <= 3)
    if (tacticalCandidate) {
      const deeper = await safeAnalyze(client, beforeFen, TACTICAL_OPTIONS)
      if (deeper.length) candidates = deeper
      playedLine = candidates.find((line) => sameUci(line.uci, toUci(verboseMove)))
    }

    game.move(verboseMove)
    positions.push(game.fen())
    if (!playedLine) {
      const afterLines = await safeAnalyze(client, game.fen(), {
        ...REVIEW_OPTIONS,
        count: 1,
        moveTime: 130,
        timeout: 1100,
      })
      const replyScore = afterLines[0]?.score
      playedLine = {
        uci: toUci(verboseMove),
        rank: 99,
        score: Number.isFinite(replyScore) ? -replyScore : null,
        mate: afterLines[0]?.mate === null ? null : negate(afterLines[0]?.mate),
        pv: [toUci(verboseMove), ...(afterLines[0]?.pv || [])],
      }
    }

    const bestLine = candidates[0] || playedLine
    const inBook = isRepertoireMove(repertoire, beforeHistory, beforeFen, san)
    const classification = Number.isFinite(bestLine?.score) && Number.isFinite(playedLine?.score)
      ? classifyMove({
          beforeFen,
          move: verboseMove,
          bestLine,
          playedLine,
          candidateLines: candidates,
          legalMoveCount,
          openingPhase: index < 20,
          inBook,
          isPlayerMove: side === 'w',
        })
      : fallbackClassification(game)

    const scoreAfterWhite = scoreForWhite(side, playedLine?.score)
    const moment = {
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      side,
      san,
      uci: toUci(verboseMove),
      beforeFen,
      afterFen: game.fen(),
      bestMove: bestLine?.uci || null,
      bestLine: bestLine?.pv || [],
      playedLine: playedLine?.pv || [],
      scoreBefore: scoreForWhite(side, bestLine?.score),
      scoreAfter: scoreAfterWhite,
      evaluationChange: scoreDifference(bestLine?.score, playedLine?.score),
      accuracy: moveAccuracy(classification.expectedPointsLoss),
      ...classification,
    }
    moments.push(moment)
    graph.push({ ply: index + 1, score: clamp(scoreAfterWhite || 0, -1200, 1200) })
    accuracy[side].push(moment.accuracy)
    onProgress({ completed: index + 1, total: history.length, moment })
  }

  return {
    complete: true,
    engine: 'Stockfish 18',
    result: finalResult(game),
    positions,
    moments,
    graph,
    counts: classificationCounts(moments),
    accuracy: {
      white: average(accuracy.w),
      black: average(accuracy.b),
    },
  }
}

export function buildFallbackFinalReview(history) {
  const game = new Chess()
  const positions = [game.fen()]
  const moments = []
  history.forEach((san, index) => {
    const side = game.turn()
    const move = game.move(san)
    if (!move) return
    positions.push(game.fen())
    const classification = fallbackClassification(game)
    moments.push({
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      side,
      san,
      beforeFen: positions[index],
      afterFen: game.fen(),
      bestLine: [],
      playedLine: [],
      scoreBefore: 0,
      scoreAfter: 0,
      evaluationChange: null,
      accuracy: moveAccuracy(classification.expectedPointsLoss),
      ...classification,
    })
  })
  return {
    complete: true,
    engine: 'Local fallback',
    result: finalResult(game),
    positions,
    moments,
    graph: positions.map((_, ply) => ({ ply, score: 0 })),
    counts: classificationCounts(moments),
    accuracy: {
      white: average(moments.filter((item) => item.side === 'w').map((item) => item.accuracy)),
      black: average(moments.filter((item) => item.side === 'b').map((item) => item.accuracy)),
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

function scoreForWhite(side, score) {
  if (!Number.isFinite(score)) return null
  return side === 'w' ? score : -score
}

function scoreDifference(best, played) {
  if (!Number.isFinite(best) || !Number.isFinite(played)) return null
  return Math.max(0, best - played)
}

function moveAccuracy(loss = 0) {
  return Math.round(100 * Math.exp(-4.5 * Math.max(0, loss)))
}

function classificationCounts(moments) {
  return Object.values(moments.reduce((counts, moment) => {
    counts[moment.key] ||= { key: moment.key, count: 0, ...CLASSIFICATIONS[moment.key] }
    counts[moment.key].count += 1
    return counts
  }, {})).sort((a, b) => b.count - a.count)
}

function finalResult(game) {
  if (game.isCheckmate()) return game.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate'
  if (game.isDraw()) return 'Draw'
  return 'Game complete'
}

function average(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
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

function negate(value) {
  return Number.isFinite(value) ? -value : null
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}
