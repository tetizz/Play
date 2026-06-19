# Bad Manners Stockfish 18

This is a real C++ fork of the official Stockfish 18 release source, not a Python wrapper or imitation engine.

## Main Files

- Modified source: `stockfish18-src`
- Source notes: `BAD_MANNERS_STOCKFISH18.md`
- Smoke tests: `scripts\source_smoke.py`
- Challenge FEN suite: `source_test_positions.json`

This vendored GitHub copy tracks source code only. Generated executables, NNUE
network files, object files, local toolchains, and `dist` artifacts are ignored.

## Run

```powershell
.\stockfish18-src\src\stockfish.exe
```

Useful Bad Manners commands:

```text
setoption name BadMannersMode value Maximum
position fen 8/8/8/8/8/8/8/KBkN4 w - - 0 1
bmreport
bmreport 8/8/8/8/8/8/8/KBkN4 w - - 0 1
go depth 8
```

`BadMannersMode` is a UCI combo option: `Off`, `Safe`, `Aggressive`, `Maximum`, or `Puzzle`.

## Build On Windows

```powershell
$env:PATH='C:\path\to\llvm-mingw\bin;C:\Progra~1\Git\usr\bin;' + $env:PATH
mingw32-make -C .\stockfish18-src\src -j4 build ARCH=x86-64-avx2 COMP=clang
```

## Test

```powershell
python .\scripts\source_smoke.py
```

The smoke test uses `.\stockfish18-src\src\stockfish.exe` when no
`.\dist\BadMannersStockfish18.exe` exists. Set `BAD_MANNERS_ENGINE` to test a
specific compiled executable. Set `STOCKFISH_BASELINE` when you also want
off-mode parity checked against a clean Stockfish 18 binary.

The smoke suite checks UCI startup, Bad Manners options, current-position and direct-FEN `bmreport`, terminal current-result labels, Syzygy WDL/DTZ proof-source reporting, fixed-depth pure-KBN mate verification with node/cache-hit reporting, bounded fixed-depth challenge-progress verification, bounded full-route-to-pure-KBNK verification, bounded complete-chain route-to-verified-KBN-mate verification, mate-delay disabled behavior on an immediate KBN mate, material-cleanup versus final-KBN state separation, forced queen-cleanup sacrifice into pure KBNK, fixed-depth route cleanup move selection, `RequirePureKBNFinal` reporting, current and after-move designated-survivor attack-risk reporting, immediate required underpromotion reporting and move selection, distinct stable-pawn feasibility when minors are missing, attacked promotion-pawn downgrade behavior, pure-KBN final material and phase reporting, after-move material and KBN phase output, after-move win-preservation source reporting for captures/sacrifices/promotions, pure-KBN worst defender reply output, immediate draw/stalemate-risk output, verbose opponent reply/survivor-risk output, a Bad Manners search, 30 challenge report positions, and Off-mode bestmove parity against the clean Stockfish 18 release build.
