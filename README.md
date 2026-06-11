# Play Bots

A static, GitHub Pages-compatible chess bot app with four independent profiles:
Mubassar, Ayden Spellman, Akshit Sharma, and Trixize.

Licensed under GPL-3.0.

## Features

- Responsive bot selection, live game, and interactive review workspaces
- Legal click-to-move, drag/drop, premoves, history navigation, checks, checkmates, and analysis arrows
- Client-side Stockfish 18 with serialized requests, cancellation, MultiPV, and per-request timeouts
- Profile-specific strength, recent repertoire, move-selection, and dialogue policies
- Combined Chess.com and Lichess repertoire imports with correct color detection and a 180-day recency half-life
- Mubassar's forced `1. d4`, sound recent repertoire choices, and isolated belt mode
- Ayden's separate low-noise 1900 profile
- Akshit's knight-specialist policy and restricted dialogue
- Trixize's displayed 1550 profile, maximum-strength analysis, forced `1. Nf3`, and perfect-theory preference
- Reload-safe game persistence and deterministic turn/premove handling
- Bookup-derived move classifications, per-side counts, phase accuracy, game rating, evaluation graph, best line, and per-move explanations
- Unit and Playwright regression coverage for profiles, repertoire selection, classifications, premoves, persistence, review, and responsive layouts

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

## Repertoire Data

Refresh one profile or all profiles:

```bash
npm run build:recent-book
npm run build:repertoires
```

External account names are import configuration only and are never displayed in the app.

## Attribution

The browser classification behavior and move-classification PNG assets are adapted
from [tetizz/Bookup](https://github.com/tetizz/Bookup), used under GPL-3.0.
This repository's existing `LICENSE` file remains the governing license.
