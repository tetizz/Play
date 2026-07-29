import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { Chess } from 'chess.js'
import {
  IWANTCHECKMATE_VIDEO_PROFILES,
  getIWantCheckmateProfile,
} from '../src/data/iwantcheckmateProfiles.js'
import {
  initialVariantElo,
  runningVariantElo,
  selectIWantCheckmateCandidate,
} from '../src/lib/iwantcheckmateVariants.js'

export const NATIVE_MIN_ELO = 1320
export const NATIVE_MAX_ELO = 3190
const DEFAULT_ANCHORS = [1320, 1600, 2000, 2400, 2800, 3190]
const DEFAULT_OPENINGS = [
  [],
  ['e4', 'e5', 'Nf3', 'Nc6'],
  ['d4', 'd5', 'c4', 'e6'],
  ['Nf3', 'd5', 'g3', 'Nf6'],
  ['e4', 'c5', 'Nf3', 'd6'],
  ['e4', 'e6', 'd4', 'd5'],
]
const PROFILE_LIKELIHOOD_95_DELTA = 1.920729410347062
const RATING_FLOOR = 0
const RATING_CEILING = 4000

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  validateOptions(options)
  const enginePath = resolveEnginePath(options.engine)
  const profileIds = options.profiles === 'all'
    ? IWANTCHECKMATE_VIDEO_PROFILES.map((profile) => profile.id)
    : options.profiles.split(',').map((value) => value.trim()).filter(Boolean)
  const anchors = options.anchors.split(',').map(Number).filter(Number.isFinite)
  const engines = {
    profile: new UciEngine(enginePath, 'profile', options.timeoutMs),
    anchor: new UciEngine(enginePath, 'anchor', options.timeoutMs),
    judge: new UciEngine(enginePath, 'judge', options.timeoutMs),
  }
  const report = {
    generatedAt: new Date().toISOString(),
    engine: enginePath,
    method: {
      anchors,
      gamesPerAnchor: options.games,
      pairedGamesPerAnchor: options.games / 2,
      nodesPerMove: options.nodes,
      judgeNodesPerMove: options.judgeNodes,
      maximumPlies: options.maxPlies,
      seed: options.seed,
      freezeRating: options.freezeRating,
      engineProcesses: 3,
      formula:
        'Maximum-likelihood Elo from paired scores against native UCI_Elo anchors, with a profile-likelihood 95% confidence interval.',
      exclusions:
        'Failed and unfinished games are reported but excluded from scores, Elo estimates, and confidence intervals.',
    },
    profiles: [],
  }

  try {
    await Promise.all(Object.values(engines).map((engine) => engine.start()))
    for (const profileId of profileIds) {
      const profile = getIWantCheckmateProfile(profileId)
      if (!profile) throw new Error(`Unknown profile: ${profileId}`)
      const requestedInitialElo = Number.isFinite(options.rating)
        ? options.rating
        : initialVariantElo(profile)
      const rows = []

      for (const anchorElo of anchors) {
        const row = createCalibrationRow(anchorElo)
        const pairings = buildPairings({
          games: options.games,
          openings: DEFAULT_OPENINGS,
          baseSeed: options.seed,
          profileId,
          anchorElo,
        })

        for (const pairing of pairings) {
          const gameResult = await playGame({
            engines,
            profile,
            profileColor: pairing.profileColor,
            requestedInitialElo,
            anchorElo,
            opening: pairing.opening,
            nodes: options.nodes,
            judgeNodes: options.judgeNodes,
            maxPlies: options.maxPlies,
            seed: pairing.seed,
            freezeRating: options.freezeRating,
          })
          recordCalibrationGame(row, gameResult)
          if (gameResult.status === 'failed') {
            await Promise.all(Object.values(engines).map((engine) => engine.restart()))
          }
          printProgress(profile, requestedInitialElo, row)
        }
        finalizeCalibrationRow(row)
        rows.push(row)
      }

      const estimate = estimateEloWithInterval(rows)
      report.profiles.push({
        id: profile.id,
        name: profile.name,
        requestedInitialElo,
        effectiveElo: estimate.rating,
        confidenceInterval95: {
          lower: estimate.lower95,
          upper: estimate.upper95,
        },
        completedGames: estimate.completedGames,
        unfinishedGames: estimate.unfinishedGames,
        failedGames: estimate.failedGames,
        rows,
      })
      process.stdout.write(
        `${' '.repeat(110)}\r${profile.name}: measured ${formatEstimate(estimate)} ` +
        `(baseline ${requestedInitialElo ?? 'rule-defined'}, ` +
        `${estimate.completedGames} completed, ${estimate.unfinishedGames} unfinished, ` +
        `${estimate.failedGames} failed)\n`,
      )
    }
  } finally {
    Object.values(engines).forEach((engine) => engine.close())
  }

  report.totals = summarizeReport(report.profiles)
  await mkdir(path.dirname(options.output), { recursive: true })
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`Calibration report written to ${options.output}`)
  return report
}

