# Mubassar Bot

A static browser chess coach bot inspired by NM Mubassar Uddin.

Licensed under GPL-3.0.

## Features

- Playable chessboard with legal move validation from `chess.js`
- Mubassar profile styling with NM title, 2300 rating, Bangladesh flag, and account links
- OpeningTree-style weighted repertoire selection for Mubassar-style lines
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

Add Bookup or PGN-exported prep lines in `src/data/openingBook.js`. The bot checks those lines before using Stockfish, so Mubassar's common opening choices stay prioritized.
