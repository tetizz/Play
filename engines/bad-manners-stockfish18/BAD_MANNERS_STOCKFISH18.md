# Bad Manners Stockfish 18

This folder now contains a real C++ Stockfish 18 release fork, not the earlier wrapper approach.

## Source

- Official source tag: `sf_18`
- Commit: `cb3d4ee9b47d0c5aae855b12379378ea1439675c`
- Modified source tree: `stockfish18-src`
- Clean baseline executable built before modification: `stockfish18-baseline.exe`
- Final executable: `dist\BadMannersStockfish18.exe`

## Integrated Files

- `stockfish18-src\src\bad_manners.cpp`
- `stockfish18-src\src\bad_manners.h`
- `stockfish18-src\src\engine.cpp`
- `stockfish18-src\src\engine.h`
- `stockfish18-src\src\search.cpp`
- `stockfish18-src\src\uci.cpp`
- `stockfish18-src\src\Makefile`

## UCI Additions

The engine still uses Stockfish 18 NNUE, search, move generation, transposition tables, multithreading, and Syzygy code. Bad Manners mode is an optional UCI combo option and defaults off.

```text
BadMannersMode = Off | Safe | Aggressive | Maximum | Puzzle
KBNMateChallenge
RequirePureKBNFinal
PromoteMissingMinor
SacrificeAllOtherPieces
PreserveForcedWin
PreferForcedSacrifices
UseKBNTablebase
KBNVerificationDepth
ChallengeVerificationDepth
CompleteKBNVerificationDepth
ChallengePlanningDepth
MinimumSafeEvaluation
AllowMateDelay
MaximumAllowedMateDelay
RespectFiftyMoveRule
VerboseChallengeOutput
```

`bmreport` is a non-standard diagnostic command that emits `[KBN Challenge Report]` through UCI `info string` lines. It works on the current engine position or on a FEN supplied directly:

```text
bmreport
bmreport 8/8/8/8/8/8/8/KBkN4 w - - 0 1
```

When Bad Manners mode is enabled, the search internally widens the root candidate set up to the configured `ChallengePlanningDepth`, capped at 24 moves. This lets the challenge layer compare already-searched sacrifice, underpromotion, and KBN plan candidates while preserving normal Stockfish behavior when `BadMannersMode=Off`.

`ChallengeVerificationDepth` controls bounded adversarial verification for non-final challenge positions. The first pass verifies the next milestone: if a required bishop or knight is missing, the target is `CREATE_MISSING_MINORS`; otherwise the target is `REACH_PURE_KBNK`. A second full-route pass always targets `REACH_PURE_KBNK`, so missing-minor positions can distinguish "the next promotion is forceable" from "the entire route to pure KBNK is forceable within depth." A third complete-chain pass targets `REACH_VERIFIED_KBN_MATE`: it must force the route to pure KBNK and then prove a KBN mate from that reached position within `CompleteKBNVerificationDepth`. The complete-chain leaf check uses Syzygy WDL when tablebases are available and otherwise falls back to the bounded KBN mate verifier. Pure KBNK positions also populate the complete-chain fields directly from their fixed-depth KBN proof or Syzygy result. These passes treat the Bad Manners side as the attacker, require one attacking move that survives every defender reply to the configured depth, prune local draws/losses and available tablebase refutations, and report nodes, cache hits, truncation, target, and first forcing move. When the relevant verifier succeeds, the proof level for material cleanup or promotion setup becomes `VERIFIED_TO_FIXED_DEPTH`, and the first verified full-route or complete-chain move can be selected even if normal Stockfish did not assign it a root score.