export async function playGame({
  engines,
  profile,
  profileColor,
  requestedInitialElo,
  anchorElo,
  opening,
  nodes,
  judgeNodes,
  maxPlies,
  seed,
  freezeRating = false,
}) {
  const game = new Chess()
  const events = createVariantEvents()
  const random = seededRandom(seed)
  const startingElo = freezeRating
    ? requestedInitialElo
    : resolveProfileRating(profile, events, requestedInitialElo)
  const ratingHistory = []

  try {
    for (const san of opening) {
      const move = game.move(san)
      if (!move) throw calibrationError('invalid-opening', `Illegal opening move: ${san}`)
    }
    await Promise.all(Object.values(engines).map((engine) => engine.newGame()))

    while (!game.isGameOver() && game.history().length < maxPlies) {
      const isProfileTurn = game.turn() === profileColor
      const position = positionCommandForGame(game)
      let uci
      let opponentCandidates = []
      let currentElo = null

      if (isProfileTurn) {
        currentElo = freezeRating
          ? requestedInitialElo
          : resolveProfileRating(profile, events, requestedInitialElo)
        ratingHistory.push({
          ply: game.history().length + 1,
          elo: currentElo,
          events: { ...events },
        })
        uci = await chooseProfileMove({
          engine: engines.profile,
          game,
          position,
          profile,
          events,
          rating: currentElo,
          nodes,
          random,
        })
      } else {
        const opponentTrigger = profile.variant?.trigger
        const needsOpponentJudgement = [
          'opponent-best-move',
          'opponent-non-best-move',
          'opponent-worst-move',
        ]
          .includes(opponentTrigger)
        const legalCount = game.moves().length
        const analyses = [
          engines.anchor.analyze(position, {
            count: 1,
            nodes,
            elo: anchorElo,
          }),
        ]
        if (needsOpponentJudgement) {
          analyses.push(
            engines.judge.analyze(position, {
              count: opponentTrigger === 'opponent-worst-move' ? legalCount : 1,
              nodes: judgeNodes,
              elo: undefined,
            }),
          )
        }
        const [anchorCandidates, judgedCandidates = []] = await Promise.all(analyses)
        if (
          opponentTrigger === 'opponent-worst-move' &&
          judgedCandidates.length !== legalCount
        ) {
          throw calibrationError(
            'incomplete-worst-move-judgement',
            `Stockfish returned ${judgedCandidates.length} of ${legalCount} legal candidates`,
          )
        }
        uci = anchorCandidates[0]?.uci
        opponentCandidates = judgedCandidates
      }

      if (!uci || uci === '(none)') {
        throw calibrationError('missing-bestmove', 'Stockfish returned no legal move')
      }
      const move = game.move(uciToMove(uci))
      if (!move) {
        throw calibrationError('illegal-engine-move', `Stockfish returned illegal move ${uci}`)
      }

      if (isProfileTurn) {
        recordOwnMoveEvents(events, move)
      } else {
        recordOpponentMoveEvents(events, move, uci, opponentCandidates)
      }
    }
  } catch (error) {
    return {
      status: 'failed',
      score: null,
      result: '*',
      reason: error.code || 'engine-error',
      error: error.message,
      color: profileColor,
      seed,
      plies: game.history().length,
      events,
      startingElo,
      endingElo: freezeRating
        ? requestedInitialElo
        : resolveProfileRating(profile, events, requestedInitialElo),
      ratingHistory,
      pgn: game.pgn(),
    }
  }

  const outcome = classifyGameOutcome(game, profileColor)
  if (outcome) {
    return {
      ...outcome,
      status: 'completed',
      color: profileColor,
      seed,
      plies: game.history().length,
      events,
      startingElo,
      endingElo: freezeRating
        ? requestedInitialElo
        : resolveProfileRating(profile, events, requestedInitialElo),
      ratingHistory,
      pgn: game.pgn(),
    }
  }
  return {
    status: 'unfinished',
    score: null,
    result: '*',
    reason: 'maximum-plies',
    color: profileColor,
    seed,
    plies: game.history().length,
    events,
    startingElo,
    endingElo: freezeRating
      ? requestedInitialElo
      : resolveProfileRating(profile, events, requestedInitialElo),
    ratingHistory,
    pgn: game.pgn(),
  }
}

