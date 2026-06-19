import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'
import { annotateBadMannersCandidates, badMannersSearchUcis } from '../src/lib/badMannersClient.js'
import { chooseCoachMove } from '../src/lib/coachEngine.js'
import { getBotProfile } from '../src/data/botProfiles.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const downloadsRoot = path.resolve(repoRoot, '..')
const DEFAULT_ENGINE_PATH = path.join(
  downloadsRoot,
  'BadMannersStockfish',
  'dist',
  'BadMannersStockfish18.exe',
)
const ENGINE_PATH = process.env.BAD_MANNERS_ENGINE_PATH || DEFAULT_ENGINE_PATH
const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 200)
const DEPTH = Number(process.argv.find((arg) => arg.startsWith('--depth='))?.split('=')[1] || 14)
const MOVE_TIME = Number(process.argv.find((arg) => arg.startsWith('--movetime='))?.split('=')[1] || 650)
const LINE_PLIES = Number(process.argv.find((arg) => arg.startsWith('--line-plies='))?.split('=')[1] || 140)
const SEED = process.argv.find((arg) => arg.startsWith('--seed='))?.split('=')[1] || String(Date.now())
const COMPARE = process.argv.includes('--compare')
const OUT = process.argv.find((arg) => arg.startsWith('--out='))?.split('=')[1] ||
  path.join(repoRoot, 'test-results', 'bad-manners-gauntlet.json')
const PUBLIC_OUT = process.argv.find((arg) => arg.startsWith('--public-out='))?.split('=')[1] ||
  path.join(repoRoot, 'public', 'private', 'bad-manners-kbnk-trixize-200.json')

const BAD_MANNERS_OPTIONS = [
  ['BadMannersMode', 'true'],
  ['KBNMateChallenge', 'true'],
  ['RequirePureKBNFinal', 'true'],
  ['PromoteMissingMinor', 'true'],
  ['SacrificeAllOtherPieces', 'true'],
  ['PreserveForcedWin', 'true'],
  ['PreferForcedSacrifices', 'true'],
  ['UseKBNTablebase', 'true'],
  ['KBNVerificationDepth', '16'],
  ['ChallengeVerificationDepth', '10'],
  ['CompleteKBNVerificationDepth', '2'],
  ['ChallengePlanningDepth', '6'],
  ['MinimumSafeEvaluation', '120'],
  ['AllowMateDelay', 'true'],
  ['MaximumAllowedMateDelay', '80'],
  ['RespectFiftyMoveRule', 'true'],
  ['VerboseChallengeOutput', 'false'],
]

if (!existsSync(ENGINE_PATH)) {
  console.error(`BadMannersStockfish executable not found: ${ENGINE_PATH}`)
  process.exit(1)
}

class UciEngine {
  constructor(enginePath) {
    this.enginePath = enginePath
    this.proc = null
    this.buffer = ''
    this.waiters = []
    this.active = null
  }

