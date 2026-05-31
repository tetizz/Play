# Play Bots

A static browser chess coach app with selectable coach profiles.

Licensed under GPL-3.0.

## Features

- Playable chessboard with legal move validation from `chess.js`
- Selectable Mubassar and Ayden profiles
- Profile-based weighted repertoire selection from public games
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
```

## Opening Prep

Add PGN-exported prep lines in `src/data/openingBook.js` and `src/data/aydenOpeningBook.js`. The bot checks those lines before using Stockfish so each profile keeps its own opening tendencies.
