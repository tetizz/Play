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
    'I guess I could teach you some theory if you need it, I guess.',
    'The position is doing exactly what I want.',
    'Find the only move.',
  ],
}

const BOT_BATTLE_FALLBACK_LINES = {
  mubassar: [
    'You have to prove this position works.',
    'I am keeping it practical.',
    'One loose move and this turns fast.',
    'The pressure is building.',
  ],
  ayden: [
    'I am keeping the structure clean.',
    'No need to force it yet.',
    'This is still playable.',
    'I like the setup.',
    'I will take the small improvement.',
  ],
  akshit: [
    'Okay',
    'Lil kids play this',
    'Do not cry after losing',
    'Chess is not for you',
  ],
  trixize: [
    'I guess I could teach you some theory if you need it, I guess.',
    'This is still theory to me.',
    'Everything is defended for a reason.',
    'Find the only move.',
  ],
}

export const IWANTCHECKMATE_LINES = {
  'iwc-worst-move': {
    intro: 'Find the worst move on the board and 500 Elo falls out of my pocket.',
    elo: [
      'That move was hideous. There goes {delta} Elo.',
      'You found the basement. I just dropped {delta} Elo down the stairs.',
    ],
    check: ['A check? Cute. I am waiting for something truly dreadful.'],
    capture: ['Free piece spotted. The pity department is closed.'],
    winning: ['I keep losing rating and somehow you are losing the game.'],
    quiet: ['Not ugly enough. My rating survives at {elo}.'],
    battle: [
      '{opponent}, show me the move your chess teacher warned you about.',
      'I brought a shovel, {opponent}. Let us find the bottom together.',
    ],
    mate: ['I lost Elo, not my ability to finish this.'],
    end: ['Challenge over. Somebody help me look for my rating.'],
  },
  'iwc-give-check': {
    intro: 'Every time you check me, 300 Elo runs away screaming.',
    elo: [
      'Check? My rating just fell through the floor by {delta}.',
      'The king heard check. My brain misplaced {delta} Elo.',
    ],
    check: ['I can give checks. Receiving them is a personal crisis.'],
    capture: ['Panic later. Snack now.'],
    winning: ['I am winning, but one check could make this very silly.'],
    quiet: ['No check? Wonderful. I remain vaguely qualified.'],
    battle: [
      '{opponent}, please keep your checks in their original packaging.',
      'A quiet move! Thank you for the vacation, {opponent}.',
    ],
    mate: ['Panic complete. Checkmate delivered.'],
    end: ['I survived the checks. My rating would like a blanket.'],
  },
  'iwc-best-move': {
    intro: 'Every best move you find steals 100 Elo from me. Please be inaccurate.',
    elo: [
      'Best move. Rude. I am {delta} Elo lighter now.',
      'Too precise. Hand over another {delta} Elo.',
    ],
    check: ['A check too? You are taking this personally.'],
    capture: ['Your piece wandered into my lunch break.'],
    winning: ['You keep finding good moves and I keep winning anyway. Awkward.'],
    quiet: ['Was that really your best? My rating hopes not.'],
    battle: [
      '{opponent}, second-best has charm. Please consider it.',
      'Your good decisions are expensive, {opponent}.',
    ],
    mate: ['That was the best ending for me.'],
    end: ['Good game. My missing Elo will be sending you an invoice.'],
  },
  'iwc-smartin': {
    intro: 'I start at 250 and gain 100 Elo every move. Please stall responsibly.',
    elo: [
      'Another move, another {delta} Elo. I have {elo} thoughts now.',
      'I felt my brain grow. {elo} and climbing.',
    ],
    check: ['Check. I learned that a few moves ago.'],
    capture: ['At {elo}, I have discovered free pieces.'],
    winning: ['This was much harder back when I had 250 Elo.'],
    quiet: ['Give me a few more moves. I am still installing chess.'],
    battle: [
      '{opponent}, keep stalling. I become alarmingly competent eventually.',
      'I have {elo} Elo and several fresh thoughts, {opponent}.',
    ],
    mate: ['I learned checkmate just in time. Convenient.'],
    end: ['Look how much I learned. I deserve a tiny diploma.'],
  },
  'iwc-elo-decay': {
    intro: 'I start at 3600 and lose 50 Elo every move. Please admire me quickly.',
    elo: [
      'Minus {delta}. I understood chess a second ago.',
      'Another {delta} Elo gone. Existing is exhausting.',
    ],
    check: ['Check. I still remember that much.'],
    capture: ['I may be tired, but your piece was sleeping harder.'],
    winning: ['Please resign before I forget why I am winning.'],
    quiet: ['At {elo}, the horses are starting to look suspicious.'],
    battle: [
      '{opponent}, hurry. My chess knowledge is leaving without me.',
      'I had a beautiful idea five moves ago. It is gone now, {opponent}.',
    ],
    mate: ['Finally. I can sleep now.'],
    end: ['Game over. Wake me up when my Elo comes back.'],
  },
  'iwc-random-blunder': {
    intro: 'Ninety-five percent genius. Five percent shopping cart with one bad wheel.',
    check: ['That check came from my responsible ninety-five percent.'],
    capture: ['The piece was free. Even my bad five percent saw it.'],
    winning: ['The five percent has not shown up yet.'],
    quiet: ['Was that genius or chaos? You will find out soon.'],
    battle: [
      '{opponent}, I consulted my brain and one extremely bad impulse.',
      'Ninety-five percent calculation. Five percent banana peel.',
    ],
    mate: ['No blunder this time. Checkmate.'],
    end: ['The five percent did not save you.'],
  },
  'iwc-random-top-three': {
    intro: 'I roll a die between my top three moves. Surely nothing odd will happen.',
    check: ['The dice landed on check.'],
    capture: ['The dice said take it.'],
    winning: ['All three choices look unpleasant for you.'],
    quiet: ['One, two, or three. I am not telling you which one won.'],
    battle: [
      'I had three doors, {opponent}. I kicked one open.',
      'My move selection has the confidence of a dice roll.',
    ],
    mate: ['The dice have spoken. Checkmate.'],
    end: ['Random choice, very real result.'],
  },
  'iwc-zero-evaluation': {
    intro: 'I only want 0.00. I have already filled out the draw paperwork.',
    check: ['That check was meant to make things peaceful. Somehow.'],
    capture: ['Peace is easier when I am holding your pieces.'],
    winning: ['This is far too exciting. I ordered complete equality.'],
    quiet: ['I offer draw. Again.'],
    battle: [
      '{opponent}, could we return this game to a polite 0.00?',
      'I ordered a draw and received whatever this is, {opponent}.',
    ],
    mate: ['That is extremely far from 0.00.'],
    end: ['I asked for a draw. Nobody listens to the fish.'],
  },
  'iwc-second-best': {
    intro: 'First place is overrated. I always play the second-best move.',
    check: ['Imagine what the best move would have done.'],
    capture: ['Second best, first to your loose piece.'],
    winning: ['My runner-up moves are still winning.'],
    quiet: ['The best move was available. I chose character instead.'],
    battle: [
      'Congratulations, {opponent}. You are fighting the silver medalist.',
      'First choice is predictable. Second choice has seasoning.',
    ],
    mate: ['Second-best moves, first-place finish.'],
    end: ['Silver medal move selection, gold medal result.'],
  },
  'iwc-hungry-martin': {
    intro: 'I start at 250, but every capture or check feeds me 1000 Elo. Delicious.',
    elo: [
      'That tasted like {delta} Elo. I am at {elo} now.',
      'Capture, check, rating snack. Plus {delta}.',
    ],
    check: ['Check. That one made me much smarter.'],
    capture: ['Delicious. And somehow educational.'],
    quiet: ['No capture? No check? I am still hungry.'],
    battle: [
      '{opponent}, bring a piece closer. I need a rating snack.',
      'My stomach says check. My rating says capture. My brain says soon.',
    ],
    mate: ['Checkmate is the biggest rating snack.'],
    end: ['That game was filling.'],
  },
  'iwc-worstfish': {
    intro: 'I inspect every legal move and proudly choose the absolute worst.',
    check: ['If this is check, imagine how bad the other moves were.'],
    capture: ['Taking that was somehow the worst idea available.'],
    winning: ['I am winning despite my best efforts.'],
    quiet: ['I found the bottom of the move list and kept digging.'],
    battle: [
      '{opponent}, I found a move that should have remained undiscovered.',
      'My last move has been asked to leave the chess club.',
    ],
    mate: ['You lost to the worst move. That is impressive.'],
    end: ['The worst move won. Chess is strange.'],
  },
  'iwc-martinfish': {
    intro: 'One genius move, one Martin move. The steering wheel is shared.',
    check: ['The clever half found check. Martin is taking credit.'],
    capture: ['One side of my brain saw that piece.'],
    winning: ['The clever half is carrying. Martin is enjoying the view.'],
    quiet: ['Half calculation, half adventure.'],
    battle: [
      '{opponent}, one of my two brains knows what is happening.',
      'The genius has the wheel. Martin has the map upside down.',
    ],
    mate: ['The clever half set it up. Martin definitely meant it.'],
    end: ['Two brains entered. Somehow one victory left.'],
  },
  'iwc-martinfish-2': {
    intro: 'Two genius moves, then one Martin move. Slightly less chaos.',
    check: ['Two parts calculation, one part surprise.'],
    capture: ['That looked like one of the sensible turns.'],
    winning: ['Martin gets one move soon. Do not relax.'],
    quiet: ['The third move is where the plot changes.'],
    battle: [
      '{opponent}, I am competent in groups of two.',
      'Two sensible moves paid for the next Martin move.',
    ],
    mate: ['The ratio worked. Checkmate.'],
    end: ['Two good ideas were enough to cover one Martin idea.'],
  },
  'iwc-martinfish-3': {
    intro: 'Three genius moves, then Martin gets the controls.',
    check: ['Three moves of preparation for one move of mystery.'],
    capture: ['The clever half built it. Martin found the capture button.'],
    winning: ['The three-to-one ratio is doing its job.'],
    quiet: ['Martin’s turn is always closer than it looks.'],
    battle: [
      '{opponent}, the genius gets three sentences and Martin gets the punchline.',
      'Three precise moves. Then we release the Martin.',
    ],
    mate: ['Three parts genius, one part Martin, one checkmate.'],
    end: ['The genius-to-Martin ratio survived.'],
  },
  'iwc-random-martinfish': {
    intro: 'Ninety percent genius, ten percent Martin. Guess who moved.',
    check: ['Probably the genius. Probably.'],
    capture: ['That looked suspiciously competent.'],
    winning: ['The ten percent has not ruined it yet.'],
    quiet: ['Was that the ninety or the ten?'],
    battle: [
      '{opponent}, you are one random number away from a completely different game.',
      'The genius is driving, but Martin keeps touching the radio.',
    ],
    mate: ['The ninety percent closed the game.'],
    end: ['The random switch stayed mostly cooperative.'],
  },
  'iwc-evil-martin': {
    intro: 'I am only Martin while the position is safe. Do not wake me up.',
    awake: [
      'You made me start losing. Evil Martin is awake at {elo}.',
      'Nap over. The 3000 Elo version is taking this personally.',
    ],
    sleepy: ['Still safe. Still sleepy. Still Martin.'],
    check: ['Check. I may be more awake than I look.'],
    capture: ['That piece woke me up a little.'],
    winning: ['If I am winning, I can go back to sleep.'],
    quiet: ['Nothing to worry about. Yet.'],
    battle: [
      '{opponent}, do not make this interesting. You will wake up the other me.',
      'Sleepy Martin is smiling. Evil Martin is taking notes.',
    ],
    mate: ['Evil Martin is done playing.'],
    end: ['Back to sleep.'],
  },
}

