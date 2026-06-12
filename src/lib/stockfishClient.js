const ENGINE_FILE = 'stockfish/stockfish-18-lite-single.js'

export function createStockfishClient() {
  let worker = null
  let readyPromise = null
  let active = null
  let generation = 0
  let requestId = 0
  const queue = []
  const listeners = new Set()

  function emit(status) {
    listeners.forEach((listener) => listener(status))
  }

  function ensureWorker() {
    if (worker) return worker
    worker = new Worker(`${import.meta.env.BASE_URL}${ENGINE_FILE}`)
    worker.onmessage = ({ data }) => handleMessage(String(data))
    worker.onerror = () => {
      emit('Stockfish unavailable')
      settleActive(null)
      while (queue.length) queue.shift().resolve(null)
      worker?.terminate()
      worker = null
      readyPromise = null
    }
    readyPromise = waitForReady()
    worker.postMessage('uci')
    worker.postMessage('isready')
    return worker
  }

  function waitForReady() {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, 1800)
      const listener = (status) => {
        if (status !== 'Stockfish ready') return
        clearTimeout(timeout)
        listeners.delete(listener)
        resolve()
      }
      listeners.add(listener)
    })
  }

  function handleMessage(text) {
    if (text === 'uciok' || text === 'readyok') {
      emit('Stockfish ready')
      return
    }
    if (!active) return
    if (text.startsWith('info ')) {
      const line = parsePrincipalVariation(text)
      if (line) active.lines.set(line.rank, line)
      return
    }
    if (!text.startsWith('bestmove')) return
    const bestmove = text.split(/\s+/)[1]
    const lines = [...active.lines.values()].sort((a, b) => a.rank - b.rank)
    if (!lines.length && bestmove && bestmove !== '(none)') {
      lines.push({ uci: bestmove, score: null, mate: null, rank: 1, pv: [bestmove] })
    }
    settleActive(active.kind === 'best' ? lines[0]?.uci || null : lines)
  }

  function settleActive(value) {
    if (!active) return
    clearTimeout(active.timeout)
    const finished = active
    active = null
    finished.resolve(value)
    queueMicrotask(runNext)
  }

  async function runNext() {
    if (active || !queue.length) return
    const request = queue.shift()
    if (request.generation !== generation) {
      request.resolve(null)
      queueMicrotask(runNext)
      return
    }
    try {
      ensureWorker()
      await readyPromise
      if (request.generation !== generation) {
        request.resolve(null)
        queueMicrotask(runNext)
        return
      }
      active = request
      const candidateCount = Math.max(1, Math.min(16, request.options.count || 1))
      const limitStrength = Number.isFinite(request.options.elo)
      post(`setoption name UCI_LimitStrength value ${limitStrength ? 'true' : 'false'}`)
      if (limitStrength) post(`setoption name UCI_Elo value ${request.options.elo}`)
      post(`setoption name MultiPV value ${candidateCount}`)
      post(`position fen ${request.fen}`)
      emit(request.label)
      request.timeout = setTimeout(() => {
        post('stop')
        settleActive(request.kind === 'best' ? null : [])
      }, request.options.timeout || Math.max(2200, (request.options.moveTime || 500) + 1500))
      const depth = Math.max(1, request.options.depth || 8)
      const moveTime = Math.max(40, request.options.moveTime || 500)
      post(`go depth ${depth} movetime ${moveTime}`)
    } catch {
      request.resolve(null)
      active = null
      queueMicrotask(runNext)
    }
  }

  function post(command) {
    ensureWorker().postMessage(command)
  }

  function enqueue(kind, fen, options, label) {
    return new Promise((resolve) => {
      queue.push({
        id: ++requestId,
        generation,
        kind,
        fen,
        options,
        label,
        lines: new Map(),
        timeout: null,
        resolve,
      })
      runNext()
    })
  }

  function cancelAll() {
    generation += 1
    while (queue.length) queue.shift().resolve(null)
    if (active) {
      post('stop')
      settleActive(active.kind === 'best' ? null : [])
    }
  }

  return {
    bestMove(fen, options = {}) {
      return enqueue('best', fen, { ...options, count: 1 }, 'Stockfish ready')
    },
    bestMoves(fen, options = {}) {
      return enqueue('multi', fen, options, 'Stockfish ready')
    },
    analyze(fen, options = {}) {
      return enqueue('multi', fen, { count: 3, ...options, elo: undefined }, 'Review analysis')
    },
    async evaluateFen(fen, options = {}) {
      const lines = await enqueue(
        'multi',
        fen,
        { count: 1, ...options, elo: undefined },
        'Review analysis',
      )
      return Array.isArray(lines) ? lines[0]?.score ?? null : null
    },
    cancelAll,
    destroy() {
      cancelAll()
      worker?.terminate()
      worker = null
      readyPromise = null
    },
    onStatus(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
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