async function chooseProfileMove({
  engine,
  game,
  position,
  profile,
  events,
  rating,
  nodes,
  random,
}) {
  const policyType = profile.variant?.movePolicy?.type || 'best'
  const ratingDriven = policyType === 'rating-strength' ||
    (policyType === 'best' && Boolean(profile.variant?.trigger))
  const nativeElo = ratingDriven ? nativeEngineElo(rating) : undefined

  if (ratingDriven && nativeElo !== undefined) {
    const candidates = await engine.analyze(position, {
      count: 1,
      nodes,
      elo: nativeElo,
    })
    return candidates[0]?.uci || null
  }
  if (ratingDriven && Number.isFinite(rating) && rating > NATIVE_MAX_ELO) {
    const candidates = await engine.analyze(position, {
      count: 1,
      nodes,
      elo: undefined,
    })
    return candidates[0]?.uci || null
  }

  const legalCount = game.moves().length
  const count = profile.variant?.movePolicy?.allLegalMoves
    ? legalCount
    : Math.min(
        legalCount,
        Math.max(4, Number(profile.strengthPolicy?.candidates || 16)),
      )
  const candidates = enrichCandidates(
    await engine.analyze(position, {
      count,
      nodes,
      elo: undefined,
    }),
    game,
  )
  const selectorProfile = ratingDriven && Number.isFinite(rating) && rating < NATIVE_MIN_ELO
    ? withRatingStrengthPolicy(profile)
    : profile
  const selected = selectIWantCheckmateCandidate(
    selectorProfile,
    candidates,
    random,
    {
      events,
      rating,
      evaluation: candidates[0]?.score ?? 0,
    },
  )
  return selected?.uci || candidates[0]?.uci || null
}

export function nativeEngineElo(rating) {
  const value = Number(rating)
  if (!Number.isFinite(value) || value < NATIVE_MIN_ELO || value > NATIVE_MAX_ELO) {
    return undefined
  }
  return Math.round(value)
}

export function resolveProfileRating(profile, events = {}, requestedInitialElo = null) {
  const running = runningVariantElo(profile, events)
  const initial = initialVariantElo(profile)
  if (!Number.isFinite(running)) {
    return Number.isFinite(requestedInitialElo) ? Number(requestedInitialElo) : null
  }
  if (!Number.isFinite(requestedInitialElo) || !Number.isFinite(initial)) return running
  return clamp(
    running + (Number(requestedInitialElo) - initial),
    Number(profile.variant?.minElo ?? -Infinity),
    Number(profile.variant?.maxElo ?? Infinity),
  )
}

export function createVariantEvents() {
  return {
    botMoves: 0,
    botCaptureChecks: 0,
    botCaptures: 0,
    opponentChecks: 0,
    opponentBestMoves: 0,
    opponentNonBestMoves: 0,
    opponentWorstMoves: 0,
  }
}

export function recordOwnMoveEvents(events, move) {
  events.botMoves += 1
  if (move.captured) events.botCaptures += 1
  if (move.captured || move.san.includes('+') || move.san.includes('#')) {
    events.botCaptureChecks += 1
  }
  return events
}

