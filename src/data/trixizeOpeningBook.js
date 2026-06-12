import { GENERATED_RECENT_TRIXIZE_REPERTOIRE_BOOK } from './generatedRecentTrixizeRepertoireBook.js'

const TRIXIZE_KNOWN_LINES = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': 'Nf3',
  'rnbqkbnr/p1pppppp/1p6/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -': 'g3',
  'rn1qkbnr/pbpppppp/1p6/8/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq -': 'Bg2',
  'rn1qkbnr/pbpppp1p/1p6/6p1/8/5NP1/PPPPPPBP/RNBQK2R w KQkq -': 'e4',
  'rn1qkbnr/p1pppp1p/1p6/6p1/4b3/5NP1/PPPP1PBP/RNBQK2R w KQkq -': 'd3',
  'rn1qkbnr/p1pppp1p/1p6/6p1/8/3P1bP1/PPP2PBP/RNBQK2R w KQkq -': 'Qxf3',
  'r2qkbnr/p1pppp1p/1pn5/6p1/8/3P1QP1/PPP2PBP/RNB1K2R w KQkq -': 'Qxc6',
  'r2qkbnr/p1p1pp1p/1pp5/6p1/8/3P2P1/PPP2PBP/RNB1K2R w KQkq -': 'Bxc6+',
  'r3kbnr/p1pqpp1p/1pB5/6p1/8/3P2P1/PPP2P1P/RNB1K2R w KQkq -': 'Bxd7+',
}

export const TRIXIZE_OPENING_BOOK = mergeKnownLines(
  GENERATED_RECENT_TRIXIZE_REPERTOIRE_BOOK,
  TRIXIZE_KNOWN_LINES,
)

function mergeKnownLines(generatedBook, knownLines) {
  const merged = { ...generatedBook }
  for (const [position, san] of Object.entries(knownLines)) {
    const generatedMoves = generatedBook[position] || []
    merged[position] = [
      {
        san,
        force: true,
        games: 1,
        wins: 1,
        losses: 0,
        draws: 0,
        recentWeight: 1,
      },
      ...generatedMoves.filter((move) => move.san !== san),
    ]
  }
  return merged
}
