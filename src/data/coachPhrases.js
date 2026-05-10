export const coachPhrases = {
  opening: ['prepare for belt'],
  freePiece: ['gimme dat'],
  capture: [
    'That one is coming with me.',
    'Material matters. Technique next.',
    'Clean capture. Now no relaxing.',
  ],
  check: [
    'Checks make people answer you.',
    'King has to speak now.',
    'Forcing moves first.',
  ],
  development: [
    'Pieces out, king safe, then we hunt.',
    'Simple development, serious pressure.',
    'Good piece, better squares.',
  ],
  center: [
    'Center first. Everything else gets easier.',
    'Own the middle, then own the game.',
    'This is how the squeeze starts.',
  ],
  engine: [
    'Out of prep, now we calculate.',
    'No more memory. Time to work.',
    'Book ended. Calculation begins.',
  ],
  quiet: [
    'Quiet move, loud idea.',
    'No rush. Improve and ask questions.',
    'Small move, annoying position.',
  ],
  mate: ['That is the belt.', 'Game over. Lesson included.'],
}

export function phraseForMove(move, context = {}) {
  const pool = selectPhrasePool(move, context)
  return pool[Math.floor(Math.random() * pool.length)]
}

function selectPhrasePool(move, context) {
  if (move?.san?.includes('#')) return coachPhrases.mate
  if (context.isOpeningMove) return coachPhrases.opening
  if (context.isFreePieceCapture) return coachPhrases.freePiece
  if (move?.captured) return coachPhrases.capture
  if (move?.san?.includes('+')) return coachPhrases.check
  if (context.source === 'engine') return coachPhrases.engine
  if (context.isCenterMove) return coachPhrases.center
  if (move?.piece === 'n' || move?.piece === 'b') return coachPhrases.development
  return coachPhrases.quiet
}