export function recordOpponentMoveEvents(events, move, uci, candidates = []) {
  if (move.san.includes('+') || move.san.includes('#')) events.opponentChecks += 1
  const ranked = [...candidates].filter((candidate) => candidate?.uci)
    .sort((a, b) => Number(a.rank || 1) - Number(b.rank || 1))
  if (ranked[0]?.uci === uci) events.opponentBestMoves += 1
  if (ranked[0]?.uci && ranked[0].uci !== uci) events.opponentNonBestMoves += 1
  const finite = ranked.filter((candidate) => Number.isFinite(candidate.score))
  const worstScore = finite.length
    ? Math.min(...finite.map((candidate) => candidate.score))
    : null
  if (
    worstScore !== null &&
    finite.some((candidate) => candidate.uci === uci && candidate.score === worstScore)
  ) {
    events.opponentWorstMoves += 1
  }
  return events
}

export function buildPairings({
  games,
  openings = DEFAULT_OPENINGS,
  baseSeed,
  profileId,
  anchorElo,
}) {
  if (!Number.isInteger(games) || games <= 0 || games % 2 !== 0) {
    throw new Error('--games must be a positive even number so every opening is color-paired.')
  }
  const pairings = []
  for (let pairIndex = 0; pairIndex < games / 2; pairIndex += 1) {
    const openingIndex = pairIndex % openings.length
    const seed = deriveSeed(baseSeed, profileId, anchorElo, pairIndex, openingIndex)
    for (const profileColor of ['w', 'b']) {
      pairings.push({
        pairIndex,
        openingIndex,
        profileColor,
        opening: [...openings[openingIndex]],
        seed,
      })
    }
  }
  return pairings
}

export function deriveSeed(baseSeed, ...parts) {
  let hash = Number(baseSeed) >>> 0
  for (const part of parts) {
    const text = String(part)
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 16777619) >>> 0
    }
    hash ^= 255
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash || 1
}

export function positionCommandForGame(game) {
  const moves = game.history({ verbose: true }).map(moveToUci)
  return moves.length ? `position startpos moves ${moves.join(' ')}` : 'position startpos'
}

export function createCalibrationRow(anchorElo) {
  return {
    anchorElo,
    wins: 0,
    draws: 0,
    losses: 0,
    completedGames: 0,
    unfinishedGames: 0,
    failedGames: 0,
    scoreRate: null,
    scoreConfidenceInterval95: { lower: null, upper: null },
    games: [],
  }
}

export function recordCalibrationGame(row, gameResult) {
  row.games.push(gameResult)
  if (gameResult.status === 'failed') {
    row.failedGames += 1
    return row
  }
  if (gameResult.status === 'unfinished') {
    row.unfinishedGames += 1
    return row
  }
  row.completedGames += 1
  if (gameResult.score === 1) row.wins += 1
  else if (gameResult.score === 0.5) row.draws += 1
  else if (gameResult.score === 0) row.losses += 1
  else throw new Error(`Invalid completed score: ${gameResult.score}`)
  return row
}

export function finalizeCalibrationRow(row) {
  if (!row.completedGames) return row
  const points = row.wins + row.draws * 0.5
  row.scoreRate = round(points / row.completedGames, 4)
  const interval = wilsonInterval(points, row.completedGames)
  row.scoreConfidenceInterval95 = {
    lower: round(interval.lower, 4),
    upper: round(interval.upper, 4),
  }
  return row
}

export function estimateEloWithInterval(rows) {
  const completedGames = rows.reduce((sum, row) => sum + row.completedGames, 0)
  const unfinishedGames = rows.reduce((sum, row) => sum + row.unfinishedGames, 0)
  const failedGames = rows.reduce((sum, row) => sum + row.failedGames, 0)
  if (!completedGames) {
    return {
      rating: null,
      lower95: null,
      upper95: null,
      completedGames,
      unfinishedGames,
      failedGames,
    }
  }

  const rating = solveLikelihoodMaximum(rows)
  const maximum = logLikelihood(rows, rating)
  const target = maximum - PROFILE_LIKELIHOOD_95_DELTA
  const lower95 = solveLikelihoodBoundary(rows, target, RATING_FLOOR, rating, 'lower')
  const upper95 = solveLikelihoodBoundary(rows, target, rating, RATING_CEILING, 'upper')
  return {
    rating: Math.round(rating),
    lower95: Math.round(lower95),
    upper95: Math.round(upper95),
    completedGames,
    unfinishedGames,
    failedGames,
  }
}

