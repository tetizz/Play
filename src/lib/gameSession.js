import { Chess } from 'chess.js'

export const SESSION_KEY = 'play-bots-session-v3'

export function gameFromHistory(history = []) {
  const game = new Chess()
  for (const san of history) {
    try {
      if (!game.move(san)) break
    } catch {
      break
    }
  }
  return game
}

export function isAutomaticGameOver(game) {
  return game.isCheckmate() ||
    game.isStalemate() ||
    game.isInsufficientMaterial() ||
    halfmoveClock(game) >= 150 ||
    currentPositionOccurrences(game) >= 5
}

export function isAutomaticDraw(game) {
  return !game.isCheckmate() && isAutomaticGameOver(game)
}

export function loadSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (!parsed || !Array.isArray(parsed.history)) return null
    const game = gameFromHistory(parsed.history)
    return {
      botId: parsed.botId,
      gameMode: parsed.gameMode === 'bots' ? 'bots' : 'player',
      whiteBotId: parsed.whiteBotId || 'trixize',
      blackBotId: parsed.blackBotId || 'akshit',
      colorChoice: parsed.colorChoice,
      humanColor: parsed.humanColor,
      history: game.history(),
      phase: parsed.phase === 'review' &&
        !isAutomaticGameOver(game) &&
        !parsed.reviewResult
        ? 'game'
        : parsed.phase,
      beltMode: Boolean(parsed.beltMode),
      lastMove: parsed.lastMove || null,
      premoveQueue: Array.isArray(parsed.premoveQueue) ? parsed.premoveQueue : [],
      dialogueLog: Array.isArray(parsed.dialogueLog) ? parsed.dialogueLog.slice(-8) : [],
      reviewResult: typeof parsed.reviewResult === 'string' ? parsed.reviewResult : null,
    }
  } catch {
    return null
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return true
  } catch {
    return false
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
    return true
  } catch {
    return false
  }
}

export function shouldResumeBotTurn(history, humanColor) {
  const game = gameFromHistory(history)
  if (isAutomaticGameOver(game)) return false
  const playerTurn = humanColor === 'white' ? 'w' : 'b'
  return game.turn() !== playerTurn
}

function currentPositionOccurrences(game) {
  const current = positionKey(game.fen())
  let occurrences = current === positionKey(new Chess().fen()) ? 1 : 0
  for (const move of game.history({ verbose: true })) {
    if (positionKey(move.after) === current) occurrences += 1
  }
  return occurrences
}

function positionKey(fen) {
  return String(fen || '').split(' ').slice(0, 4).join(' ')
}

function halfmoveClock(game) {
  return Number(game.fen().split(' ')[4]) || 0
}

export function applyPremove(history, premove) {
  const game = gameFromHistory(history)
  if (!premove) return { applied: false, history: game.history(), move: null }
  let move
  try {
    move = game.move({
      from: premove.from,
      to: premove.to,
      promotion: premove.promotion || 'q',
    })
  } catch {
    return { applied: false, history: game.history(), move: null }
  }
  return {
    applied: Boolean(move),
    history: game.history(),
    move,
  }
}

export function applyNextPremove(history, queue = []) {
  if (!queue.length) {
    return {
      applied: false,
      history: gameFromHistory(history).history(),
      move: null,
      remaining: [],
    }
  }
  const [premove, ...remaining] = queue
  const result = applyPremove(history, premove)
  return {
    ...result,
    remaining: result.applied ? remaining : [],
  }
}