  async start(options) {
    this.proc = spawn(this.enginePath, [], {
      cwd: path.dirname(this.enginePath),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.proc.stdout.setEncoding('utf8')
    this.proc.stdout.on('data', (chunk) => this.handleChunk(chunk))
    this.proc.stderr.setEncoding('utf8')
    this.proc.stderr.on('data', () => undefined)
    this.proc.once('exit', () => {
      this.active?.resolve([])
      this.active = null
    })
    this.send('uci')
    await this.waitFor((line) => line === 'uciok', 5000)
    for (const [name, value] of options) this.send(`setoption name ${name} value ${value}`)
    this.send('isready')
    await this.waitFor((line) => line === 'readyok', 5000)
  }

  search(fen, { depth = DEPTH, moveTime = MOVE_TIME, count = 1, searchMoves = [] } = {}) {
    return new Promise((resolve) => {
      const lines = new Map()
      const timeout = setTimeout(() => {
        this.send('stop')
        setTimeout(() => {
          if (!this.active) return
          const active = this.active
          this.active = null
          active.resolve(sortedLines(lines))
        }, 500)
      }, Math.max(1400, moveTime + 1600))
      this.active = {
        lines,
        resolve: (value) => {
          clearTimeout(timeout)
          resolve(value)
        },
      }
      this.send(`setoption name MultiPV value ${Math.max(1, Math.min(16, count))}`)
      this.send(`position fen ${fen}`)
      const legalSearchMoves = searchMoves.filter((move) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))
      const searchClause = legalSearchMoves.length ? ` searchmoves ${legalSearchMoves.join(' ')}` : ''
      this.send(`go depth ${depth} movetime ${moveTime}${searchClause}`)
    })
  }

  handleChunk(chunk) {
    this.buffer += chunk
    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() || ''
    for (const rawLine of lines) this.handleLine(rawLine.trim())
  }

  handleLine(line) {
    if (!line) return
    for (const waiter of [...this.waiters]) {
      if (!waiter.match(line)) continue
      clearTimeout(waiter.timeout)
      this.waiters = this.waiters.filter((entry) => entry !== waiter)
      waiter.resolve(line)
    }
    if (!this.active) return
    if (line.startsWith('info ')) {
      const parsed = parsePrincipalVariation(line)
      if (parsed) this.active.lines.set(parsed.rank, parsed)
      return
    }
    if (!line.startsWith('bestmove')) return
    const bestmove = line.split(/\s+/)[1]
    const lines = sortedLines(this.active.lines)
    if (!lines.length && bestmove && bestmove !== '(none)') {
      lines.push({ uci: bestmove, score: null, mate: null, rank: 1, pv: [bestmove] })
    }
    const active = this.active
    this.active = null
    active.resolve(lines)
  }

  waitFor(match, timeoutMs) {
    return new Promise((resolve, reject) => {
      const waiter = {
        match,
        resolve,
        timeout: setTimeout(() => {
          this.waiters = this.waiters.filter((entry) => entry !== waiter)
          reject(new Error('Timed out waiting for UCI response'))
        }, timeoutMs),
      }
      this.waiters.push(waiter)
    })
  }

  send(command) {
    this.proc?.stdin.write(`${command}\n`)
  }

  destroy() {
    this.proc?.kill()
  }
}

const engine = new UciEngine(ENGINE_PATH)
await engine.start(BAD_MANNERS_OPTIONS)

const profile = getBotProfile('trixize')
const rng = createRng(hashSeed(SEED))
const tablebaseCache = new Map()
const candidateCases = buildCases(rng, LIMIT * 4)
const { cases, rejectedCases } = await selectWinningCases(candidateCases, LIMIT)
const results = []
const proofCache = new Map()

if (cases.length < LIMIT) {
  console.warn(`Only found ${cases.length}/${LIMIT} winning randomized cases after rejecting ${rejectedCases.length}`)
}

try {
  for (let index = 0; index < cases.length; index += 1) {
    const item = cases[index]
    const game = new Chess(item.fen)
    const searchMoves = badMannersSearchUcis(game)
    const rawLines = await engine.search(item.fen, {
      count: searchMoves.length ? Math.min(16, searchMoves.length) : 8,
      searchMoves,
    })
    const candidates = annotateBadMannersCandidates(game, rawLines)
    const decision = chooseCoachMove(
      game,
      candidates,
      profile,
      { openingBook: {}, bookMaxPlies: 0 },
    )
    const selectedUci = decision.move ? moveToUci(decision.move) : null
    const verdict = evaluateCase(item, game, decision, selectedUci)
    const lineProof = verdict.pass
      ? await cachedFullLineProof(item, game, decision, selectedUci)
      : { pass: false, reason: 'first move failed', line: [] }
    const pass = verdict.pass && lineProof.pass
    const comparison = COMPARE
      ? await compareAgainstLegacy(item, game, candidates, decision, selectedUci, pass, lineProof)
      : null
    results.push({
      id: item.id,
      category: item.category,
      fen: item.fen,
      startingTablebase: item.startingTablebase || null,
      randomized: item.randomized || null,
      duplicateIndex: item.duplicateIndex || 0,
      searchMoves,
      selectedUci,
      selectedSan: decision.move?.san || null,
      source: decision.source || null,
      score: decision.score ?? null,
      pass,
      reason: pass ? lineProof.reason : `${verdict.reason}; ${lineProof.reason}`,
      firstMoveReason: verdict.reason,
      line: lineProof.line,
      linePlies: lineProof.line.length,
      comparison,
      reachedKbnk: lineProof.reachedKbnk,
      kbnkPly: lineProof.kbnkPly,
      checkmated: lineProof.checkmated,
      finalFen: lineProof.finalFen,
    })
    const passed = results.filter((result) => result.pass).length
    console.log(`${index + 1}/${cases.length} ${item.id} ${pass ? 'passed' : 'failed'} line=${lineProof.line.length} totalPassed=${passed}`)
  }
} finally {
  engine.destroy()
}

const passed = results.filter((result) => result.pass).length
const failed = results.length - passed
const byCategory = Object.fromEntries(
  [...new Set(results.map((result) => result.category))].map((category) => {
    const bucket = results.filter((result) => result.category === category)
    return [category, {
      total: bucket.length,
      passed: bucket.filter((result) => result.pass).length,
      failed: bucket.filter((result) => !result.pass).length,
    }]
  }),
)
const report = {
  enginePath: ENGINE_PATH,
  depth: DEPTH,
  moveTime: MOVE_TIME,
  linePlies: LINE_PLIES,
  seed: SEED,
  randomized: true,
  rejectedStartingPositions: rejectedCases.length,
  tablebasePositions: tablebaseCache.size,
  proofLines: proofCache.size,
  comparison: COMPARE ? summarizeComparison(results) : null,
  total: results.length,
  passed,
  failed,
  byCategory,
  rejectedCases: rejectedCases.slice(0, 50),
  failures: results.filter((result) => !result.pass).slice(0, 25),
  results,
}
mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
mkdirSync(path.dirname(PUBLIC_OUT), { recursive: true })
writeFileSync(PUBLIC_OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  total: report.total,
  passed,
  failed,
  byCategory,
  report: OUT,
  publicReport: PUBLIC_OUT,
}, null, 2))
if (failed) process.exitCode = 1

