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

      if (text.startsWith('bestmove')) {
        const [, bestmove] = text.split(/\s+/)
        const first = pending.values().next().value
        if (first) {
          clearTimeout(first.timeout)
          pending.delete(first.id)
          first.resolve(bestmove)
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
      pending.set(id, { id, resolve, timeout })
      send(`go depth ${depth} movetime ${moveTime}`)
    })
  }

  return {
    bestMove,
    onStatus(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