const IWANTCHECKMATE_DIALOGUE_ALIASES = {
  'iwc-martinfish-80-20': 'iwc-random-martinfish',
  'iwc-martinfish-95-5': 'iwc-random-martinfish',
  'iwc-evil-martin-2': 'iwc-evil-martin',
}

function iwantcheckmateDialogue(profile, context) {
  const lines = iwantcheckmateLines(profile)
  if (!lines) return ''
  const values = {
    delta: Math.abs(Math.round(context.variantEloDelta || 0)),
    elo: Math.round(context.variantElo || profile.variant?.initialElo || 250),
    opponent: context.opponentName || 'opponent',
  }
  let choices
  if (context.isCheckmate) choices = lines.mate
  else if (context.variantEloDelta && lines.elo) choices = lines.elo
  else if (profile.id === 'iwc-evil-martin' && context.variantElo >= 3000) choices = lines.awake
  else if (profile.id === 'iwc-evil-martin' && lines.sleepy) choices = lines.sleepy
  else if (context.isCheck && lines.check) choices = lines.check
  else if (
    (context.isFreePiece || context.opponentBlunder || context.capturedValue > 0) &&
    lines.capture
  ) choices = lines.capture
  else if (context.isWinning && lines.winning) choices = lines.winning
  else if (context.opponentName && lines.battle) choices = lines.battle
  else choices = lines.quiet
  return fillTemplate(pick(asLines(choices)), values)
}

