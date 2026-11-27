# Stockfish 19 browser distribution

The application keeps the existing local Web Worker / UCI interface. No backend or external analysis service is added.

- Upstream package: `@lichess-org/stockfish-web@0.5.0`, npm source commit `931c33470b0c80756c99dfb05008d951aaa8f751`.
- Engine base: official Stockfish `sf_19`, commit `edb0d9db6731067ec50ce619ff372b463bc4dd5d`.
- This site bundles upstream `sf_19_smallnet`. The upstream README describes its small-network feature patch.
- Unmodified npm package verified against registry SHA512 integrity: `sha512-4p+bnJKr+ufCanyaqUFJkvajVf443sg51+OPnDKjAi91kiY8DGAbfjj5WlmWybwILOF7ouPEjeCYwlPUV3EU3g==`.
- NNUE downloaded from the official Fishtest `/api/nn/<filename>` endpoint; full SHA256 values in `manifest.json` match the upstream recommended filename prefixes.
- The supplied `LICENSE` is GPLv3. Upstream npm `package.json` declares AGPL-3.0-or-later; this upstream metadata discrepancy is preserved, not silently rewritten. The engine sources and local adapter are distributed with GPL-3.0-or-later notices.

## Existing Worker contract

`new Worker(new URL('stockfish-19-worker.js', baseUrl), { type: 'module' })`. Send UCI command strings with `postMessage` and receive UCI output strings in `message.data`. Commands received while WASM and the network load are queued (maximum 256). Initialization errors reach the Worker error handler. Use `terminate()` to cancel the worker. The adapter loads sibling packaged files and checks the recommended NNUE filename before passing its bytes to the upstream module.

The published build uses pthreads/shared WASM memory even with UCI `Threads=1`. It therefore requires a secure context with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, including Worker responses. Static hosts unable to set headers need their existing isolation service worker or equivalent; merely changing an engine label is insufficient. No single-threaded Stockfish 19 build is claimed. Preserve existing thread settings; analysis controls are unchanged.

## Complete corresponding sources

- `stockfish-web-source-931c334.zip` contains the exact build scripts, glue, and patches from https://github.com/lichess-org/stockfish-web/tree/931c33470b0c80756c99dfb05008d951aaa8f751 .
- `stockfish-source-sf_19.zip` contains the official base from https://github.com/official-stockfish/Stockfish/tree/edb0d9db6731067ec50ce619ff372b463bc4dd5d .
- Upstream `build.py` pins Emscripten 5.0.7 and applies `patches/sf_19.patch` or the two `patches/sf_19_smallnet` patches. Its documented build is `./build.py clean sf_19 sf_19_smallnet --pgo --verify-bench`.
- `stockfish-19-worker.js` is the complete local compatibility adapter source; the upstream loaders/WASM/networks are unchanged.

Sources: https://github.com/lichess-org/stockfish-web/blob/931c33470b0c80756c99dfb05008d951aaa8f751/README.md and https://registry.npmjs.org/@lichess-org%2fstockfish-web/0.5.0 . Runtime/browser verification is reported separately; hashes alone do not prove a search.