function evaluateCase(item, game, decision, selectedUci) {
  if (!decision.move || !selectedUci) return { pass: false, reason: 'no move selected' }
  const after = new Chess(game.fen())
  after.move(decision.move)
  if (after.isCheckmate()) return { pass: false, reason: 'ended with immediate mate instead of conversion' }

  if (item.expectedPromotion) {
    return decision.move.promotion === item.expectedPromotion
      ? { pass: true, reason: 'promoted to required bishop/knight' }
      : { pass: false, reason: `expected promotion ${item.expectedPromotion}, got ${decision.move.promotion || 'none'}` }
  }
  if (item.expectedCapture) {
    return decision.move.captured === item.expectedCapture
      ? { pass: true, reason: `captured ${item.expectedCapture}` }
      : { pass: false, reason: `expected capture ${item.expectedCapture}, got ${decision.move.captured || 'none'}` }
  }
  if (item.expectedSacrifice) {
    const enemyKing = findKing(game, oppositeColor(decision.move.color))
    const replyCaptures = after.moves({ verbose: true }).some((reply) =>
      reply.piece === 'k' && reply.to === decision.move.to && Boolean(reply.captured))
    const closeToKing = ['q', 'r'].includes(decision.move.piece) &&
      distance(decision.move.to, enemyKing) <= 2
    return replyCaptures || decision.move.captured || closeToKing
      ? { pass: true, reason: 'offered surplus material or captured while converting' }
      : { pass: false, reason: 'did not offer surplus material' }
  }
  if (item.expectedPawnProgress) {
    return decision.move.piece === 'p' && advancedPawn(decision.move)
      ? { pass: true, reason: 'advanced conversion pawn' }
      : { pass: false, reason: `expected pawn progress, got ${selectedUci}` }
  }
  if (item.expectedKingGeometry) {
    const beforeDistance = distance(game.get(item.pawnSquare)?.square || item.pawnSquare, findKing(game, 'b'))
    const afterDistance = distance(item.pawnTarget || decision.move.to, findKing(after, 'b'))
    const kingMoved = decision.move.piece === 'k'
    return decision.move.piece === 'p' || kingMoved || afterDistance >= beforeDistance
      ? { pass: true, reason: 'made pawn/king geometry progress' }
      : { pass: false, reason: 'did not improve pawn race geometry' }
  }
  return Number.isFinite(decision.score) && decision.score >= 120
    ? { pass: true, reason: 'kept a positive conversion score' }
    : { pass: false, reason: `score too low: ${decision.score}` }
}

