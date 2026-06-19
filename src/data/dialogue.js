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

const AKSHIT_LINES = {
  quiet: [
    'Okay',
    'Lil kids play this',
  ],
  tactical: [
    'rahhhhhh',
    'Easy belt',
  ],
  winning: [
    'Easy belt',
    "Don't cry after losing",
    'Go home',
    'Quit the game',
    'Chess is not for you',
  ],
  mate: [
    'Easy belt',
    'Go home',
    'Quit the game',
    'Chess is not for you',
  ],
}

const TRIXIZE_LINES = {
  check: [
    'Move the king.',
    'Your king is getting dragged into this.',
    'That check is the start of the problem.',
    'You have to answer me now.',
  ],
  mate: [
    'That is mate.',
    'Game over.',
    'No squares left.',
    'That king had nowhere to run.',
  ],
  winning: [
    'This is already slipping away from you.',
    'I am not letting this advantage go.',
    'You are running out of useful moves.',
    'This position is getting cooked.',
    'I like this. Your pieces are tied up.',
  ],
  great: [
    'That is the clean way to do it.',
    'You had to see that one coming.',
    'That move hits too many things.',
    'This is why the position works.',
  ],
  capture: [
    'I will take that.',
    'That piece was loose.',
    'Free material is still material.',
    'You gave me a target.',
  ],
  quiet: [
    'Small move, big problem.',
    'I am improving first.',
    'You still have to prove this setup works.',
    'Everything is defended for a reason.',
    'I am keeping the pressure.',
    'This is still theory to me.',
    'The position is doing exactly what I want.',
    'Find the only move.',
  ],
}

export function dialogueAfterBotMove(profile, context) {
  if (profile.dialoguePolicy === 'trixize') {
    if (context.isBishopKnightObjective) return "I'm going to checkmate you with a bishop and knight."
    if (context.opponentHungQueen) return 'Where did your queen go?'
    if (context.isBrilliant) return 'Rahh!'
    if (!context.isQueenTradeRecapture && (context.isFreePiece || context.opponentBlunder)) return 'Oops.'
    if (context.isTrixizeFirstMove) return '1. Nf3 is the starting move.'
    if (context.isTheoryBest) return 'Best move. Too much theory.'
    if (context.isQueenTradeRecapture) return ''
    if (context.isCheckmate) return pick(TRIXIZE_LINES.mate)
    if (context.isCheck) return pick(TRIXIZE_LINES.check)
    if (context.isWinning) return pick(TRIXIZE_LINES.winning)
    if (context.isGreatMove) return pick(TRIXIZE_LINES.great)
    if (context.capturedValue > 0) return pick(TRIXIZE_LINES.capture)
    return pick(TRIXIZE_LINES.quiet)
  }

  if (profile.dialoguePolicy === 'akshit') {
    if (context.isCheckmate) return pick(AKSHIT_LINES.mate)
    if (context.isFreePiece || context.opponentBlunder || context.isBrilliant) {
      return pick(AKSHIT_LINES.tactical)
    }
    if (context.isWinning) return pick(AKSHIT_LINES.winning)
    if (context.isCheck || context.isGreatMove) return pick(AKSHIT_LINES.tactical)
    if (context.move?.piece === 'n') return 'I am the knight manuveur.'
    return pick(AKSHIT_LINES.quiet)
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
  if (profile.dialoguePolicy === 'akshit') {
    return result.toLowerCase().includes('player wins') ? 'Okay' : pick(AKSHIT_LINES.mate)
  }
  if (profile.dialoguePolicy === 'ayden') return result.includes('checkmate') ? 'Checkmate.' : 'Good game.'
  if (result.toLowerCase().includes('player wins')) return 'Alright, you earned that one.'
  if (result.toLowerCase().includes('draw')) return 'A draw is fine. The review will show the chances.'
  return 'That is game. Open the review and find the turning point.'
}

function pick(lines) {
  return lines[Math.floor(Math.random() * lines.length)]
}