Challenge-progress moves are now gated by an explicit after-move win-preservation check. A candidate sacrifice, enemy capture, pawn advance, or bishop/knight underpromotion is rejected when Syzygy says the resulting side-to-move is not losing for the opponent, when it creates an immediate local draw, or when the normal root score falls below `MinimumSafeEvaluation`. The main exception to a missing root score is a clean transition into pure KBNK: it must avoid immediate draw, preserve the bishop and knight against legal opponent capture, and keep the 50-move counter below the high-risk threshold. A second narrow exception allows forced cleanup sacrifices when accepting the sacrificed non-designated piece reaches pure KBNK, no accepted sacrifice leads to an unsafe result, and the bishop/knight/promotion pawn cannot be captured. A third exception accepts the first move from the bounded complete-chain verifier and labels it `FixedDepthComplete`; if that is unavailable, the first move from the full-route verifier is accepted as `FixedDepthRoute`. Verbose output reports `after move win preserved`, `after move win source`, `root score safe`, optional after-move tablebase WDL, pure-KBN final likelihood, and whether accepted sacrifices reach pure KBNK. If every challenge candidate fails this gate, verbose output says `Bad Manners did not override; normal best ...` instead of claiming the fallback move was challenge-selected.

Enemy-material cleanup captures now have their own in-engine safety exception when Syzygy files are not loaded. If a move captures opposing material, reduces the enemy non-king piece count, keeps the designated bishop and knight alive, does not increase unnecessary friendly material, and gives the opponent no legal capture of the designated survivors or required promotion pawn, the C++ challenge layer can preserve and select it with `after move win source SafeEnemyCleanupCapture`. This prevents the engine from depending on normal Stockfish ranking to find obvious rook/queen cleanup captures before starting surplus disposal and the final KBNK mate.

`bmreport` now separates material cleanup from final KBN readiness. Positions that already contain the chosen bishop and knight but still have extra friendly pieces or enemy material are labeled `MATERIAL_CLEANUP_REQUIRED`, not `COMPLETE_KBN_MATE_LIKELY`. The report shows `Material cleanup required: Yes/No`, remaining unnecessary friendly pieces, remaining enemy pieces, and the next material goal such as `SACRIFICE_QUEEN` or `REMOVE_ENEMY_MAJOR_PIECES`.

`RequirePureKBNFinal` is now enforced and reported. `bmreport` prints whether the pure KBN final is required and whether it is already satisfied. During root ranking, if this option is true, Bad Manners rejects an immediate checkmate candidate unless the move has already reached pure KBNK, preventing the challenge layer from accepting an early mate with extra friendly or enemy material still on the board.

In pure king, bishop, and knight versus king positions, Bad Manners now adds a fallback KBN phase score over searched root moves when Syzygy is not available. The fallback prefers moving the defending king toward the bishop-colored corners, forcing it to the edge, improving attacking-king opposition, reducing legal flight squares, and avoiding high 50-move-counter risk. It also labels the current KBN plan phase as `CENTRALIZE_KING`, `DRIVE_TO_EDGE`, `DRIVE_FROM_WRONG_CORNER`, `FORCE_CORRECT_CORNER`, `TIGHTEN_MATE_NET`, or `DELIVER_MATE` in `bmreport`, and verbose search output reports the after-move KBN phase when a candidate reaches pure KBNK. Pure-KBN ranking now also evaluates every legal defender reply after a candidate move and adds the worst resulting KBN geometry score, so the heuristic is biased toward progress that survives the opponent's strongest immediate defense. It does not override exact Syzygy ranking when tablebase information is available, and it does not rank root moves that Stockfish left unsearched.

For sacrifice candidates, the ranking layer now performs a one-ply opponent reply inspection after the candidate move. It counts legal opponent captures of non-designated material, counts refusal moves, detects whether every reply is a safe sacrifice capture, and penalizes candidates that let the opponent capture the designated bishop, designated knight, or newly promoted required minor. It also checks accepted sacrifice replies to see whether they reach pure KBNK. Verbose output includes these counts so the engine is not silently rewarding unverified material loss.

`bmreport` now also reports current survivor danger before any candidate move is chosen. It prints attacker counts for the designated bishop and designated knight plus a combined `Designated survivor attack risk` flag. Candidate ranking simulates the post-move designated survivor squares, rewards reductions in bishop/knight attackers, and penalizes moves that leave the survivors attacked. Verbose search output repeats the current survivor-risk flag and reports after-move bishop/knight attacker counts so selected moves are interpreted with survivor safety in view.