async function buildFullLineProof(item, startGame, decision, selectedUci) {
  if (!decision.move || !selectedUci) return { pass: false, reason: 'no first move', line: [] }
  const strongColor = decision.move.color
  const game = new Chess(startGame.fen())
  const line = []
  const firstMove = game.move(decision.move)
  if (!firstMove) return { pass: false, reason: 'first move was illegal', line: [] }
  line.push(lineEntry({
    ply: 1,
    role: 'bad-manners',
    move: firstMove,
    beforeFen: startGame.fen(),
    afterFen: game.fen(),
    note: item.category,
  }))

  let reachedKbnk = isPureKbnk(game, strongColor)
  let kbnkPly = reachedKbnk ? 1 : null

  for (let ply = 2; ply <= LINE_PLIES; ply += 1) {
    if (game.isGameOver()) break
    const beforeFen = game.fen()
    const payload = await probeTablebase(beforeFen)
    const move = game.turn() === strongColor
      ? chooseStrongContinuation(game, payload, strongColor, reachedKbnk)
      : chooseDefenderContinuation(game, payload, strongColor)
    if (!move) {
      return {
        pass: false,
        reason: `no continuation at ply ${ply}`,
        line,
        reachedKbnk,
        kbnkPly,
        checkmated: game.isCheckmate(),
        finalFen: game.fen(),
      }
    }
    const played = game.move(move)
    line.push(lineEntry({
      ply,
      role: played.color === strongColor ? 'bad-manners' : 'defender',
      move: played,
      beforeFen,
      afterFen: game.fen(),
      note: tablebaseNote(payload, moveToUci(played)),
    }))
    if (!reachedKbnk && isPureKbnk(game, strongColor)) {
      reachedKbnk = true
      kbnkPly = ply
    }
    if (game.isCheckmate()) break
  }

  const checkmated = game.isCheckmate()
  const pass = reachedKbnk && checkmated
  return {
    pass,
    reason: pass
      ? `reached KBNK on ply ${kbnkPly} and checkmated on ply ${line.length}`
      : `line ended without ${reachedKbnk ? 'checkmate' : 'KBNK conversion'}`,
    line,
    reachedKbnk,
    kbnkPly,
    checkmated,
    finalFen: game.fen(),
  }
}

async function cachedFullLineProof(item, game, decision, selectedUci) {
  const key = `${game.fen()}|${selectedUci}`
  if (!proofCache.has(key)) {
    proofCache.set(key, buildFullLineProof(item, game, decision, selectedUci))
  }
  const proof = await proofCache.get(key)
  return {
    ...proof,
    line: proof.line.map((move) => ({ ...move })),
  }
}

async function compareAgainstLegacy(item, game, candidates, improvedDecision, improvedUci, improvedPass, improvedProof) {
  const legacyDecision = legacyEngineFirstDecision(candidates)
  const legacyUci = legacyDecision?.move ? moveToUci(legacyDecision.move) : null
  if (!legacyDecision || !legacyUci) {
    return {
      improvedUci,
      improvedPass,
      improvedLinePlies: improvedProof.line.length,
      legacyUci: null,
      legacyPass: false,
      legacyLinePlies: 0,
      winner: improvedPass ? 'improved' : 'none',
      reason: 'legacy had no move',
    }
  }
  const legacyVerdict = evaluateCase(item, game, legacyDecision, legacyUci)
  const legacyProof = legacyVerdict.pass
    ? await cachedFullLineProof(item, game, legacyDecision, legacyUci)
    : { pass: false, reason: 'first move failed', line: [] }
  const legacyPass = legacyVerdict.pass && legacyProof.pass
  return {
    improvedUci,
    improvedPass,
    improvedLinePlies: improvedProof.line.length,
    legacyUci,
    legacyPass,
    legacyLinePlies: legacyProof.line.length,
    winner: comparisonWinner(improvedPass, legacyPass, improvedProof.line.length, legacyProof.line.length),
    reason: legacyPass ? legacyProof.reason : `${legacyVerdict.reason}; ${legacyProof.reason}`,
  }
}

