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
  'rnbqkbnr/ppp1pppp/8/3p4/8/5N2/PPPPPPPP/RNBQKB1R w KQkq -': 'g3',
  'r1bqkbnr/ppp1pppp/2n5/3p4/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq -': 'Bg2',
  'r1bqkbnr/ppp2ppp/2n5/3pp3/8/5NP1/PPPPPPBP/RNBQK2R w KQkq -': 'd3',
  'r1bqkb1r/ppp2ppp/2n2n2/3pp3/8/3P1NP1/PPP1PPBP/RNBQK2R w KQkq -': 'O-O',
  'r1bqk2r/ppp2ppp/2n2n2/2bpp3/8/3P1NP1/PPP1PPBP/RNBQ1RK1 w kq -': 'Nxe5',
  'r1bqk2r/ppp2ppp/5n2/2bpn3/8/3P2P1/PPP1PPBP/RNBQ1RK1 w kq -': 'd4',
  'r1bqk2r/ppp2ppp/3b1n2/3pn3/3P4/6P1/PPP1PPBP/RNBQ1RK1 w kq -': 'dxe5',
  'r1bqk2r/ppp2ppp/5n2/3pb3/8/6P1/PPP1PPBP/RNBQ1RK1 w kq -': 'c4',
  'r1bqk2r/pp3ppp/2p2n2/3pb3/2P5/6P1/PP2PPBP/RNBQ1RK1 w kq -': 'cxd5',
  'r1bqk2r/pp3ppp/2p5/3nb3/8/6P1/PP2PPBP/RNBQ1RK1 w kq -': 'e4',
  'r1bqk2r/pp3ppp/2p5/4b3/1n2P3/6P1/PP3PBP/RNBQ1RK1 w kq -': 'Qxd8+',
  'r1bk3r/pp3ppp/2p5/4b3/1n2P3/6P1/PP3PBP/RNB2RK1 w - -': 'Nd2',
  'r1bk3r/pp3ppp/2p5/4b3/4P3/6P1/PPnN1PBP/R1B2RK1 w - -': 'Rb1',
  'r2k3r/pp3ppp/2p1b3/4b3/4P3/6P1/PPnN1PBP/1RB2RK1 w - -': 'Nf3',
  'r2k3r/pp3ppp/2p5/4b3/4P3/5NP1/bPn2PBP/1RB2RK1 w - -': 'Nxe5',
  'r2k3r/pp4pp/2p2p2/4N3/4P3/6P1/bPn2PBP/1RB2RK1 w - -': 'Bf4',
  'r2k3r/pp4pp/2p2p2/4N3/4PB2/6P1/1Pn2PBP/1b3RK1 w - -': 'Nf7+',
  'r6r/pp2kNpp/2p2p2/8/4PB2/6P1/1Pn2PBP/1b3RK1 w - -': 'Nxh8',
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
