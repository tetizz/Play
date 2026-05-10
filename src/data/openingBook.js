// Weighted repertoire data for the Mubassar bot.
// This mirrors OpeningTree-style move frequency: key = SAN moves already played,
// value = Mubassar's preferred legal replies from that position.
import { GENERATED_REPERTOIRE_BOOK } from './generatedRepertoireBook'

const MANUAL_OPENING_BOOK = {
  '': [
    { san: 'd4', games: 2237, wins: 1202, losses: 914, force: true },
  ],

  e4: [
    { san: 'c5', games: 420, wins: 214, losses: 161 },
    { san: 'e5', games: 240, wins: 116, losses: 94 },
    { san: 'c6', games: 110, wins: 51, losses: 44 },
  ],
  d4: [
    { san: 'Nf6', games: 620, wins: 305, losses: 241 },
    { san: 'd5', games: 410, wins: 194, losses: 166 },
    { san: 'e6', games: 260, wins: 125, losses: 101 },
  ],
  Nf3: [
    { san: 'Nf6', games: 310 },
    { san: 'd5', games: 180 },
    { san: 'c5', games: 90 },
  ],
  c4: [
    { san: 'Nf6', games: 230 },
    { san: 'e5', games: 120 },
    { san: 'c5', games: 80 },
  ],
  b3: [
    { san: 'e5', games: 90 },
    { san: 'Nf6', games: 70 },
    { san: 'd5', games: 50 },
  ],

  'd4 e5': [{ san: 'c4', games: 64, wins: 35, losses: 20, draws: 9, force: true }],
  'd4 Nf6': [{ san: 'c4', games: 980 }, { san: 'Nf3', games: 310 }, { san: 'Bf4', games: 120 }],
  'd4 d5': [{ san: 'c4', games: 760 }, { san: 'Nf3', games: 180 }, { san: 'Bf4', games: 90 }],
  'd4 e6': [{ san: 'c4', games: 660 }, { san: 'Nf3', games: 210 }],
  'd4 Nf6 c4': [{ san: 'e6', games: 520 }, { san: 'g6', games: 260 }, { san: 'c5', games: 180 }],
  'd4 Nf6 c4 e6': [{ san: 'Nc3', games: 410 }, { san: 'Nf3', games: 280 }],
  'd4 Nf6 c4 e6 Nc3': [{ san: 'Bb4', games: 360 }, { san: 'd5', games: 120 }],
  'd4 Nf6 c4 e6 Nf3': [{ san: 'd5', games: 220 }, { san: 'b6', games: 100 }],
  'd4 Nf6 c4 g6': [{ san: 'Nc3', games: 260 }, { san: 'Nf3', games: 150 }],
  'd4 Nf6 c4 g6 Nc3': [{ san: 'd5', games: 180 }, { san: 'Bg7', games: 130 }],
  'd4 Nf6 c4 c5': [{ san: 'd5', games: 170 }, { san: 'Nf3', games: 80 }],
  'd4 Nf6 c4 c5 d5': [{ san: 'e6', games: 140 }, { san: 'b5', games: 70 }],
  'd4 d5 c4': [{ san: 'e6', games: 360 }, { san: 'c6', games: 240 }, { san: 'dxc4', games: 95 }],
  'd4 d5 c4 e6': [{ san: 'Nc3', games: 300 }, { san: 'Nf3', games: 220 }],
  'd4 d5 c4 e6 Nc3': [{ san: 'Nf6', games: 240 }, { san: 'Be7', games: 110 }],
  'd4 d5 c4 c6': [{ san: 'Nf3', games: 260 }, { san: 'Nc3', games: 190 }],
  'd4 d5 c4 c6 Nf3': [{ san: 'Nf6', games: 230 }],

  'e4 c5': [{ san: 'Nf3', games: 350 }, { san: 'Nc3', games: 140 }, { san: 'c3', games: 70 }],
  'e4 c5 Nf3': [{ san: 'd6', games: 260 }, { san: 'Nc6', games: 210 }, { san: 'e6', games: 150 }],
  'e4 c5 Nf3 d6': [{ san: 'd4', games: 220 }, { san: 'Bb5+', games: 80 }],
  'e4 c5 Nf3 d6 d4': [{ san: 'cxd4', games: 210 }],
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4': [{ san: 'Nf6', games: 200 }],
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3': [{ san: 'a6', games: 150 }, { san: 'g6', games: 90 }],
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6': [{ san: 'Be3', games: 90 }, { san: 'Be2', games: 70 }],
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3': [{ san: 'e5', games: 80 }],
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2': [{ san: 'e5', games: 65 }],
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6': [{ san: 'Be6', games: 70 }, { san: 'Bg7', games: 60 }],
  'e4 c5 Nf3 Nc6': [{ san: 'd4', games: 170 }, { san: 'Bb5', games: 75 }],
  'e4 c5 Nf3 Nc6 d4': [{ san: 'cxd4', games: 160 }],
  'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4': [{ san: 'Nf6', games: 120 }, { san: 'g6', games: 90 }],
  'e4 c5 Nf3 e6': [{ san: 'd4', games: 130 }, { san: 'c3', games: 55 }],
  'e4 c5 Nf3 e6 d4': [{ san: 'cxd4', games: 120 }],
  'e4 c5 Nf3 e6 d4 cxd4 Nxd4': [{ san: 'Nf6', games: 100 }, { san: 'a6', games: 90 }],

  'e4 e5': [{ san: 'Nf3', games: 230 }, { san: 'Bc4', games: 60 }],
  'e4 e5 Nf3': [{ san: 'Nc6', games: 190 }, { san: 'Nf6', games: 80 }],
  'e4 e5 Nf3 Nc6': [{ san: 'Bb5', games: 120 }, { san: 'Bc4', games: 90 }],
  'e4 e5 Nf3 Nc6 Bb5': [{ san: 'a6', games: 110 }, { san: 'Nf6', games: 60 }],
  'e4 e5 Nf3 Nc6 Bc4': [{ san: 'Bc5', games: 80 }, { san: 'Nf6', games: 70 }],

  'e4 c6': [{ san: 'd4', games: 90 }, { san: 'Nc3', games: 40 }],
  'e4 c6 d4': [{ san: 'd5', games: 80 }],
  'e4 c6 d4 d5 Nc3': [{ san: 'dxe4', games: 45 }],
  'e4 c6 d4 d5 Nd2': [{ san: 'dxe4', games: 35 }],
}

export const BOOK_MAX_PLIES = 14

const FORCE_MANUAL_KEYS = new Set(['', 'd4 e5'])

export const OPENING_BOOK = mergeBooks(GENERATED_REPERTOIRE_BOOK, MANUAL_OPENING_BOOK)

function mergeBooks(generatedBook, manualBook) {
  const merged = { ...generatedBook }
  for (const [key, moves] of Object.entries(manualBook)) {
    if (FORCE_MANUAL_KEYS.has(key) || !merged[key]) merged[key] = moves
  }
  return merged
}

export function linesToBook(lines) {
  const book = {}
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 2) {
      const key = line.slice(0, index).join(' ')
      const reply = line[index]
      const existing = book[key] || []
      const found = existing.find((move) => move.san === reply)
      if (found) found.games += 1
      else existing.push({ san: reply, games: 1 })
      book[key] = existing
    }
  }
  return book
}