function legacyEngineFirstDecision(candidates) {
  const candidate = candidates.find((entry) => entry?.move) || null
  if (!candidate) return null
  return {
    move: candidate.move,
    source: 'legacy-engine-first',
    score: candidate.score,
    rank: candidate.rank,
    line: candidate,
    bestLine: candidates[0] || candidate,
    candidateLines: candidates,
  }
}

function comparisonWinner(improvedPass, legacyPass, improvedLinePlies, legacyLinePlies) {
  if (improvedPass && !legacyPass) return 'improved'
  if (!improvedPass && legacyPass) return 'legacy'
  if (!improvedPass && !legacyPass) return 'none'
  if (improvedLinePlies < legacyLinePlies) return 'improved'
  if (legacyLinePlies < improvedLinePlies) return 'legacy'
  return 'tie'
}

function summarizeComparison(results) {
  const rows = results.map((result) => result.comparison).filter(Boolean)
  const improvedPassed = rows.filter((row) => row.improvedPass).length
  const legacyPassed = rows.filter((row) => row.legacyPass).length
  const improvedOnly = rows.filter((row) => row.improvedPass && !row.legacyPass).length
  const legacyOnly = rows.filter((row) => row.legacyPass && !row.improvedPass).length
  return {
    total: rows.length,
    improvedPassed,
    legacyPassed,
    improvedOnly,
    legacyOnly,
    improvedWins: rows.filter((row) => row.winner === 'improved').length,
    legacyWins: rows.filter((row) => row.winner === 'legacy').length,
    ties: rows.filter((row) => row.winner === 'tie').length,
    averageImprovedLinePlies: average(rows.filter((row) => row.improvedPass).map((row) => row.improvedLinePlies)),
    averageLegacyLinePlies: average(rows.filter((row) => row.legacyPass).map((row) => row.legacyLinePlies)),
  }
}

function average(values) {
  if (!values.length) return null
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
}

async function probeTablebase(fen) {
  const key = fen.split(' ').slice(0, 4).join(' ')
  if (tablebaseCache.has(key)) return tablebaseCache.get(key)
  const url = new URL('https://tablebase.lichess.ovh/standard')
  url.searchParams.set('fen', fen)
  const promise = fetchTablebaseWithRetry(url)
  tablebaseCache.set(key, promise)
  return promise
}

async function selectWinningCases(candidates, limit) {
  const cases = []
  const rejectedCases = []
  const seen = new Map()
  for (const candidate of candidates) {
    if (cases.length >= limit) break
    const key = candidate.fen.split(' ').slice(0, 4).join(' ')
    const duplicateCount = seen.get(key) || 0
    seen.set(key, duplicateCount + 1)
    const payload = await probeTablebase(candidate.fen)
    if (payload?.category === 'win') {
      cases.push({
        ...candidate,
        duplicateIndex: duplicateCount,
        startingTablebase: {
          category: payload.category,
          dtm: payload.dtm ?? null,
          dtz: payload.precise_dtz ?? payload.dtz ?? null,
        },
      })
    } else {
      rejectedCases.push({
        id: candidate.id,
        fen: candidate.fen,
        category: candidate.category,
        tablebaseCategory: payload?.category || 'unknown',
      })
    }
  }
  return { cases, rejectedCases }
}

async function fetchTablebaseWithRetry(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } })
      if (response.ok) return response.json()
    } catch {
      // retry below
    }
    await sleep(160 * (attempt + 1))
  }
  return null
}

function chooseStrongContinuation(game, payload, strongColor, reachedKbnk) {
  const records = legalRecords(game, payload)
  if (!records.length) return null
  const winning = records.filter(({ record }) => record.category === 'loss')
  const pool = winning.length ? winning : records
  return pool
    .map((entry) => ({
      ...entry,
      priority: strongContinuationPriority(game, entry.move, entry.record, strongColor, reachedKbnk),
    }))
    .sort((a, b) => b.priority - a.priority || compareMateDistance(a.record, b.record, reachedKbnk))[0]?.move || null
}

