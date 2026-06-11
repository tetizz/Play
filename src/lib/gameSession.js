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

export function loadSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (!parsed || !Array.isArray(parsed.history)) return null
    const game = gameFromHistory(parsed.history)
    return {
      botId: parsed.botId,
      colorChoice: parsed.colorChoice,
      humanColor: parsed.humanColor,
      history: game.history(),
      phase: parsed.phase === 'review' && !game.isGameOver() ? 'game' : parsed.phase,
      beltMode: Boolean(parsed.beltMode),
      lastMove: parsed.lastMove || null,
    }
  } catch {
    return null
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function shouldResumeBotTurn(history, humanColor) {
  const game = gameFromHistory(history)
  if (game.isGameOver()) return false
  const playerTurn = humanColor === 'white' ? 'w' : 'b'
  return game.turn() !== playerTurn
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
