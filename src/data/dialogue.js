import { DIALOGUE_CATALOG, getDialoguePack } from './dialogueCatalog.js'

export const IWANTCHECKMATE_LINES = Object.freeze(
  Object.fromEntries(
    Object.entries(DIALOGUE_CATALOG).filter(([profileId]) =>
      profileId.startsWith('iwc-') || profileId === 'geometricfish',
    ),
  ),
)

const shuffleBags = new Map()
const recentByProfile = new Map()
const battleTurns = new Map()

const MUBASSAR_BELT_ACTIVATION = Object.freeze([
  'You are going to get belt for playing this trash opening. Activating belt mode.',
  'You brought this opening to me? Activating belt mode.',
  'This setup is asking for belt. Belt mode is active.',
  'I recognize that setup. Go ahead and activate belt mode.',
  'You chose the belt opening on purpose. Belt mode is active.',
  'That fianchetto just rang the bell. Activating belt mode.',
  'I was going to be polite, then you played that. Belt mode.',
  'All right, you asked for the serious lesson. Activating belt mode.',
])

export function dialogueAfterBotMove(profile, context = {}) {
  return dialogueForMove(profile, context)
}

export function dialogueForBotBattle(profile, context = {}, opponentProfile = null) {
  if (!canSpeak(profile)) return ''

  const special = specialMoveDialogue(profile, context)
  if (special) return special

  const resolvedEvent = moveEvent(context)
  const currentTurn = (battleTurns.get(profile.id) || 0) + 1
  battleTurns.set(profile.id, currentTurn)
  const event = (
    ['opening', 'quiet', 'winning', 'losing'].includes(resolvedEvent) &&
    currentTurn % 3 === 0
  )
    ? 'battle'
    : resolvedEvent

  const opponentName = opponentProfile?.name || 'opponent'
  return addressOpponent(
    chooseProfileLine(profile, event, opponentProfile),
    opponentName,
  )
}

export function initialDialogue(profile) {
  if (!canSpeak(profile)) return ''
  if (profile.id === 'mubassar') return 'Prepare for belt.'
  const introduction = chooseProfileLine(profile, 'intro')
  if (profile.capabilities?.videoVariant && profile.intro) {
    return `${profile.intro} ${introduction}`
  }
  return introduction
}

export function dialogueForGameEnd(profile, result = '') {
  if (!canSpeak(profile)) return ''

  const normalized = String(result).toLowerCase()
  if (normalized.includes('draw') || normalized.includes('stalemate')) {
    return chooseProfileLine(profile, 'gameDraw')
  }
  if (normalized.includes('player wins')) {
    return chooseProfileLine(profile, 'gameLoss')
  }
  return chooseProfileLine(profile, 'gameWin')
}

export function resetDialogueHistory(profileId = null) {
  if (!profileId) {
    shuffleBags.clear()
    recentByProfile.clear()
    battleTurns.clear()
    return
  }

  const prefix = `${profileId}:`
  for (const key of shuffleBags.keys()) {
    if (key.startsWith(prefix)) shuffleBags.delete(key)
  }
  recentByProfile.delete(profileId)
  battleTurns.delete(profileId)
}

function dialogueForMove(profile, context) {
  if (!canSpeak(profile)) return ''
  if (profile.id === 'trixize' && context.isQueenTradeRecapture) return ''
  const special = specialMoveDialogue(profile, context)
  return special || chooseProfileLine(profile, moveEvent(context))
}

function specialMoveDialogue(profile, context) {
  if (profile.id === 'trixize') {
    if (context.isBishopKnightObjective) {
      return "I'm going to checkmate you with a bishop and knight."
    }
    if (context.opponentHungQueen) return 'Where did your queen go?'
    if (context.isBrilliant) return 'Rahh!'
    if (!context.isQueenTradeRecapture && (context.isFreePiece || context.opponentBlunder)) {
      return 'Oops.'
    }
    if (context.isTrixizeFirstMove) return '1. Nf3 is the starting move.'
    if (context.isTheoryBest) return 'Best move. Too much theory.'
    if (context.isQueenTradeRecapture) return ''
  }

  if (profile.id === 'akshit' && context.move?.piece === 'n') {
    return 'I am the knight manuveur.'
  }

  if (profile.id === 'witty-alien') {
    if (context.isBrilliant) return 'BRILLIANT!!'
    if (context.isOpeningMove) return 'I am the destroyer of the Caro-Kann.'
  }

  if (profile.id === 'mubassar' && context.isOpeningMove) {
    return 'Prepare for belt.'
  }

  if (profile.id === 'mubassar' && context.beltActivated) {
    return chooseLine(profile.id, 'beltActivation', MUBASSAR_BELT_ACTIVATION)
  }

  if (profile.id === 'iwc-zero-evaluation' && context.isWinning) {
    return 'This is far too exciting. I ordered 0.00 equality.'
  }

  if (profile.capabilities?.videoVariant && context.variantEloDelta) {
    const delta = Math.abs(Math.round(context.variantEloDelta))
    const elo = Math.round(context.variantElo || profile.variant?.initialElo || 250)
    return context.variantEloDelta > 0
      ? `Plus ${delta} Elo. I am at ${elo} now.`
      : `There goes ${delta} Elo. I am down to ${elo}.`
  }

  return ''
}

function moveEvent(context) {
  if (context.isCheckmate) return 'checkmate'
  if (context.isBrilliant) return 'brilliant'
  if (context.opponentHungQueen || context.isFreePiece || context.opponentBlunder) {
    return 'freePiece'
  }
  if (context.isCheck) return 'check'
  if (context.isGreatMove) return 'great'
  if (context.isLosing) return 'losing'
  if (context.isWinning) return 'winning'
  if (context.capturedValue > 0) return 'capture'
  if (context.phase === 'opening' || context.isOpeningMove) return 'opening'
  return 'quiet'
}

function chooseProfileLine(profile, event, opponentProfile = null) {
  const pack = getDialoguePack(profile.id) || getDialoguePack(profile.dialoguePolicy)
  if (!pack) return ''

  const lines = pack[event]?.length ? pack[event] : pack.quiet
  const line = chooseLine(profile.id, event, lines)
  return line.replaceAll('{opponent}', opponentProfile?.name || 'opponent')
}

function chooseLine(profileId, event, lines) {
  if (!Array.isArray(lines) || !lines.length) return ''

  const key = `${profileId}:${event}`
  const signature = lines.join('\u0000')
  let state = shuffleBags.get(key)
  if (!state || state.signature !== signature || !state.remaining.length) {
    const remaining = shuffle(lines)
    const previous = recentByProfile.get(profileId)
    if (remaining.length > 1 && remaining.at(-1) === previous) {
      ;[remaining[0], remaining[remaining.length - 1]] = [
        remaining[remaining.length - 1],
        remaining[0],
      ]
    }
    state = { signature, remaining }
    shuffleBags.set(key, state)
  }

  const selected = state.remaining.pop()
  recentByProfile.set(profileId, selected)
  return selected
}

function shuffle(lines) {
  const result = [...lines]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function canSpeak(profile) {
  return Boolean(profile && profile.dialoguePolicy !== 'silent')
}

function addressOpponent(line, opponentName) {
  if (!line || !opponentName || line.includes(opponentName)) return line
  return `${opponentName}, ${line}`
}
