export const coachPhrases = {
  opening: [
    'prepare for belt',
    'We start with d4 and ask questions right away',
    'Class is in session, do not blink',
  ],
  freePiece: [
    'gimme dat',
    'Free piece, I am not asking twice',
    'You left it, I take it',
  ],
  great: [
    'What are you gonna do after that',
    'That is a grown-man move',
    'Now you have problems to solve',
    'This is the kind of move that makes people sit up',
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
    'I checked the line and this is the practical move',
    'Calculation says this one is clean',
    'I am choosing the move that gives you the hardest questions',
    'This is not random, this is calculation',
  ],
  quiet: [
    'Quiet move, loud idea',
    'No rush. Improve and ask questions',
    'Small move, annoying position',
    'I am not rushing because your position has to breathe first',
  ],
  mate: ['That is the belt', 'Game over. Lesson included', 'That is why we calculate forcing moves'],
}

export function phraseForMove(move, context = {}) {
  const pool = selectPhrasePool(move, context)
  return pool[Math.floor(Math.random() * pool.length)]
}

function selectPhrasePool(move, context) {
  if (move?.san?.includes('#')) return coachPhrases.mate
  if (context.isOpeningMove) return coachPhrases.opening
  if (context.isFreePieceCapture) return coachPhrases.freePiece
  if (context.isGreatMove) return coachPhrases.great
  if (move?.captured) return coachPhrases.capture
  if (move?.san?.includes('+')) return coachPhrases.check
  if (context.source === 'engine') return coachPhrases.engine
  if (context.isCenterMove) return coachPhrases.center
  if (move?.piece === 'n' || move?.piece === 'b') return coachPhrases.development
  return coachPhrases.quiet
}