For missing-minor positions, the planner now reports immediate legal required underpromotions and ranks pawn progress toward the needed bishop or knight. A pawn move toward promotion is rewarded when it shortens the promotion distance, opens a clear lane, or reaches the sixth/seventh rank; queen/rook promotions are penalized while the required minor is still missing. The opponent-reply inspection also flags when a required promotion pawn can be captured.

Promotion forceability now separates clear lanes from stable promotion evidence. `bmreport` shows route count, distinct promotion pawns, stable promotion pawns, attacked promotion pawns, immediate required underpromotions, and distinct immediate underpromotion pawns. A missing-minor position is labeled `PROMOTION_REQUIRED_AND_FORCEABLE` only when enough distinct promotion pawns are stable, or when enough distinct immediate required-underpromotion pawns already exist. Clear but currently attacked promotion pawns are reported as partial/unproven rather than forceable.

When both bishop and knight are missing, the report now distinguishes promotion routes from distinct promotion pawns. A single pawn with both `=B` and `=N` route choices is not enough to create both required pieces, so that case is labeled as only a partial/unproven challenge rather than `PROMOTION_REQUIRED_AND_FORCEABLE`.

`bmreport` now separates current chess result from challenge feasibility. Terminal positions are classified locally as winning/drawing/losing from the side to move, and Syzygy WDL is reported when an actual tablebase probe succeeds. If no tablebase result is available and the position is not terminal or drawn by local rules, the current result remains `Unknown`; this avoids implying proof from NNUE evaluation alone.

When Syzygy files are loaded, Bad Manners also attempts a DTZ probe and reports `Tablebase DTZ` plus `Final KBN tablebase proof`. This keeps the final KBN proof evidence explicit: pure WDL proves the game result, and WDL+DTZ gives stronger 50-move-aware tablebase progress evidence when DTZ tables are present. Without tablebase files, these lines report `Unavailable` rather than pretending the fallback heuristic is a proof.

`KBNVerificationDepth` is now wired into a bounded adversarial pure-KBN mate verifier. In pure KBNK positions, `bmreport` searches legal move trees up to the configured ply depth: the attacking side only needs one winning move, while the defending side must have every legal reply still lose. The verifier uses a local transposition cache keyed by Stockfish's position key and remaining depth, and reports both searched nodes and cache hits. If this proves mate within the depth, the proof level becomes `PROVEN_BY_FORCED_MATE_SEARCH`; otherwise the report says no forced mate was found within the depth and notes whether the node cap truncated the verification. This is fixed-depth proof only, not a replacement for Syzygy full-tablebase proof.

Challenge forceability is now gated by that current result. If the current position is already drawing or losing under local rules or Syzygy WDL, the challenge is reported as `CHALLENGE_IMPOSSIBLE` with `IMPOSSIBLE` proof. Cursed-win and blessed-loss tablebase outcomes respect the `RespectFiftyMoveRule` option.

Selected moves are rejected if they immediately stalemate the opponent or trigger a local draw state. Verbose output reports the opponent legal reply count plus immediate stalemate and draw risk, so material-removal moves are not silently allowed to ruin the win.

`AllowMateDelay` and `MaximumAllowedMateDelay` are now enforced during Bad Manners root reordering. When Stockfish's normal searched root set contains a forced mate, Bad Manners rejects candidates that are not also mating, or that delay the mate beyond the configured ply window. With `AllowMateDelay=false`, only equal-or-faster mating candidates are allowed through the Bad Manners ranking gate.

Selected moves are also scored against the challenge material state after the move. The verbose explanation reports the resulting unnecessary friendly piece count, enemy piece count, and whether the move reaches pure KBNK. When an immediate required minor underpromotion is legal, wrong promotions are rejected in Bad Manners mode; for example, a missing-knight position with `a7-a8` available selects `a8=N` rather than defaulting to queen promotion.

## Build