function solveLikelihoodMaximum(rows) {
  let low = RATING_FLOOR
  let high = RATING_CEILING
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const rating = (low + high) / 2
    let gradient = 0
    for (const row of rows) {
      if (!row.completedGames) continue
      const actualPoints = row.wins + row.draws * 0.5
      const expected = expectedScore(rating, row.anchorElo)
      gradient += actualPoints - row.completedGames * expected
    }
    if (gradient > 0) low = rating
    else high = rating
  }
  return (low + high) / 2
}

function solveLikelihoodBoundary(rows, target, low, high, side) {
  const edge = side === 'lower' ? low : high
  if (logLikelihood(rows, edge) >= target) return edge
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const midpoint = (low + high) / 2
    const aboveTarget = logLikelihood(rows, midpoint) >= target
    if (side === 'lower') {
      if (aboveTarget) high = midpoint
      else low = midpoint
    } else if (aboveTarget) {
      low = midpoint
    } else {
      high = midpoint
    }
  }
  return (low + high) / 2
}

function logLikelihood(rows, rating) {
  let total = 0
  for (const row of rows) {
    if (!row.completedGames) continue
    const points = row.wins + row.draws * 0.5
    const misses = row.completedGames - points
    const expected = clamp(expectedScore(rating, row.anchorElo), 1e-12, 1 - 1e-12)
    total += points * Math.log(expected) + misses * Math.log(1 - expected)
  }
  return total
}

function expectedScore(rating, anchorElo) {
  return 1 / (1 + 10 ** ((anchorElo - rating) / 400))
}

function wilsonInterval(points, games, z = 1.959963984540054) {
  const proportion = points / games
  const denominator = 1 + (z * z) / games
  const center = (proportion + (z * z) / (2 * games)) / denominator
  const margin = z * Math.sqrt(
    (proportion * (1 - proportion) + (z * z) / (4 * games)) / games,
  ) / denominator
  return {
    lower: clamp(center - margin, 0, 1),
    upper: clamp(center + margin, 0, 1),
  }
}

function classifyGameOutcome(game, profileColor) {
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'b' : 'w'
    return {
      score: winner === profileColor ? 1 : 0,
      result: winner === 'w' ? '1-0' : '0-1',
      reason: 'checkmate',
    }
  }
  if (!game.isGameOver()) return null
  return {
    score: 0.5,
    result: '1/2-1/2',
    reason: drawReason(game),
  }
}

function drawReason(game) {
  if (game.isStalemate()) return 'stalemate'
  if (game.isThreefoldRepetition()) return 'threefold-repetition'
  if (game.isInsufficientMaterial()) return 'insufficient-material'
  if (typeof game.isDrawByFiftyMoves === 'function' && game.isDrawByFiftyMoves()) {
    return 'fifty-move-rule'
  }
  return 'draw'
}

function enrichCandidates(candidates, game) {
  const legalMoves = new Map(
    game.moves({ verbose: true }).map((move) => [moveToUci(move), move]),
  )
  return candidates.map((candidate) => ({
    ...candidate,
    move: legalMoves.get(candidate.uci),
  }))
}

function withRatingStrengthPolicy(profile) {
  return {
    ...profile,
    variant: {
      ...profile.variant,
      movePolicy: { type: 'rating-strength' },
    },
  }
}

function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}

function uciToMove(uci) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4] || 'q',
  }
}

function calibrationError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function summarizeReport(profiles) {
  return profiles.reduce(
    (totals, profile) => ({
      completedGames: totals.completedGames + profile.completedGames,
      unfinishedGames: totals.unfinishedGames + profile.unfinishedGames,
      failedGames: totals.failedGames + profile.failedGames,
    }),
    { completedGames: 0, unfinishedGames: 0, failedGames: 0 },
  )
}

function printProgress(profile, requestedInitialElo, row) {
  process.stdout.write(
    `${profile.name} ${requestedInitialElo ?? 'rule'} vs ${row.anchorElo}: ` +
    `${row.wins}-${row.draws}-${row.losses}, ` +
    `${row.unfinishedGames} unfinished, ${row.failedGames} failed\r`,
  )
}

function formatEstimate(estimate) {
  if (estimate.rating === null) return 'unavailable'
  return `${estimate.rating} Elo (95% CI ${estimate.lower95}-${estimate.upper95})`
}