function chooseDefenderContinuation(game, payload, strongColor) {
  const records = legalRecords(game, payload)
  if (!records.length) return null
  const stillLosing = records.filter(({ record }) => record.category === 'win')
  const pool = stillLosing.length ? stillLosing : records
  return pool
    .map((entry) => ({
      ...entry,
      priority: defenderPriority(game, entry.move, entry.record, strongColor),
    }))
    .sort((a, b) => b.priority - a.priority)[0]?.move || null
}

function strongContinuationPriority(game, move, record, strongColor, reachedKbnk) {
  const after = new Chess(game.fen())
  after.move(move)
  if (after.isCheckmate()) return reachedKbnk ? 1_000_000 : -1_000_000
  if (isPureKbnk(after, strongColor)) return 900_000
  if (reachedKbnk) return 500_000 - mateDistance(record)
  const own = materialCounts(game, strongColor)
  const opponent = materialCounts(game, oppositeColor(strongColor))
  const opponentMaterial = opponent.p + opponent.n + opponent.b + opponent.r + opponent.q
  const hasPair = own.b >= 1 && own.n >= 1
  let score = 0
  if (move.captured && move.color === strongColor) score += 120_000 + pieceValue(move.captured)
  if (move.promotion && ['b', 'n'].includes(move.promotion)) score += 110_000
  if (move.piece === 'p' && advancedPawn(move)) score += 50_000 + Number(move.to[1]) * 100
  if (hasPair && opponentMaterial === 0 && isSurplusPiece(own, move.piece)) {
    score += 100_000 + surplusDisposalScore(game, move)
  }
  score += Math.max(0, 20_000 - mateDistance(record))
  return score
}

function defenderPriority(game, move, record, strongColor) {
  const after = new Chess(game.fen())
  after.move(move)
  let score = mateDistance(record)
  if (move.captured) score += pieceValue(move.captured) * 20
  if (!isPureKbnk(after, strongColor)) score += 10_000
  return score
}

function legalRecords(game, payload) {
  const records = new Map((payload?.moves || []).map((record) => [record.uci, record]))
  return game.moves({ verbose: true })
    .map((move) => ({ move, record: records.get(moveToUci(move)) }))
    .filter((entry) => entry.record)
}

function compareMateDistance(a, b, reachedKbnk) {
  const diff = mateDistance(a) - mateDistance(b)
  return reachedKbnk ? diff : -diff
}

function mateDistance(record) {
  const value = Math.abs(record?.dtm ?? record?.dtz ?? record?.precise_dtz ?? 999)
  return Number.isFinite(value) ? value : 999
}

function tablebaseNote(payload, uci) {
  const record = payload?.moves?.find((entry) => entry.uci === uci)
  if (!record) return null
  const distance = record.dtm ?? record.precise_dtz ?? record.dtz
  return distance === undefined ? record.category : `${record.category} ${distance}`
}

function lineEntry({ ply, role, move, beforeFen, afterFen, note }) {
  return {
    ply,
    role,
    san: move.san,
    uci: moveToUci(move),
    beforeFen,
    afterFen,
    note,
  }
}

