# Play Bots

A static browser chess coach app with selectable coach profiles.

Licensed under GPL-3.0.

## Features

- Playable chessboard with legal move validation from `chess.js`
- Selectable Mubassar and Ayden profiles
- Profile-based weighted repertoire selection from public games
- Ayden style inference from recent White/Black games, pawn structures, piece setups, tactical motifs, endgames, and time controls
- MultiPV move selection that keeps Ayden-like choices when they remain close to Stockfish's best line
- Historical weak-move correction with Stockfish and local fallback behavior
- Browser Stockfish 18 lite single-threaded WASM for deeper post-book calculation
- JavaScript fallback evaluator when Stockfish cannot load
- Lightweight game-review notes for tactical moments and mistakes
- GitHub Pages-ready Vite build

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run build
npm run verify:ayden
npm run build:recent-book
```

## Opening Prep

Mubassar's manual and generated prep lives in `src/data/openingBook.js`. Ayden's generated repertoire and learned style are refreshed from `AA01001` and `AydenICN` with `npm run build:recent-book`; the command preserves the last good generated files if both public APIs are unavailable.
