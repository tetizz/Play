export const coachPhrases = {
  opening: [
    'prepare for belt',
    'We start with d4 and ask questions right away',
    'Class is in session, do not blink',
  ],
  freePiece: [
    'gimme dat',
    'gimme dat, I love free pieces',
    'That was hanging. I am taking that every time',
    'Free piece, I am not asking twice',
    'You left it, I take it',
  ],
  great: [
    'What are you gonna do after that',
    'That is a grown-man move',
    'Now you have problems to solve',
    'This is the kind of move that makes people sit up',
    'We larping high elo with this move',
    'That is not luck, that is pressure',
  ],
  winning: [
    'This is what I call belt',
    'You are really about to get folded here',
    'This position is starting to look personal',
    'I can play this endgame with my eyes closed',
    'You gave me the wheel. Now sit there',
  ],
  belt: [
    'This is belt mode now',
    'I told you, this opening was going to get punished',
    'Now every move is a problem for you',
    'You wanted high elo, now survive it',
    'This is what I call belt',
    'You are not getting casual Mubassar anymore',
  ],
  beltCapture: [
    'gimme dat, belt mode taxes everything',
    'That piece is gone and so is your position',
    'Free material in belt mode is crazy',
    'I am collecting pieces now',
  ],
  beltGreat: [
    'We larping high elo with this move',
    'What are you gonna do after that',
    'This is the type of move that makes people resign emotionally',
    'I am not even letting you breathe now',
  ],
  capture: [
    'That one is coming with me',
    'Material matters. Technique next',
    'Clean capture. Now no relaxing',
    'I take, then I make you prove compensation',
  ],
  check: [
    'Checks make people answer you',
    'King has to speak now',
    'Forcing moves first',
    'You do not get to ignore this one',
    'Check. Now defend like you mean it',
    'Your king is the problem now',
  ],
  development: [
    'Pieces out, king safe, then we hunt',
    'Simple development, serious pressure',
    'Good piece, better squares',
    'Nothing fancy, just strong chess',
  ],
  center: [
    'Center first. Everything else gets easier',
    'Own the middle, then own the game',
    'This is how the squeeze starts',
    'You let me have the center, now we play my game',
  ],
  engine: [
    'This one feels right',
    'I like this move',
    'Now you have to show me something',
    'This is the annoying move',
  ],
  quiet: [
    'Quiet move, loud idea',
    'No rush. Improve and ask questions',
    'Small move, annoying position',
    'I am not rushing because your position has to breathe first',
  ],
  mate: [
    'That is the belt',
    'Game over. Lesson included',
    'That is why we calculate forcing moves',
    'Checkmate. Sit with that one',
  ],
}

export function phraseForMove(move, context = {}) {
  const pool = selectPhrasePool(move, context)
  return pool[Math.floor(Math.random() * pool.length)]
}

function selectPhrasePool(move, context) {
  if (move?.san?.includes('#')) return coachPhrases.mate
  if (context.isOpeningMove) return coachPhrases.opening
  if (context.isBeltMode && context.isFreePieceCapture) return coachPhrases.beltCapture
  if (context.isBeltMode && context.isGreatMove) return coachPhrases.beltGreat
  if (context.isBeltMode) return coachPhrases.belt
  if (context.isFreePieceCapture) return coachPhrases.freePiece
  if (context.isWinning) return coachPhrases.winning
  if (context.isGreatMove) return coachPhrases.great
  if (move?.captured) return coachPhrases.capture
  if (move?.san?.includes('+')) return coachPhrases.check
  if (context.source === 'engine') return coachPhrases.engine
  if (context.isCenterMove) return coachPhrases.center
  if (move?.piece === 'n' || move?.piece === 'b') return coachPhrases.development
  return coachPhrases.quiet
}
