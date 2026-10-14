export class CandidateAnalysisError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'CandidateAnalysisError'
    this.code = code
  }
}

export function assertCandidateOperation(operation = {}) {
  if (operation.signal?.aborted || operation.isCancelled?.()) {
    throw new CandidateAnalysisError('cancelled', 'Candidate analysis was cancelled')
  }
  if (Number.isFinite(operation.deadlineMs) && (operation.now || Date.now)() >= operation.deadlineMs) {
    throw new CandidateAnalysisError('deadline', 'Candidate analysis reached its deadline')
  }
}

function operationFor(policy, options) {
  const now = options.now || Date.now
  // One cold-worker allowance plus the requested work allowance, shared by
  // all chunks/retries; never grant another startup budget per engine call.
  const requested = options.timeoutMs ?? 15000 + Math.max(2200, policy.timeout || 0)
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new CandidateAnalysisError('invalid', 'Candidate analysis requires a finite positive budget')
  }
  const deadlineMs = options.deadlineMs ?? now() + Math.min(30000, requested)
  if (!Number.isFinite(deadlineMs)) throw new CandidateAnalysisError('invalid', 'Candidate analysis requires a finite deadline')
  return { ...options, now, deadlineMs }
}

function runRequest(client, fen, policy, operation, method = 'bestMoves') {
  assertCandidateOperation(operation)
  const remaining = operation.deadlineMs - operation.now()
  return new Promise((resolve, reject) => {
    let settled = false
    let poll
    const settle = (error, value, stop = false) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearInterval(poll)
      operation.signal?.removeEventListener('abort', onAbort)
      if (stop) client.cancelAll?.()
      if (error) reject(error)
      else resolve(value)
    }
    const onAbort = () => settle(new CandidateAnalysisError('cancelled', 'Candidate analysis was cancelled'), null, true)
    const timer = setTimeout(() => settle(new CandidateAnalysisError('deadline', 'Candidate analysis reached its deadline'), null, true), remaining)
    operation.signal?.addEventListener('abort', onAbort, { once: true })
    if (operation.isCancelled) poll = setInterval(() => {
      try { assertCandidateOperation(operation) } catch (error) { settle(error, null, true) }
    }, 25)
    const normalTimeout = policy.timeout || Math.max(2200, (policy.moveTime || 500) + 1500)
    Promise.resolve().then(() => {
      assertCandidateOperation(operation)
      return client[method](fen, { ...policy, timeout: Math.max(1, Math.min(normalTimeout, remaining)) })
    }).then(value => {
      try { assertCandidateOperation(operation); settle(null, value) }
      catch (error) { settle(error, null, true) }
    }, error => settle(error))
  })
}

async function exhaustive(client, game, policy, operation) {
  const fen = game.fen()
  const legal = game.moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion || ''}`)
  if (!legal.length) return []
  const chunks = []
  for (let index = 0; index < legal.length; index += 16) chunks.push(legal.slice(index, index + 16))
  const moveTime = Math.max(100, Math.floor(Number(policy.moveTime || 500) / chunks.length))
  const results = []
  for (const searchMoves of chunks) {
    assertCandidateOperation(operation)
    const lines = await runRequest(client, fen, { ...policy, elo: undefined,
      depth: Math.min(15, Math.max(10, Number(policy.depth || 12))),
      moveTime, count: searchMoves.length, searchMoves,
      timeout: Math.max(2200, moveTime + 1500) }, operation)
    const byMove = new Map((lines || []).filter(line => searchMoves.includes(line?.uci) && Number.isFinite(line.score)).map(line => [line.uci, line]))
    if (byMove.size !== searchMoves.length) {
      throw new CandidateAnalysisError('incomplete', 'Stockfish did not evaluate every requested legal move')
    }
    // Preserve normal engine order and stable score ties, without duplicates.
    const seen = new Set()
    for (const line of lines) {
      if (byMove.get(line.uci) === line && !seen.has(line.uci)) {
        results.push(line)
        seen.add(line.uci)
      }
    }
  }
  assertCandidateOperation(operation)
  return results.sort((a, b) => b.score - a.score).map((line, index) => ({ ...line, rank: index + 1 }))
}

export function analyzeEveryLegalMove(client, game, policy, options = {}) {
  return exhaustive(client, game, policy, operationFor(policy, options))
}

export async function analyzeCandidatesWithRetry(primaryClient, retryClient, game, policy, allLegalMoves, options = {}) {
  const operation = operationFor(policy, options)
  const clients = [primaryClient, retryClient].filter(Boolean)
  let lastError = null
  for (let index = 0; index < clients.length; index++) {
    assertCandidateOperation(operation)
    const attemptPolicy = index === 0 ? policy : { ...policy,
      depth: Math.max(10, Math.min(16, Number(policy.depth || 12))),
      moveTime: Math.max(350, Number(policy.moveTime || 500)),
      timeout: Math.max(3000, Number(policy.timeout || 0)) }
    try {
      const candidates = allLegalMoves
        ? await exhaustive(clients[index], game, attemptPolicy, operation)
        : await runRequest(clients[index], game.fen(), attemptPolicy, operation)
      assertCandidateOperation(operation)
      if (candidates?.length) return candidates
      lastError = new Error('Stockfish returned no candidate moves')
    } catch (error) {
      if (error instanceof CandidateAnalysisError && ['cancelled', 'deadline', 'invalid'].includes(error.code)) throw error
      lastError = error
    }
  }
  throw lastError || new Error('No Stockfish client is available')
}

export function requestCandidateMoves(client, fen, policy, options = {}) {
  return runRequest(client, fen, policy, operationFor(policy, options))
}

export function requestCandidateScore(client, fen, policy, options = {}) {
  return runRequest(client, fen, policy, operationFor(policy, options), 'evaluateFen')
}
