const MUBASSAR_LINES = {
  opening: [
    'Prepare for belt.',
    'Alright. Let’s see what you prepared.',
    'We are starting serious today.',
    'Show me what you know.',
  ],
  beltActivation: [
    'You are going to get belt for playing this trash opening. Activating belt mode.',
    'You brought this opening to me? Activating belt mode.',
    'This setup is asking for belt. Belt mode is active.',
  ],
  belt: [
    'This is what I call belt.',
    'Belt mode does not come with mercy.',
    'You chose this opening. Now you have to survive it.',
    'We are not escaping belt mode that easily.',
    'That position is getting uncomfortable fast.',
  ],
  freePiece: [
    'Gimme that. I love free pieces.',
    'That was free. I am taking it.',
    'You left that hanging for me?',
    'Thank you. I will keep that piece.',
  ],
  capture: [
    'Gimme that.',
    'I will take that trade.',
    'That piece was doing too much anyway.',
    'Material first. Questions later.',
  ],
  check: [
    'Move the king. I am not done.',
    'Check. Now the position gets annoying.',
    'Your king needs some attention.',
    'That king is starting to feel the pressure.',
  ],
  mate: [
    'That is game. Belt delivered.',
    'Checkmate. You can review where it went wrong.',
    'The king has nowhere left to go.',
  ],
  winning: [
    'This is what I call belt.',
    'You are going to need a serious comeback now.',
    'The position is doing the talking for me.',
    'I like my side of this one.',
  ],
  great: [
    'What are you going to do after that?',
    'That is the kind of move you have to respect.',
    'We larping high elo with this move.',
    'Now solve the next problem.',
  ],
  quiet: [
    'Improve the position and keep the pressure.',
    'No rush. Your position can get worse by itself.',
    'I know what I want here.',
    'Let’s make your next move uncomfortable.',
    'The pieces are starting to work together.',
    'I am keeping the position practical.',
  ],
}

const AYDEN_LINES = {
  majorCapture: [
    'That piece was loose.',
    'I am taking the material.',
    'That trade works for me.',
  ],
  check: [
    'Check. Find the clean response.',
    'Your king has to answer this.',
  ],
  punish: [
    'That gave me too much.',
    'I do not think that move holds together.',
  ],
  mate: [
    'Checkmate.',
    'That finishes the game.',
  ],
}

export function dialogueAfterBotMove(profile, context) {
  if (profile.dialoguePolicy === 'trixize') {
    if (context.isBrilliant) return 'Rahh!'
    if (context.isFreePiece || context.opponentBlunder) return 'Oops.'
    if (context.isTrixizeFirstMove) return '1. Nf3 is the starting move.'
    if (context.isTheoryBest) return 'Best move. Too much theory.'
    return ''
  }

  if (profile.dialoguePolicy === 'akshit') {
    return context.move?.piece === 'n' ? 'I am the knight manuveur.' : ''
  }

  if (profile.dialoguePolicy === 'ayden') {
    if (context.isCheckmate) return pick(AYDEN_LINES.mate)
    if (context.isCheck) return pick(AYDEN_LINES.check)
    if (context.isFreePiece || context.opponentBlunder) return pick(AYDEN_LINES.punish)
    if (context.capturedValue >= 300) return pick(AYDEN_LINES.majorCapture)
    return ''
  }

  if (context.beltActivated) return pick(MUBASSAR_LINES.beltActivation)
  if (context.isCheckmate) return pick(MUBASSAR_LINES.mate)
  if (context.isFreePiece) return pick(MUBASSAR_LINES.freePiece)
  if (context.isCheck) return pick(MUBASSAR_LINES.check)
  if (context.isOpeningMove) return pick(MUBASSAR_LINES.opening)
  if (context.beltMode) return pick(MUBASSAR_LINES.belt)
  if (context.isWinning) return pick(MUBASSAR_LINES.winning)
  if (context.isGreatMove || context.opponentBlunder) return pick(MUBASSAR_LINES.great)
  if (context.capturedValue > 0) return pick(MUBASSAR_LINES.capture)
  return pick(MUBASSAR_LINES.quiet)
}

export function initialDialogue(profile) {
  if (profile.id === 'mubassar') return 'Prepare for belt.'
  return ''
}

export function dialogueForGameEnd(profile, result) {
  if (profile.dialoguePolicy === 'trixize') return result.includes('checkmate') ? 'Good game.' : ''
  if (profile.dialoguePolicy === 'akshit') return ''
  if (profile.dialoguePolicy === 'ayden') return result.includes('checkmate') ? 'Checkmate.' : 'Good game.'
  if (result.toLowerCase().includes('player wins')) return 'Alright, you earned that one.'
  if (result.toLowerCase().includes('draw')) return 'A draw is fine. The review will show the chances.'
  return 'That is game. Open the review and find the turning point.'
}

function pick(lines) {
  return lines[Math.floor(Math.random() * lines.length)]
}