function buildCases(rng, target = 200) {
  const cases = []
  const promotionCount = Math.ceil(target * 0.3)
  const sacrificeCount = Math.ceil(target * 0.225)
  const captureCount = Math.ceil(target * 0.225)
  const geometryCount = Math.max(0, target - promotionCount - sacrificeCount - captureCount)
  const add = (item) => {
    try {
      const game = new Chess(item.fen)
      if (!game.isGameOver()) cases.push(item)
    } catch {
      // skip illegal generated cases
    }
  }

  const promotionTemplates = [
    ['6k1/P7/8/8/8/8/8/6BK w - - 0 1', 'n'],
    ['7k/P7/8/8/8/8/8/6BK w - - 0 1', 'n'],
    ['5k2/1P6/8/8/8/8/8/6NK w - - 0 1', 'b'],
    ['6k1/1P6/8/8/8/8/8/6NK w - - 0 1', 'b'],
    ['2k5/6P1/8/8/8/8/8/2KB4 w - - 0 1', 'n'],
    ['1k6/6P1/8/8/8/8/8/2KB4 w - - 0 1', 'n'],
    ['4k3/7P/8/8/8/8/8/4K1N1 w - - 0 1', 'b'],
    ['5k2/7P/8/8/8/8/8/4K1N1 w - - 0 1', 'b'],
  ]
  for (let i = 0; i < promotionCount; i += 1) {
    const [fen, expectedPromotion] = pickRandom(promotionTemplates, rng)
    add(randomizedCase({
      id: `promotion-${i + 1}`,
      category: 'minor-promotion',
      fen,
      expectedPromotion,
    }, rng))
  }

  const sacrificeTemplates = [
    '7k/8/8/8/8/8/K5R1/1BN5 w - - 0 1',
    '7k/8/8/8/8/8/K5Q1/1BN5 w - - 0 1',
    '6k1/8/8/8/8/8/K4R2/1BN5 w - - 0 1',
    '6k1/8/8/8/8/8/K4Q2/1BN5 w - - 0 1',
    '5k2/8/8/8/8/8/2K4R/2BN4 w - - 0 1',
  ]
  for (let i = 0; i < sacrificeCount; i += 1) {
    add(randomizedCase({
      id: `sacrifice-${i + 1}`,
      category: 'surplus-sacrifice',
      fen: pickRandom(sacrificeTemplates, rng),
      expectedSacrifice: true,
    }, rng))
  }

  const captureTemplates = [
    ['6k1/8/8/8/8/8/4r3/2K1QBN1 w - - 0 1', 'r'],
    ['6k1/8/8/8/8/8/4n3/2K1QBN1 w - - 0 1', 'n'],
    ['6k1/8/8/8/8/8/4b3/2K1QBN1 w - - 0 1', 'b'],
    ['6k1/8/8/8/8/8/4q3/2K1RBN1 w - - 0 1', 'q'],
    ['5k2/8/8/8/8/8/5r2/2K2QBN w - - 0 1', 'r'],
  ]
  for (let i = 0; i < captureCount; i += 1) {
    const [fen, expectedCapture] = pickRandom(captureTemplates, rng)
    add(randomizedCase({
      id: `capture-${i + 1}`,
      category: 'win-enemy-piece',
      fen,
      expectedCapture,
    }, rng))
  }

  const geometryTemplates = [
    '8/8/8/4k3/8/3K4/4P3/2B5 w - - 0 1',
    '8/8/8/3k4/8/2K5/3P4/6N1 w - - 0 1',
    '8/8/2k5/8/1K6/2P5/8/5B2 w - - 0 1',
    '8/8/5k2/8/4K3/5P2/8/1N6 w - - 0 1',
    '8/8/8/1k6/8/2K5/1P6/6B1 w - - 0 1',
  ]
  for (let i = 0; i < geometryCount; i += 1) {
    add(randomizedCase({
      id: `geometry-${i + 1}`,
      category: 'pawn-race-geometry',
      fen: pickRandom(geometryTemplates, rng),
      expectedPawnProgress: i % 2 === 0,
      expectedKingGeometry: i % 2 === 1,
    }, rng))
  }
  return shuffle(cases, rng)
}

function randomizedCase(item, rng) {
  const mirrorFiles = rng() < 0.5
  return {
    ...item,
    id: `${item.id}-${mirrorFiles ? 'mf' : 'base'}`,
    fen: mirrorFiles ? mirrorFenFiles(item.fen) : item.fen,
    randomized: { mirrorFiles },
  }
}

function mirrorFenFiles(fen) {
  const parts = fen.split(/\s+/)
  const ranks = parts[0].split('/').map((rank) => compressRank(expandRank(rank).reverse()))
  parts[0] = ranks.join('/')
  if (/^[a-h][36]$/.test(parts[3])) {
    parts[3] = `${mirrorFile(parts[3][0])}${parts[3][1]}`
  }
  return parts.join(' ')
}

