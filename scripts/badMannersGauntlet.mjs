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
const cases = buildCases().slice(0, LIMIT)
const results = []

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
    results.push({
      id: item.id,
      category: item.category,
      fen: item.fen,
      searchMoves,
      selectedUci,
      selectedSan: decision.move?.san || null,
      source: decision.source || null,
      score: decision.score ?? null,
      pass: verdict.pass,
      reason: verdict.reason,
    })
    if ((index + 1) % 25 === 0) {
      const passed = results.filter((result) => result.pass).length
      console.log(`${index + 1}/${cases.length} checked, ${passed} passed`)
    }
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
  total: results.length,
  passed,
  failed,
  byCategory,
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

function buildCases() {
  const cases = []
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
  for (let i = 0; i < 60; i += 1) {
    const [fen, expectedPromotion] = promotionTemplates[i % promotionTemplates.length]
    add({ id: `promotion-${i + 1}`, category: 'minor-promotion', fen, expectedPromotion })
  }

  const sacrificeTemplates = [
    '7k/8/8/8/8/8/K5R1/1BN5 w - - 0 1',
    '7k/8/8/8/8/8/K5Q1/1BN5 w - - 0 1',
    '6k1/8/8/8/8/8/K4R2/1BN5 w - - 0 1',
    '6k1/8/8/8/8/8/K4Q2/1BN5 w - - 0 1',
    '5k2/8/8/8/8/8/2K4R/2BN4 w - - 0 1',
  ]
  for (let i = 0; i < 45; i += 1) {
    add({ id: `sacrifice-${i + 1}`, category: 'surplus-sacrifice', fen: sacrificeTemplates[i % sacrificeTemplates.length], expectedSacrifice: true })
  }

  const captureTemplates = [
    ['6k1/8/8/8/8/8/4r3/2K1QBN1 w - - 0 1', 'r'],
    ['6k1/8/8/8/8/8/4n3/2K1QBN1 w - - 0 1', 'n'],
    ['6k1/8/8/8/8/8/4b3/2K1QBN1 w - - 0 1', 'b'],
    ['6k1/8/8/8/8/8/4q3/2K1RBN1 w - - 0 1', 'q'],
    ['5k2/8/8/8/8/8/5r2/2K2QBN w - - 0 1', 'r'],
  ]
  for (let i = 0; i < 45; i += 1) {
    const [fen, expectedCapture] = captureTemplates[i % captureTemplates.length]
    add({ id: `capture-${i + 1}`, category: 'win-enemy-piece', fen, expectedCapture })
  }

  const geometryTemplates = [
    '8/8/8/4k3/8/3K4/4P3/2B5 w - - 0 1',
    '8/8/8/3k4/8/2K5/3P4/6N1 w - - 0 1',
    '8/8/2k5/8/1K6/2P5/8/5B2 w - - 0 1',
    '8/8/5k2/8/4K3/5P2/8/1N6 w - - 0 1',
    '8/8/8/1k6/8/2K5/1P6/6B1 w - - 0 1',
  ]
  for (let i = 0; i < 50; i += 1) {
    add({
      id: `geometry-${i + 1}`,
      category: 'pawn-race-geometry',
      fen: geometryTemplates[i % geometryTemplates.length],
      expectedPawnProgress: i % 2 === 0,
      expectedKingGeometry: i % 2 === 1,
    })
  }
  return cases
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
