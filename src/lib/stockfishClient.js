const ENGINE_FILE = 'stockfish/stockfish-18-lite-single.js'

export function createStockfishClient() {
  let worker = null
  let ready = false
  let requestId = 0
  const pending = new Map()
  const listeners = new Set()

  function emit(status) {
    listeners.forEach((listener) => listener(status))
  }

  function ensureWorker() {
    if (worker) return worker

    try {
      worker = new Worker(`${import.meta.env.BASE_URL}${ENGINE_FILE}`)
    } catch (error) {
      emit('Stockfish unavailable')
      throw error
    }

    worker.onmessage = (event) => {
      const text = String(event.data)
      if (text === 'uciok' || text === 'readyok') {
        ready = true
        emit('Stockfish ready')
      }

      if (text.startsWith('info ')) {
        const first = pending.values().next().value
        if (first?.kind === 'eval') first.score = parseScore(text)
        if (first?.kind === 'multi') {
          const candidate = parsePrincipalVariation(text)
          if (candidate) first.candidates.set(candidate.rank, candidate)
        }
      }

      if (text.startsWith('bestmove')) {
        const [, bestmove] = text.split(/\s+/)
        const first = pending.values().next().value
        if (first) {
          clearTimeout(first.timeout)
          pending.delete(first.id)
          if (first.kind === 'eval') {
            first.resolve(first.score)
          } else if (first.kind === 'multi') {
            const candidates = [...first.candidates.values()]
              .sort((a, b) => a.rank - b.rank)
            first.resolve(candidates.length ? candidates : [{ uci: bestmove, score: null, rank: 1 }])
          } else {
            first.resolve(bestmove)
          }
        }
      }
    }

    worker.onerror = () => {
      emit('Stockfish unavailable')
      pending.forEach((item) => item.resolve(null))
      pending.clear()
    }

    send('uci')
    send('setoption name UCI_LimitStrength value true')
    send('setoption name UCI_Elo value 2300')
    send('isready')
    return worker
  }

  function send(command) {
    ensureWorker()
    worker.postMessage(command)
  }

  async function bestMove(fen, { elo = 2300, depth = 8, moveTime = 550 } = {}) {
    ensureWorker()
    if (!ready) send('isready')
    send('setoption name UCI_LimitStrength value true')
    send('setoption name MultiPV value 1')
    send('setoption name UCI_Elo value ' + elo)
    send('position fen ' + fen)

    const id = requestId + 1
    requestId = id
    emit(`Stockfish depth ${depth}`)

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        pending.delete(id)
        resolve(null)
      }, Math.max(1600, moveTime + 900))
      pending.set(id, { id, kind: 'bestmove', resolve, timeout })
      send(`go depth ${depth} movetime ${moveTime}`)
    })
  }

  async function bestMoves(fen, { elo = 2300, depth = 8, moveTime = 550, count = 4 } = {}) {
    ensureWorker()
    if (!ready) send('isready')
    const candidateCount = Math.max(1, Math.min(6, count))
    send('setoption name UCI_LimitStrength value true')
    send('setoption name MultiPV value ' + candidateCount)
    send('setoption name UCI_Elo value ' + elo)
    send('position fen ' + fen)

    const id = requestId + 1
    requestId = id
    emit(`Stockfish depth ${depth}`)

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        pending.delete(id)
        resolve([])
      }, Math.max(1800, moveTime + 1100))
      pending.set(id, {
        id,
        kind: 'multi',
        resolve,
        timeout,
        candidates: new Map(),
      })
      send(`go depth ${depth} movetime ${moveTime}`)
    })
  }

  async function evaluateFen(fen, { depth = 8, moveTime = 450 } = {}) {
    ensureWorker()
    if (!ready) send('isready')
    send('setoption name UCI_LimitStrength value false')
    send('setoption name MultiPV value 1')
    send('position fen ' + fen)

    const id = requestId + 1
    requestId = id
    emit(`Stockfish review depth ${depth}`)

    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        pending.delete(id)
        resolve(null)
      }, Math.max(800, moveTime + 520))
      pending.set(id, { id, kind: 'eval', resolve, timeout, score: null })
      send(`go depth ${depth} movetime ${moveTime}`)
    })
  }

  return {
    bestMove,
    bestMoves,
    evaluateFen,
    onStatus(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function parseScore(text) {
  const scoreMatch = text.match(/\bscore\s+(cp|mate)\s+(-?\d+)/)
  if (!scoreMatch) return null
  const value = Number(scoreMatch[2])
  if (scoreMatch[1] === 'mate') return Math.sign(value || 1) * 100000
  return value
}

function parsePrincipalVariation(text) {
  const rank = Number(text.match(/\bmultipv\s+(\d+)/)?.[1] || 1)
  const score = parseScore(text)
  const uci = text.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)/)?.[1]
  if (!uci) return null
  return { uci, score, rank }
}
