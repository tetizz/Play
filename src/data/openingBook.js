// Add exported Bookup/PGN prep here as SAN sequences.
// Key = moves already played, value = playable bot replies in SAN.
export const OPENING_BOOK = {
  'e4': ['c5', 'e5', 'c6'],
  'd4': ['Nf6', 'd5', 'e6'],
  'Nf3': ['Nf6', 'd5', 'c5'],
  'c4': ['Nf6', 'e5', 'c5'],
  'e4 c5 Nf3': ['d6', 'Nc6', 'e6'],
  'e4 c5 Nf3 d6 d4': ['cxd4'],
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4': ['Nf6'],
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3': ['a6', 'g6'],
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3': ['e5'],
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2': ['e5'],
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6': ['Be6', 'Bg7'],
  'e4 c5 Nf3 Nc6 d4': ['cxd4'],
  'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4': ['Nf6', 'g6'],
  'e4 c5 Nf3 e6 d4': ['cxd4'],
  'e4 c5 Nf3 e6 d4 cxd4 Nxd4': ['Nf6', 'a6'],
  'e4 e5 Nf3': ['Nc6', 'Nf6'],
  'e4 e5 Nf3 Nc6 Bb5': ['a6', 'Nf6'],
  'e4 e5 Nf3 Nc6 Bc4': ['Bc5', 'Nf6'],
  'e4 c6 d4': ['d5'],
  'e4 c6 d4 d5 Nc3': ['dxe4'],
  'e4 c6 d4 d5 Nd2': ['dxe4'],
  'd4 Nf6 c4': ['e6', 'g6', 'c5'],
  'd4 Nf6 c4 e6 Nc3': ['Bb4'],
  'd4 Nf6 c4 e6 Nf3': ['d5', 'b6'],
  'd4 Nf6 c4 g6 Nc3': ['d5', 'Bg7'],
  'd4 Nf6 c4 c5 d5': ['e6', 'b5'],
  'd4 d5 c4': ['e6', 'c6', 'dxc4'],
  'd4 d5 c4 e6 Nc3': ['Nf6', 'Be7'],
  'd4 d5 c4 c6 Nf3': ['Nf6'],
  'Nf3 Nf6 c4': ['e6', 'g6', 'c5'],
  'c4 Nf6 Nc3': ['e5', 'g6', 'c5'],
}

export function linesToBook(lines) {
  const book = {}
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 2) {
      const key = line.slice(0, index).join(' ')
      const reply = line[index]
      book[key] = [...new Set([...(book[key] || []), reply])]
    }
  }
  return book
}