export function dialogueAfterBotMove(profile, context) {
  if (profile.dialoguePolicy === 'silent') return ''
  if (profile.dialoguePolicy === 'iwantcheckmate') {
    return iwantcheckmateDialogue(profile, context)
  }
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

export function dialogueForBotBattle(profile, context, opponentProfile = null) {
  if (profile.dialoguePolicy === 'silent') return ''
  const opponentName = opponentProfile?.name || 'opponent'
  const direct = dialogueAfterBotMove(profile, {
    ...context,
    opponentName,
  })
  if (direct) {
    return profile.dialoguePolicy === 'iwantcheckmate'
      ? addressOpponent(direct, opponentName)
      : direct
  }
  const policy = profile.dialoguePolicy || profile.id || 'mubassar'
  const lines = BOT_BATTLE_FALLBACK_LINES[policy] || BOT_BATTLE_FALLBACK_LINES.mubassar
  return pick(lines).replaceAll('{opponent}', opponentName)
}

export function initialDialogue(profile) {
  if (profile.dialoguePolicy === 'silent') return ''
  if (profile.dialoguePolicy === 'iwantcheckmate') {
    return iwantcheckmateLines(profile)?.intro || ''
  }
  if (profile.id === 'mubassar') return 'Prepare for belt.'
  return ''
}

export function dialogueForGameEnd(profile, result) {
  if (profile.dialoguePolicy === 'silent') return ''
  if (profile.dialoguePolicy === 'iwantcheckmate') {
    return pick(asLines(iwantcheckmateLines(profile)?.end))
  }
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

function asLines(value) {
  if (Array.isArray(value) && value.length) return value
  if (typeof value === 'string' && value) return [value]
  return ['Good game.']
}

function fillTemplate(line, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    line,
  )
}

function iwantcheckmateLines(profile) {
  const dialogueId = IWANTCHECKMATE_DIALOGUE_ALIASES[profile.id] || profile.id
  return IWANTCHECKMATE_LINES[dialogueId]
}

function addressOpponent(line, opponentName) {
  if (!line || !opponentName || line.includes(opponentName)) return line
  return `${opponentName}, ${line}`
}
