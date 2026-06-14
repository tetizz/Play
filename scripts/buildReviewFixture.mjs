import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Chess } from 'chess.js'

const input = process.argv[2]
const output = process.argv[3]
const depth = Math.max(1, Number(process.argv[4]) || 18)
const multiPv = Math.max(2, Number(process.argv[5]) || 6)

if (!input || !output) {
  throw new Error('Usage: node scripts/buildReviewFixture.mjs input.pgn output.json [depth] [multiPv]')
}

const require = createRequire(import.meta.url)
const initializeStockfish = require('stockfish')
const originalLog = console.log
let messageHandler = () => {}
console.log = (...parts) => messageHandler(parts.join(' '))
const engine = await initializeStockfish('lite-single')

function send(command) {
  engine.sendCommand(command)
}

function analyzeFen(fen) {
  return new Promise((resolve) => {
    const lines = new Map()
    messageHandler = (message) => {
      if (message.startsWith('info ')) {
        const parsed = parseLine(message)
        if (parsed) lines.set(parsed.rank, parsed)
        return
      }
      if (!message.startsWith('bestmove')) return
      resolve([...lines.values()].sort((first, second) => first.rank - second.rank))
    }
    send(`setoption name MultiPV value ${multiPv}`)
    send(`position fen ${fen}`)
    send(`go depth ${depth}`)
  })
}

const pgn = fs.readFileSync(path.resolve(input), 'utf8')
const source = new Chess()
source.loadPgn(pgn)
const moves = source.history({ verbose: true })
const replay = new Chess()
const positions = [replay.fen()]
for (const move of moves) {
  replay.move(move.san)
  positions.push(replay.fen())
}

const analyses = []
for (let index = 0; index < positions.length - 1; index += 1) {
  originalLog(`Analyzing ${index + 1}/${positions.length - 1}`)
  analyses.push(await analyzeFen(positions[index]))
}

const records = moves.map((move, index) => {
  const candidates = analyses[index]
  const uci = toUci(move)
  const candidate = candidates.find((line) => line.uci === uci)
  const after = index + 1 < analyses.length ? analyses[index + 1]?.[0] : terminalLine(positions[index + 1])
  const played = candidate || {
    uci,
    rank: null,
    score: Number.isFinite(after?.score) ? -after.score : null,
    mate: Number.isFinite(after?.mate) ? -after.mate : null,
    pv: [uci, ...(after?.pv || [])],
  }
  const before = new Chess(positions[index])
  return {
    ply: index + 1,
    side: move.color,
    san: move.san,
    move: uci,
    fen: positions[index],
    legal: before.moves().length,
    best: candidates[0] || null,
    played,
    candidates,
  }
})

console.log = originalLog
fs.writeFileSync(path.resolve(output), `${JSON.stringify(records, null, 2)}\n`)
send('quit')
originalLog(`Wrote ${records.length} review records to ${output}`)

function parseLine(message) {
  const rank = Number(message.match(/\bmultipv\s+(\d+)/)?.[1] || 1)
  const scoreMatch = message.match(/\bscore\s+(cp|mate)\s+(-?\d+)/)
  const pvText = message.match(/\bpv\s+(.+)$/)?.[1]
  if (!scoreMatch || !pvText) return null
  const pv = pvText.trim().split(/\s+/).filter(Boolean)
  if (!pv[0]) return null
  const raw = Number(scoreMatch[2])
  const mate = scoreMatch[1] === 'mate' ? raw : null
  const score = mate === null ? raw : Math.sign(mate || 1) * (100000 - Math.abs(mate))
  return { uci: pv[0], score, mate, rank, pv }
}

function terminalLine(fen) {
  const game = new Chess(fen)
  if (game.isCheckmate()) {
    return { score: -100000, mate: -1, pv: [] }
  }
  return { score: 0, mate: null, pv: [] }
}

function toUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}
