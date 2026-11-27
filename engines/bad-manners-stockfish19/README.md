# Bad Manners Stockfish 19

This is the current native C++ Bad Manners engine. It is based on the official Stockfish 19 release and keeps Stockfish's normal search, NNUE, move generation, transposition tables, threading, and Syzygy support. The Bad Manners challenge layer is optional and defaults to `Off`.

The Stockfish 18 source, binaries, and historical notes are retained separately for comparison.

## Main files

- Current executable: `dist\BadMannersStockfish19.exe`
- Modified Stockfish 19 source: `stockfish19-src`
- Clean official Stockfish 19 baseline: `stockfish19-baseline.exe`
- Current design and verification notes: `BAD_MANNERS_STOCKFISH19.md`
- Upstream source provenance: `licenses\STOCKFISH19-SOURCE.txt`
- GPL license: `licenses\Copying.txt`
- Reproducible build script: `scripts\build_stockfish19.ps1`
- Smoke and behavior suite: `scripts\source_smoke.py`
- Challenge FEN corpus: `source_test_positions.json`

## Run

```powershell
.\dist\BadMannersStockfish19.exe
```

`BadMannersMode` accepts exactly `Off`, `Safe`, `Aggressive`, `Maximum`, or `Puzzle`. Example:

```text
setoption name BadMannersMode value Maximum
position fen 8/8/8/8/8/8/8/KBkN4 w - - 0 1
bmreport
go depth 8
```

## Build

```powershell
powershell -NoProfile -ExecutionPolicy RemoteSigned -File .\scripts\build_stockfish19.ps1
```

The build uses the checked-in portable llvm-mingw toolchain and produces the AVX2 executable in `dist`.

## Test

```powershell
python .\scripts\source_smoke.py
& 'C:\Users\adria\Downloads\Codex projects\ScottishProgressive\.venv\Scripts\python.exe' .\scripts\strict_uci_smoke.py
```

The main suite preserves the original 165 assertions and adds Stockfish 19 checks for all 17 custom UCI options, strict invalid-FEN handling through both `position fen` and `bmreport`, and start-position perft 3 (`8902` nodes). It loads all 31 corpus entries, runs challenge reports for the 30 non-start positions, and compares `BadMannersMode=Off` with the clean official Stockfish 19 baseline at the same fixed depth. The second test uses python-chess as a strict external UCI parser and verifies the combo default, all five allowed values, switching from `Maximum` back to `Off`, and a legal engine move.

The challenge layer reports heuristic, fixed-depth, and tablebase evidence separately. It does not claim a full game-tree proof outside the searched or tablebase-covered horizon.