export class UciEngine {
  constructor(executable, label = 'engine', timeoutMs = 15000) {
    this.executable = executable
    this.label = label
    this.timeoutMs = timeoutMs
    this.process = null
    this.waiters = []
    this.active = null
    this.buffer = ''
    this.failure = null
    this.closing = false
  }

  async start() {
    this.failure = null
    this.buffer = ''
    this.closing = false
    this.process = spawn(this.executable, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.process.stdout.setEncoding('utf8')
    this.process.stdout.on('data', (chunk) => this.consume(chunk))
    this.process.stderr.setEncoding('utf8')
    this.process.stderr.on('data', () => {})
    this.process.on('error', (error) => this.fail(error))
    this.process.on('exit', (code, signal) => {
      if (!this.closing) {
        this.fail(new Error(`exited with code ${code ?? 'null'} (${signal || 'no signal'})`))
      }
    })
    this.send('uci')
    await this.waitFor((line) => line === 'uciok', 10000)
    this.send('setoption name Threads value 1')
    this.send('setoption name Hash value 32')
    await this.ready()
  }

  async restart() {
    this.close()
    await this.start()
  }

  async newGame() {
    this.send('ucinewgame')
    this.send('setoption name Clear Hash')
    await this.ready()
  }

  async ready() {
    this.send('isready')
    await this.waitFor((line) => line === 'readyok', 10000)
  }

  async analyze(positionCommand, { count, nodes, elo }) {
    await this.ready()
    const nativeElo = nativeEngineElo(elo)
    if (Number.isFinite(elo) && nativeElo === undefined) {
      throw calibrationError(
        'unsupported-uci-elo',
        `${this.label} received unsupported UCI_Elo ${elo}`,
      )
    }
    this.send(`setoption name UCI_LimitStrength value ${nativeElo === undefined ? 'false' : 'true'}`)
    if (nativeElo !== undefined) this.send(`setoption name UCI_Elo value ${nativeElo}`)
    this.send(`setoption name MultiPV value ${Math.max(1, Math.floor(count))}`)
    await this.ready()
    this.send(positionCommand)

    const lines = new Map()
    const bestmove = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const error = calibrationError(
          'engine-timeout',
          `${this.label} search exceeded ${this.timeoutMs}ms`,
        )
        error.engine = this.label
        this.send('stop')
        this.active = null
        reject(error)
      }, this.timeoutMs)
      this.active = {
        lines,
        finish: (move) => {
          clearTimeout(timeout)
          this.active = null
          resolve(move)
        },
        reject: (error) => {
          clearTimeout(timeout)
          this.active = null
          reject(error)
        },
      }
      this.send(`go nodes ${Math.max(200, Math.floor(nodes))}`)
    })

    if (!bestmove || bestmove === '(none)') {
      throw calibrationError('missing-bestmove', `${this.label} returned no best move`)
    }
    const candidates = [...lines.values()].sort((a, b) => a.rank - b.rank)
    if (nativeElo !== undefined) {
      const selected = candidates.find((candidate) => candidate.uci === bestmove)
      return [{ ...(selected || candidates[0] || {}), uci: bestmove, rank: 1 }]
    }
    if (!candidates.length) {
      return [{ uci: bestmove, score: null, mate: null, rank: 1, pv: [bestmove] }]
    }
    return candidates
  }

  consume(chunk) {
    this.buffer += chunk
    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() || ''
    for (const line of lines) this.handleLine(line.trim())
  }

  handleLine(line) {
    for (const waiter of [...this.waiters]) {
      if (!waiter.predicate(line)) continue
      clearTimeout(waiter.timeout)
      this.waiters.splice(this.waiters.indexOf(waiter), 1)
      waiter.resolve(line)
    }
    if (!this.active) return
    if (line.startsWith('info ')) {
      const parsed = parseInfo(line)
      if (parsed) this.active.lines.set(parsed.rank, parsed)
    } else if (line.startsWith('bestmove ')) {
      this.active.finish(line.split(/\s+/)[1])
    }
  }

  waitFor(predicate, timeoutMs) {
    if (this.failure) return Promise.reject(this.failure)
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.waiters.splice(this.waiters.indexOf(waiter), 1)
          const error = calibrationError(
            'engine-timeout',
            `${this.label} timed out waiting for Stockfish`,
          )
          error.engine = this.label
          reject(error)
        }, timeoutMs),
      }
      this.waiters.push(waiter)
    })
  }

  fail(error) {
    const message = error instanceof Error ? error.message : String(error)
    const wrapped = calibrationError(
      'engine-failure',
      `${this.label}: ${message}`,
    )
    wrapped.engine = this.label
    this.failure = wrapped
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timeout)
      waiter.reject(wrapped)
    }
    this.active?.reject(wrapped)
  }

  send(command) {
    if (!this.process?.stdin?.writable) {
      throw calibrationError('engine-failure', `${this.label} process is not writable`)
    }
    this.process.stdin.write(`${command}\n`)
  }

  close() {
    if (!this.process) return
    this.closing = true
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timeout)
      waiter.reject(calibrationError('engine-closed', `${this.label} closed`))
    }
    if (this.active) {
      this.active.reject(calibrationError('engine-closed', `${this.label} closed`))
    }
    try {
      this.process.stdin.end('quit\n')
      this.process.kill()
    } catch {
      // The process may already be gone after a recorded engine failure.
    }
    this.process = null
    this.active = null
  }
}

