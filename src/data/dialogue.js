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

const IWANTCHECKMATE_LINES = {
  'iwc-worst-move': {
    intro: 'Find the true worst move and I lose 500 Elo. No pressure.',
    elo: [
      'You actually found the worst move. That just cost me {delta} Elo.',
      'Minus {delta} Elo. I cannot believe that move worked.',
    ],
    check: ['A check is fine. The truly awful move is what worries me.'],
    capture: ['That piece was free. Even losing Elo cannot hide that.'],
    quiet: ['Not bad enough. I am still thinking at {elo}.'],
    battle: [
      '{opponent}, show me the move that makes the evaluation bar leave the building.',
      'I am searching for the basement, {opponent}. Stop giving me playable moves.',
    ],
    mate: ['I lost Elo, not the mating pattern.'],
    end: ['The worst move challenge is over. My rating needs a minute.'],
  },
  'iwc-give-check': {
    intro: 'Please do not check me. Every check costs me 300 Elo.',
    elo: [
      'A check? Great. There goes {delta} Elo.',
      'I heard the word check and forgot {delta} Elo immediately.',
    ],
    check: ['I can give checks. Receiving them is the problem.'],
    capture: ['Panic later. Free piece now.'],
    quiet: ['No check? Good. I can still remember how the pieces move.'],
    battle: [
      '{opponent}, put the checks away. My rating is held together with tape.',
      'Every quiet move is a tiny vacation, {opponent}.',
    ],
    mate: ['No panic left. That is mate.'],
    end: ['I survived the checks. Mostly.'],
  },
  'iwc-best-move': {
    intro: 'Every best move you find costs me 100 Elo. Try not to be too accurate.',
    elo: [
      'Best move detected. Minus {delta} Elo. I am completely fine.',
      'You found the engine move. There goes another {delta}.',
    ],
    check: ['A check and maybe the best move too? That is just rude.'],
    capture: ['The best move can wait. I saw a free piece.'],
    quiet: ['Was that really best? My rating hopes not.'],
    battle: [
      '{opponent}, please explore the rich world of second-best moves.',
      'Your accuracy is personally attacking my rating, {opponent}.',
    ],
    mate: ['That ending was best for me.'],
    end: ['The engine can stop judging both of us now.'],
  },
  'iwc-smartin': {
    intro: 'I start at 250. Every move makes me 100 Elo smarter.',
    elo: [
      'Another move, another {delta} Elo. I am up to {elo}.',
      'I can feel the rating kicking in. {elo} and climbing.',
    ],
    check: ['Check. I learned that one a few hundred Elo ago.'],
    capture: ['At {elo}, I am apparently allowed to take free pieces.'],
    quiet: ['Give me a few more moves. I am still downloading chess.'],
    battle: [
      '{opponent}, keep stalling. I become a grandmaster appliance eventually.',
      'I have {elo} Elo and several new thoughts, {opponent}.',
    ],
    mate: ['I learned checkmate just in time.'],
    end: ['Look how much I learned in one game.'],
  },
  'iwc-elo-decay': {
    intro: 'I start at 3600 and lose 50 Elo every move. Let us finish quickly.',
    elo: [
      'Minus {delta}. I knew this position a second ago.',
      'Another {delta} Elo gone. Thinking is exhausting.',
    ],
    check: ['Check. I still remember that much.'],
    capture: ['I may be tired, but that piece was awake and hanging.'],
    quiet: ['At {elo}, this position is starting to look blurry.'],
    battle: [
      '{opponent}, hurry. My opening knowledge is evaporating.',
      'I had a brilliant idea at 3600. I cannot remember it now.',
    ],
    mate: ['Finally. I can sleep now.'],
    end: ['Game over. Wake me up when my Elo comes back.'],
  },
  'iwc-random-blunder': {
    intro: 'Ninety-five percent Stockfish. Five percent terrible idea.',
    check: ['That check came from the responsible ninety-five percent.'],
    capture: ['The piece was free. Even my bad five percent saw it.'],
    winning: ['The five percent has not shown up yet.'],
    quiet: ['Was that Stockfish or the five percent? You will find out.'],
    battle: [
      '{opponent}, I have consulted the engine and one extremely bad impulse.',
      'Ninety-five percent calculation. Five percent banana peel.',
    ],
    mate: ['No blunder this time. Checkmate.'],
    end: ['The five percent did not save you.'],
  },
  'iwc-random-top-three': {
    intro: 'I roll between Stockfish’s top three moves. The dice are ready.',
    check: ['The engine dice landed on check.'],
    capture: ['The dice said take it.'],
    winning: ['All three choices look unpleasant for you.'],
    quiet: ['One, two, or three. I am not telling you which one won.'],
    battle: [
      'The engine gave me three doors, {opponent}. I kicked one open.',
      'My move selection has the confidence of a dice roll.',
    ],
    mate: ['The dice have spoken. Checkmate.'],
    end: ['Random choice, very real result.'],
  },
  'iwc-zero-evaluation': {
    intro: 'I only want 0.00. I offer draw in advance.',
    check: ['That check was meant to make the position more equal. Somehow.'],
    capture: ['Equal material is easier when I take yours.'],
    winning: ['This is too winning. I need to calm the evaluation down.'],
    quiet: ['I offer draw. Again.'],
    battle: [
      '{opponent}, could we please return this evaluation to factory settings?',
      'I ordered 0.00 and received whatever this position is.',
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
    intro: 'I start at 250, but every capture or check feeds me 1000 Elo.',
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
    intro: 'I search every legal move and deliberately choose the worst one.',
    check: ['If this is check, imagine how bad the other moves were.'],
    capture: ['Taking that was somehow the worst idea available.'],
    winning: ['I am winning despite my best efforts.'],
    quiet: ['I found the bottom of the move list and kept digging.'],
    battle: [
      '{opponent}, I have discovered a move the engine tried to hide from humanity.',
      'The evaluation bar saw my move and filed a complaint.',
    ],
    mate: ['You lost to the worst move. That is impressive.'],
    end: ['The worst move won. Chess is strange.'],
  },
  'iwc-martinfish': {
    intro: 'One Stockfish move, one Martin move. What could go wrong?',
    check: ['Stockfish found the check. Martin is taking credit.'],
    capture: ['One side of my brain saw that piece.'],
    winning: ['Stockfish is carrying. Martin is enjoying the view.'],
    quiet: ['Half calculation, half adventure.'],
    battle: [
      '{opponent}, one of my two brains knows what is happening.',
      'Stockfish has the wheel. Martin has the map upside down.',
    ],
    mate: ['Stockfish set it up. Martin definitely meant it.'],
    end: ['Teamwork between 3600 and 250.'],
  },
  'iwc-martinfish-2': {
    intro: 'Two Stockfish moves, then one Martin move. Slightly less chaos.',
    check: ['Two parts calculation, one part surprise.'],
    capture: ['That looked like one of the Stockfish turns.'],
    winning: ['Martin gets one move soon. Do not relax.'],
    quiet: ['The third move is where the plot changes.'],
    battle: [
      '{opponent}, I am competent in groups of two.',
      'Two engine moves paid for the next Martin move.',
    ],
    mate: ['The ratio worked. Checkmate.'],
    end: ['Two good ideas were enough to cover one Martin idea.'],
  },
  'iwc-martinfish-3': {
    intro: 'Three Stockfish moves, then Martin gets the controls.',
    check: ['Three moves of preparation for one move of mystery.'],
    capture: ['Stockfish built it. Martin found the capture button.'],
    winning: ['The three-to-one ratio is doing its job.'],
    quiet: ['Martin’s turn is always closer than it looks.'],
    battle: [
      '{opponent}, the engine gets three sentences and Martin gets the punchline.',
      'Three precise moves. Then we release the Martin.',
    ],
    mate: ['Three parts engine, one part Martin, one checkmate.'],
    end: ['The engine-to-Martin ratio survived.'],
  },
  'iwc-random-martinfish': {
    intro: 'Ninety percent Stockfish, ten percent Martin. Guess who moved.',
    check: ['Probably Stockfish. Probably.'],
    capture: ['That looked suspiciously competent.'],
    winning: ['The ten percent has not ruined it yet.'],
    quiet: ['Was that the ninety or the ten?'],
    battle: [
      '{opponent}, you are one random number away from a completely different game.',
      'The engine is driving, but Martin keeps touching the radio.',
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

function iwantcheckmateDialogue(profile, context) {
  const lines = IWANTCHECKMATE_LINES[profile.id]
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
  const direct = dialogueAfterBotMove(profile, {
    ...context,
    opponentName: opponentProfile?.name || 'opponent',
  })
  if (direct) return direct
  const policy = profile.dialoguePolicy || profile.id || 'mubassar'
  const lines = BOT_BATTLE_FALLBACK_LINES[policy] || BOT_BATTLE_FALLBACK_LINES.mubassar
  const opponentName = opponentProfile?.name || 'opponent'
  return pick(lines).replaceAll('{opponent}', opponentName)
}

export function initialDialogue(profile) {
  if (profile.dialoguePolicy === 'silent') return ''
  if (profile.dialoguePolicy === 'iwantcheckmate') {
    return IWANTCHECKMATE_LINES[profile.id]?.intro || ''
  }
  if (profile.id === 'mubassar') return 'Prepare for belt.'
  return ''
}

export function dialogueForGameEnd(profile, result) {
  if (profile.dialoguePolicy === 'silent') return ''
  if (profile.dialoguePolicy === 'iwantcheckmate') {
    return pick(asLines(IWANTCHECKMATE_LINES[profile.id]?.end))
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
