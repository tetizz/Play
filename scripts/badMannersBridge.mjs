import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'

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
const PORT = Number(process.env.BAD_MANNERS_PORT || 47818)
const HOST = process.env.BAD_MANNERS_HOST || '127.0.0.1'

const ENGINE_OPTIONS = [
  ['BadMannersMode', 'true'],
  ['KBNMateChallenge', 'true'],
  ['RequirePureKBNFinal', 'true'],
  ['PromoteMissingMinor', 'true'],
  ['SacrificeAllOtherPieces', 'true'],
  ['PreserveForcedWin', 'true'],
  ['PreferForcedSacrifices', 'true'],
  ['UseKBNTablebase', 'true'],
  ['KBNVerificationDepth', '18'],
  ['ChallengeVerificationDepth', '12'],
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
  console.error('Set BAD_MANNERS_ENGINE_PATH to the built .exe and retry.')
  process.exit(1)
}

class UciEngine {
  constructor(enginePath) {
    this.enginePath = enginePath
    this.proc = null
    this.buffer = ''
    this.waiters = []
    this.searchState = null
    this.readyPromise = null
    this.chain = Promise.resolve()
  }

  async ensureReady() {
    if (this.readyPromise) return this.readyPromise
    this.readyPromise = this.start()
    return this.readyPromise
  }

  async start() {
    this.proc = spawn(this.enginePath, [], {
      cwd: path.dirname(this.enginePath),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.proc.stdout.setEncoding('utf8')
    this.proc.stderr.setEncoding('utf8')
    this.proc.stdout.on('data', (chunk) => this.handleChunk(chunk))
    this.proc.stderr.on('data', (chunk) => {
      const text = String(chunk).trim()
      if (text) console.error(text)
    })
    this.proc.once('exit', (code) => {
      this.rejectWaiters(new Error(`BadMannersStockfish exited with code ${code}`))
      this.searchState?.resolve([])
      this.searchState = null
      this.proc = null
      this.readyPromise = null
    })

    this.send('uci')
    await this.waitFor((line) => line === 'uciok', 5000)
    for (const [name, value] of ENGINE_OPTIONS) {
      this.send(`setoption name ${name} value ${value}`)
    }
    this.send('isready')
    await this.waitFor((line) => line === 'readyok', 5000)
  }

  async bestMoves(fen, options = {}) {
    this.chain = this.chain
      .catch(() => undefined)
      .then(() => this.search(fen, options))
    return this.chain
  }

  async search(fen, options = {}) {
    await this.ensureReady()
    const count = clamp(Number(options.count || 1), 1, 16)
    const depth = clamp(Number(options.depth || 22), 1, 64)
    const moveTime = clamp(Number(options.moveTime || 3200), 100, 60000)
    const searchMoves = Array.isArray(options.searchMoves)
      ? options.searchMoves.filter((move) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))
      : []

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.send('stop')
        setTimeout(() => {
          if (!this.searchState) return
          const lines = sortedLines(this.searchState.lines)
          this.searchState.resolve(lines)
          this.searchState = null
        }, 800)
      }, Math.max(2500, moveTime + 2500))

      this.searchState = {
        lines: new Map(),
        timeout,
        resolve: (lines) => {
          clearTimeout(timeout)
          resolve(lines)
        },
      }
      this.send(`setoption name MultiPV value ${count}`)
      this.send(`position fen ${fen}`)
      const searchClause = searchMoves.length ? ` searchmoves ${searchMoves.join(' ')}` : ''
      this.send(`go depth ${depth} movetime ${moveTime}${searchClause}`)
    })
  }

  handleChunk(chunk) {
    this.buffer += chunk
    const parts = this.buffer.split(/\r?\n/)
    this.buffer = parts.pop() || ''
    for (const rawLine of parts) this.handleLine(rawLine.trim())
  }

  handleLine(line) {
    if (!line) return
    for (const waiter of [...this.waiters]) {
      if (!waiter.match(line)) continue
      clearTimeout(waiter.timeout)
      this.waiters = this.waiters.filter((entry) => entry !== waiter)
      waiter.resolve(line)
    }

    if (!this.searchState) return
    if (line.startsWith('info ')) {
      const parsed = parsePrincipalVariation(line)
      if (parsed) this.searchState.lines.set(parsed.rank, parsed)
      return
    }
    if (!line.startsWith('bestmove')) return
    const bestmove = line.split(/\s+/)[1]
    const lines = sortedLines(this.searchState.lines)
    if (!lines.length && bestmove && bestmove !== '(none)') {
      lines.push({ uci: bestmove, score: null, mate: null, rank: 1, pv: [bestmove] })
    }
    const state = this.searchState
    this.searchState = null
    state.resolve(lines)
  }

  waitFor(match, timeoutMs) {
    return new Promise((resolve, reject) => {
      const waiter = {
        match,
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.waiters = this.waiters.filter((entry) => entry !== waiter)
          reject(new Error('Timed out waiting for UCI response'))
        }, timeoutMs),
      }
      this.waiters.push(waiter)
    })
  }

  rejectWaiters(error) {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timeout)
      waiter.reject(error)
    }
    this.waiters = []
  }

  send(command) {
    this.proc?.stdin.write(`${command}\n`)
  }

  destroy() {
    this.searchState?.resolve([])
    this.searchState = null
    this.rejectWaiters(new Error('Engine stopped'))
    this.proc?.kill()
  }
}

const engine = new UciEngine(ENGINE_PATH)

const server = createServer(async (request, response) => {
  setCors(response)
  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`)
  if (request.method === 'GET' && url.pathname === '/health') {
    writeJson(response, 200, {
      ok: true,
      enginePath: ENGINE_PATH,
      engineExists: existsSync(ENGINE_PATH),
    })
    return
  }

  if (request.method !== 'POST' || url.pathname !== '/bestmove') {
    writeJson(response, 404, { error: 'not_found' })
    return
  }

  try {
    const body = await readJson(request)
    const fen = String(body.fen || '')
    new Chess(fen)
    const lines = await engine.bestMoves(fen, body.options || {})
    writeJson(response, 200, { lines })
  } catch (error) {
    writeJson(response, 400, { error: error.message || 'bad_request' })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Bad Manners bridge listening at http://${HOST}:${PORT}`)
  console.log(`Engine: ${ENGINE_PATH}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close()
    engine.destroy()
    process.exit(0)
  })
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

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept')
}

function writeJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(payload))
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 16384) {
        reject(new Error('Request too large'))
        request.destroy()
      }
    })
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    request.on('error', reject)
  })
}