```powershell
$env:PATH='C:\Users\adria\Downloads\BadMannersStockfish\toolchain\llvm-mingw-20260602-ucrt-x86_64\bin;C:\Progra~1\Git\usr\bin;' + $env:PATH
mingw32-make -C C:\Users\adria\Downloads\BadMannersStockfish\stockfish18-src\src -j4 build ARCH=x86-64-avx2 COMP=clang
```

## Verification

```powershell
python C:\Users\adria\Downloads\BadMannersStockfish\scripts\source_smoke.py
```

Verified behavior:

- UCI startup exposes `id name Bad Manners Stockfish 18`.
- Bad Manners options are present.
- `bmreport` works on KBN challenge positions.
- `bmreport <fen>` works without first changing the engine position.
- Bad Manners mode expands internal root candidates for challenge-aware move selection.
- `bmreport` reports bounded challenge-progress verification, full-route-to-pure-KBNK verification, and complete-chain route-to-verified-KBN-mate verification for non-final promotion and cleanup milestones.
- Positions with extra friendly material or enemy material report `MATERIAL_CLEANUP_REQUIRED`.
- `RequirePureKBNFinal` reports pure-final satisfaction and rejects non-pure immediate mates in Bad Manners ranking.
- Pure KBN reports identify `DELIVER_KBN_MATE`, the bishop color, the correct mating corners, and the current KBN phase.
- Pure KBN fallback ranking only accepts missing-score moves when the after-move pure KBN final passes the win-preservation check.
- Pure KBN fallback ranking scores the worst legal defender reply after each candidate move.
- Verbose Bad Manners output reports one-ply opponent sacrifice/refusal, accepted-sacrifice pure-KBNK checks, and survivor-capture checks.
- Verbose Bad Manners output reports after-move win preservation, the evidence source, root-score safety, optional tablebase WDL, and pure-KBN final likelihood.
- `bmreport` reports current designated bishop/knight attacker counts and survivor attack risk.
- Bad Manners ranking scores after-move designated bishop/knight attacker counts.
- Missing-minor reports include immediate required underpromotion counts, and ranking rewards progress toward the needed bishop or knight.
- Missing-minor and material-cleanup positions can upgrade to `VERIFIED_TO_FIXED_DEPTH` when `ChallengeVerificationDepth` proves the next milestone or the full route to pure KBNK against every defender reply within depth.
- Missing-minor reports distinguish stable and attacked promotion pawns before labeling a promotion plan forceable.
- Immediate required underpromotions are preferred over queen/rook promotion and can be verified by `bestmove a7a8n` in the smoke suite.
- Positions missing both bishop and knight require two distinct promotion pawns before being labeled promotion-forceable.
- Verbose Bad Manners output reports after-move unnecessary friendly material, enemy material, and pure-KBNK transition state.
- Verbose Bad Manners output reports the after-move KBN phase when a selected move reaches pure KBNK.
- Verbose Bad Manners output reports the worst legal KBN defender reply, its phase, and its score.
- `bmreport` reports current-result source and only uses Syzygy proof labels after a successful tablebase probe.
- `bmreport` reports Syzygy DTZ and final KBN proof source when available.
- `bmreport` uses `KBNVerificationDepth` to prove short pure-KBN mates against every legal defender reply when possible.
- Fixed-depth KBN verification reports searched nodes and local cache hits.
- Drawn or lost current positions cannot be labeled as forceable challenge positions.
- Bad Manners ranking rejects immediate stalemate/local-draw moves and reports this draw-risk check in verbose output.
- Bad Manners root ranking respects `AllowMateDelay` and `MaximumAllowedMateDelay` when normal Stockfish search has found a forced mate.
- `BadMannersMode=Off` fixed-depth best move matches the clean Stockfish 18 release binary.
- The final executable returns legal UCI `bestmove` output in Bad Manners mode.

## Proof Boundary

The code distinguishes tablebase proof, bounded forced-mate proof, and heuristic challenge progress. It does not falsely claim a full game-tree proof outside the available search/tablebase horizon. In positions outside Syzygy coverage and outside the fixed-depth verification horizon, reports use `HIGH_CONFIDENCE_HEURISTIC` or `UNPROVEN` rather than claiming forced perfection.
