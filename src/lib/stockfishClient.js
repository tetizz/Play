const ENGINE_FILE = 'stockfish/stockfish-18-lite-single.js'

export function createStockfishClient({
  workerFactory = (url) => new Worker(url),
  engineUrl = null,
  readyTimeoutMs = 1800,
  stopGraceMs = 500,
} = {}) {
  let worker = null
  let readyPromise = null
  let readyState = null
  let starting = null
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
    const baseUrl = import.meta.env?.BASE_URL || './'
    worker = workerFactory(engineUrl || `${baseUrl}${ENGINE_FILE}`)
    worker.onmessage = ({ data }) => handleMessage(String(data))
    worker.onerror = (error) => {
      rejectReady(error instanceof Error ? error : new Error('Stockfish worker failed'))
      emit('Stockfish unavailable')
      if (active) settleActive(emptyResult(active))
      while (queue.length) {
        const queued = queue.shift()
        queued.resolve(emptyResult(queued))
      }
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
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        readyState = null
        reject(new Error('Stockfish readiness timed out'))
      }, Math.max(100, readyTimeoutMs))
      readyState = {
        resolve: () => {
          clearTimeout(timeout)
          readyState = null
          resolve()
        },
        reject: (error) => {
          clearTimeout(timeout)
          readyState = null
          reject(error)
        },
      }
    })
  }

  function rejectReady(error) {
    readyState?.reject(error)
  }

  function handleMessage(text) {
    if (text === 'readyok') {
      readyState?.resolve()
      emit('Stockfish ready')
      return
    }
    if (text === 'uciok') return
    if (!active) return
    if (text.startsWith('info ')) {
      const line = parsePrincipalVariation(text)
      if (line) active.lines.set(line.rank, line)
      return
    }
    if (!text.startsWith('bestmove')) return
    const bestmove = text.split(/\s+/)[1]
    const lines = finalizeSearchLines(active, bestmove)
    settleActive(active.kind === 'best' ? lines[0]?.uci || null : lines)
  }

  function settleActive(value) {
    if (!active) return
    clearTimeout(active.timeout)
    clearTimeout(active.stopTimeout)
    const finished = active
    active = null
    finished.resolve(value)
    queueMicrotask(runNext)
  }

  function resetWorker() {
    rejectReady(new Error('Stockfish worker reset'))
    worker?.terminate()
    worker = null
    readyPromise = null
  }

  async function runNext() {
    if (starting || active || !queue.length) return
    const request = queue.shift()
    if (request.generation !== generation) {
      request.resolve(emptyResult(request))
      queueMicrotask(runNext)
      return
    }
    starting = request
    try {
      ensureWorker()
      await readyPromise
      if (starting !== request) return
      if (request.generation !== generation) {
        starting = null
        request.resolve(emptyResult(request))
        queueMicrotask(runNext)
        return
      }
      starting = null
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
        request.stopTimeout = setTimeout(() => {
          if (active !== request) return
          const lines = Number.isFinite(request.options.elo)
            ? []
            : [...request.lines.values()].sort((a, b) => a.rank - b.rank)
          resetWorker()
          settleActive(request.kind === 'best' ? lines[0]?.uci || null : lines)
        }, Math.max(50, stopGraceMs))
      }, request.options.timeout || Math.max(2200, (request.options.moveTime || 500) + 1500))
      const depth = Math.max(1, request.options.depth || 8)
      const moveTime = Math.max(40, request.options.moveTime || 500)
      const searchMoves = Array.isArray(request.options.searchMoves)
        ? request.options.searchMoves.filter((move) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))
        : []
      const searchClause = searchMoves.length ? ` searchmoves ${searchMoves.join(' ')}` : ''
      const limits = request.options.depthOnly
        ? `depth ${depth}`
        : `depth ${depth} movetime ${moveTime}`
      post(`go ${limits}${searchClause}`)
    } catch {
      if (starting !== request && active !== request) return
      if (starting === request) starting = null
      if (active === request) {
        clearTimeout(request.timeout)
        clearTimeout(request.stopTimeout)
        active = null
      }
      request.resolve(emptyResult(request))
      resetWorker()
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
        stopTimeout: null,
        resolve,
      })
      runNext()
    })
  }

  function cancelAll() {
    generation += 1
    while (queue.length) {
      const queued = queue.shift()
      queued.resolve(emptyResult(queued))
    }
    let resetRequired = false
    if (starting) {
      const cancelled = starting
      starting = null
      cancelled.resolve(emptyResult(cancelled))
      resetRequired = true
    }
    if (active) {
      const cancelled = active
      active = null
      clearTimeout(cancelled.timeout)
      clearTimeout(cancelled.stopTimeout)
      cancelled.resolve(emptyResult(cancelled))
      resetRequired = true
    }
    if (resetRequired) {
      resetWorker()
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
      resetWorker()
    },
    onStatus(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function emptyResult(request) {
  return request?.kind === 'best' ? null : []
}

function finalizeSearchLines(request, bestmove) {
  const lines = [...request.lines.values()].sort((a, b) => a.rank - b.rank)
  const hasBestmove = bestmove && bestmove !== '(none)'
  if (!hasBestmove) return lines

  if (!Number.isFinite(request.options.elo)) {
    if (!lines.length) {
      lines.push({ uci: bestmove, score: null, mate: null, rank: 1, pv: [bestmove] })
    }
    return lines
  }

  const selected = lines.find((line) => line.uci === bestmove) || {
    uci: bestmove,
    score: null,
    mate: null,
    rank: 1,
    pv: [bestmove],
  }
  return [
    selected,
    ...lines.filter((line) => line.uci !== bestmove),
  ].map((line, index) => ({ ...line, rank: index + 1 }))
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