function parseInfo(text) {
  const rank = Number(text.match(/\bmultipv\s+(\d+)/)?.[1] || 1)
  const scoreMatch = text.match(/\bscore\s+(cp|mate)\s+(-?\d+)/)
  const pvText = text.match(/\bpv\s+(.+)$/)?.[1]
  if (!scoreMatch || !pvText) return null
  const pv = pvText.trim().split(/\s+/)
  const mate = scoreMatch[1] === 'mate' ? Number(scoreMatch[2]) : null
  const score = mate === null
    ? Number(scoreMatch[2])
    : Math.sign(mate || 1) * (100000 - Math.abs(mate))
  return { uci: pv[0], score, mate, rank, pv }
}

function resolveEnginePath(explicit) {
  const candidates = [
    explicit,
    process.env.STOCKFISH_PATH,
    path.join(
      os.homedir(),
      'Downloads',
      'Bookup',
      'stockfish',
      'stockfish-windows-x86-64-avx2.exe',
    ),
  ].filter(Boolean)
  const match = candidates.find((candidate) => existsSync(candidate))
  if (match) return path.resolve(match)
  throw new Error('Pass --engine=<path-to-stockfish> or set STOCKFISH_PATH.')
}

export function parseArgs(args) {
  const values = Object.fromEntries(args.map((argument) => {
    const [key, ...rest] = argument.replace(/^--/, '').split('=')
    return [key, rest.join('=')]
  }))
  return {
    engine: values.engine || null,
    profiles: values.profiles || 'all',
    anchors: values.anchors || DEFAULT_ANCHORS.join(','),
    games: positiveInteger(values.games, 8),
    nodes: positiveInteger(values.nodes, 8000),
    judgeNodes: positiveInteger(values.judgeNodes, positiveInteger(values.nodes, 8000)),
    maxPlies: positiveInteger(values.maxPlies, 180),
    timeoutMs: positiveInteger(values.timeoutMs, 15000),
    seed: positiveInteger(values.seed, 20260725),
    rating: values.rating === undefined ? null : Number(values.rating),
    freezeRating: values['freeze-rating'] === 'true' || values['freeze-rating'] === '',
    output: path.resolve(values.output || 'artifacts/iwantcheckmate-elo-calibration.json'),
  }
}

function validateOptions(options) {
  const anchors = options.anchors.split(',').map(Number).filter(Number.isFinite)
  if (!anchors.length) throw new Error('At least one numeric --anchors value is required.')
  for (const anchor of anchors) {
    if (nativeEngineElo(anchor) === undefined) {
      throw new Error(
        `Anchor ${anchor} is outside Stockfish's native ${NATIVE_MIN_ELO}-${NATIVE_MAX_ELO} range.`,
      )
    }
  }
  if (options.games % 2 !== 0) {
    throw new Error('--games must be even so each opening is played with both colors.')
  }
  if (options.rating !== null && !Number.isFinite(options.rating)) {
    throw new Error('--rating must be numeric when provided.')
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

export function seededRandom(seed) {
  let state = Number(seed) >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (isMain) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