function expandRank(rank) {
  return [...rank].flatMap((char) => /\d/.test(char) ? Array(Number(char)).fill('1') : [char])
}

function compressRank(rank) {
  let output = ''
  let empty = 0
  for (const char of rank) {
    if (char === '1') {
      empty += 1
      continue
    }
    if (empty) output += String(empty)
    empty = 0
    output += char
  }
  if (empty) output += String(empty)
  return output
}

function mirrorFile(file) {
  return String.fromCharCode('h'.charCodeAt(0) - (file.charCodeAt(0) - 'a'.charCodeAt(0)))
}

function pickRandom(items, rng) {
  return items[Math.floor(rng() * items.length)]
}

function shuffle(items, rng) {
  const output = [...items]
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[output[i], output[j]] = [output[j], output[i]]
  }
  return output
}

function hashSeed(seed) {
  let hash = 2166136261
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createRng(seed) {
  let state = seed || 1
  return () => {
    state = Math.imul(1664525, state) + 1013904223
    return ((state >>> 0) / 4294967296)
  }
}

function parsePrincipalVariation(text) {
  const rank = Number(text.match(/\bmultipv\s+(\d+)/)?.[1] || 1)
  const scoreMatch = text.match(/\bscore\s+(cp|mate)\s+(-?\d+)/)
  const pvText = text.match(/\bpv\s+(.+)$/)?.[1]
  if (!scoreMatch || !pvText) return null
  const pv = pvText.trim().split(/\s+/).filter(Boolean)
  if (!pv[0]) return null
  const rawValue = Number(scoreMatch[2])
  const mate = scoreMatch[1] === 'mate' ? rawValue : null
  const score = mate === null ? rawValue : Math.sign(mate || 1) * (100000 - Math.abs(mate))
  return { uci: pv[0], score, mate, rank, pv }
}

function sortedLines(lines) {
  return [...lines.values()].sort((a, b) => a.rank - b.rank)
}

function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}

function advancedPawn(move) {
  return move.color === 'w'
    ? Number(move.to[1]) > Number(move.from[1])
    : Number(move.to[1]) < Number(move.from[1])
}

function findKing(game, color) {
  return game.board().flat().find((piece) => piece?.color === color && piece.type === 'k')?.square || null
}

function distance(a, b) {
  if (!a || !b) return 0
  return Math.max(
    Math.abs(a.charCodeAt(0) - b.charCodeAt(0)),
    Math.abs(Number(a[1]) - Number(b[1])),
  )
}

function oppositeColor(color) {
  return color === 'w' ? 'b' : 'w'
}

function materialCounts(game, color) {
  const counts = { p: 0, n: 0, b: 0, r: 0, q: 0 }
  for (const piece of game.board().flat()) {
    if (piece?.color === color && piece.type in counts) counts[piece.type] += 1
  }
  return counts
}

function isPureKbnk(game, strongColor) {
  const own = materialCounts(game, strongColor)
  const opponent = materialCounts(game, oppositeColor(strongColor))
  return own.p === 0 &&
    own.n === 1 &&
    own.b === 1 &&
    own.r === 0 &&
    own.q === 0 &&
    opponent.p === 0 &&
    opponent.n === 0 &&
    opponent.b === 0 &&
    opponent.r === 0 &&
    opponent.q === 0
}

function pieceValue(type) {
  return { p: 100, n: 320, b: 330, r: 500, q: 900 }[type] || 0
}

function isSurplusPiece(counts, type) {
  if (['p', 'q', 'r'].includes(type)) return counts[type] > 0
  if (type === 'b') return counts.b > 1
  if (type === 'n') return counts.n > 1
  return false
}

function surplusDisposalScore(game, move) {
  const enemyKing = findKing(game, oppositeColor(move.color))
  const after = new Chess(game.fen())
  after.move(move)
  const kingCanTake = after.moves({ verbose: true }).some((reply) =>
    reply.piece === 'k' && reply.to === move.to && Boolean(reply.captured))
  return (kingCanTake ? 40_000 : 0) +
    Math.max(0, 8 - distance(move.to, enemyKing)) * 1_000 +
    (move.san.includes('+') ? 500 : 0)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
