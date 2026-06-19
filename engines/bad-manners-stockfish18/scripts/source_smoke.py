from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parent.parent
ENGINE = Path(os.environ.get("BAD_MANNERS_ENGINE", ROOT / "dist" / "BadMannersStockfish18.exe"))
if not ENGINE.exists():
    ENGINE = ROOT / "stockfish18-src" / "src" / "stockfish.exe"
BASELINE = Path(os.environ.get("STOCKFISH_BASELINE", ROOT / "stockfish18-baseline.exe"))
POSITIONS = ROOT / "source_test_positions.json"


def run_engine(exe: Path, commands: list[str], timeout: int = 60) -> str:
    proc = subprocess.run(
        [str(exe)],
        input="\n".join(commands + ["quit", ""]),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stdout)
    return proc.stdout


def bestmove(exe: Path, fen: str = "startpos") -> str:
    position = "position startpos" if fen == "startpos" else f"position fen {fen}"
    out = run_engine(exe, ["uci", "isready", position, "go depth 4"])
    for line in out.splitlines():
        if line.startswith("bestmove "):
            return line
    raise AssertionError(out)


def main() -> int:
    uci = run_engine(ENGINE, ["uci", "isready"])
    assert "id name Bad Manners Stockfish 18" in uci
    assert "option name BadMannersMode type combo" in uci
    assert "option name ChallengeVerificationDepth type spin" in uci
    assert "option name CompleteKBNVerificationDepth type spin" in uci
    assert "uciok" in uci
    assert "readyok" in uci

    if BASELINE.exists():
        clean_best = bestmove(BASELINE)
        mod_best = bestmove(ENGINE)
        assert clean_best == mod_best, (clean_best, mod_best)

    positions = json.loads(POSITIONS.read_text())
    for item in positions:
        fen = item["fen"]
        if fen == "startpos":
            continue
        out = run_engine(
            ENGINE,
            [
                "uci",
                "isready",
                "setoption name BadMannersMode value Puzzle",
                f"position fen {fen}",
                "bmreport",
            ],
        )
        assert "[KBN Challenge Report]" in out, item["name"]
        assert "Challenge state:" in out, item["name"]
        assert "Proof level:" in out, item["name"]
        assert "Tablebase DTZ:" in out, item["name"]
        assert "KBN fixed-depth verification:" in out, item["name"]
        assert "KBN fixed-depth cache hits:" in out, item["name"]
        assert "Challenge progress target:" in out, item["name"]
        assert "Challenge progress verification:" in out, item["name"]
        assert "Challenge progress nodes:" in out, item["name"]
        assert "Challenge progress cache hits:" in out, item["name"]
        assert "Full challenge route target:" in out, item["name"]
        assert "Full challenge route verification:" in out, item["name"]
        assert "Full challenge route nodes:" in out, item["name"]
        assert "Full challenge route cache hits:" in out, item["name"]
        assert "Complete challenge target:" in out, item["name"]
        assert "Complete challenge verification:" in out, item["name"]
        assert "Complete challenge nodes:" in out, item["name"]
        assert "Complete challenge cache hits:" in out, item["name"]
        assert "Pure KBN final required:" in out, item["name"]
        assert "Designated survivor attack risk:" in out, item["name"]

    direct_fen = positions[0]["fen"]
    direct_report = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            f"bmreport {direct_fen}",
        ],
    )
    assert "[KBN Challenge Report]" in direct_report
    assert f"FEN: {direct_fen}" in direct_report
    assert "Current result:" in direct_report
    assert "Current result source:" in direct_report
    assert "Tablebase DTZ:" in direct_report
    assert "Challenge progress verification:" in direct_report
    assert "Full challenge route verification:" in direct_report
    assert "Complete challenge verification:" in direct_report

    checkmate_report = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "bmreport 7k/6Q1/6K1/8/8/8/8/8 b - - 0 1",
        ],
    )
    assert "Current result: Losing" in checkmate_report
    assert "Challenge state: CHALLENGE_IMPOSSIBLE" in checkmate_report
    assert "Proof level: IMPOSSIBLE" in checkmate_report

    stalemate_report = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "bmreport 7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
        ],
    )
    assert "Current result: Drawing" in stalemate_report
    assert "Challenge state: CHALLENGE_IMPOSSIBLE" in stalemate_report
    assert "Proof level: IMPOSSIBLE" in stalemate_report

    underpromotion_report = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "bmreport 4k3/P7/8/8/8/8/8/KB6 w - - 0 1",
        ],
    )
    assert "Required promotion: Knight" in underpromotion_report
    assert "Immediate required underpromotions:" in underpromotion_report
    assert "Immediate required underpromotions: 1" in underpromotion_report
    assert "Immediate required underpromotion pawns: 1" in underpromotion_report
    assert "Proof level: VERIFIED_TO_FIXED_DEPTH" in underpromotion_report
    assert "Challenge progress target: CREATE_MISSING_MINORS" in underpromotion_report
    assert "Challenge progress verification: Forceable within depth 4" in underpromotion_report
    assert "Challenge progress first move: a7a8n" in underpromotion_report
    assert "Full challenge route target: REACH_PURE_KBNK" in underpromotion_report
    assert "Full challenge route verification: Forceable within depth 4" in underpromotion_report
    assert "Full challenge route first move: a7a8n" in underpromotion_report
    assert "Complete challenge target: REACH_VERIFIED_KBN_MATE" in underpromotion_report
    assert "Complete challenge verification: Not forceable within challenge depth 4 and KBN depth 2" in underpromotion_report

    two_missing_two_pawns = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "bmreport 4k3/8/8/8/8/8/PP6/K7 w - - 0 1",
        ],
    )
    assert "Required promotion: Bishop, Knight" in two_missing_two_pawns
    assert "Candidate promotion routes: 4" in two_missing_two_pawns
    assert "Distinct promotion pawns: 2" in two_missing_two_pawns
    assert "Stable promotion pawns: 2" in two_missing_two_pawns
    assert "Attacked promotion pawns: 0" in two_missing_two_pawns
    assert "Challenge state: PROMOTION_REQUIRED_AND_FORCEABLE" in two_missing_two_pawns
    assert "Full challenge route verification: Not forceable within depth 4" in two_missing_two_pawns

    two_missing_one_pawn = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "bmreport 4k3/8/8/8/8/8/P7/K7 w - - 0 1",
        ],
    )
    assert "Required promotion: Bishop, Knight" in two_missing_one_pawn
    assert "Candidate promotion routes: 2" in two_missing_one_pawn
    assert "Distinct promotion pawns: 1" in two_missing_one_pawn
    assert "Stable promotion pawns: 1" in two_missing_one_pawn
    assert "Challenge state: ONLY_PARTIAL_SACRIFICE_PLAN_FORCEABLE" in two_missing_one_pawn
    assert "Proof level: UNPROVEN" in two_missing_one_pawn

    attacked_promotion_pawn = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "bmreport 4k3/8/8/8/8/1b6/P7/KB6 w - - 0 1",
        ],
    )
    assert "Required promotion: Knight" in attacked_promotion_pawn
    assert "Candidate promotion routes: 1" in attacked_promotion_pawn
    assert "Distinct promotion pawns: 1" in attacked_promotion_pawn
    assert "Stable promotion pawns: 0" in attacked_promotion_pawn
    assert "Attacked promotion pawns: 1" in attacked_promotion_pawn
    assert "Challenge state: ONLY_PARTIAL_SACRIFICE_PLAN_FORCEABLE" in attacked_promotion_pawn

    underpromotion_search = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Maximum",
            "setoption name VerboseChallengeOutput value true",
            "position fen 4k3/P7/8/8/8/8/8/KB6 w - - 0 1",
            "go depth 4",
        ],
    )
    assert "Bad Manners selected a7a8n" in underpromotion_search
    assert "stable promotion pawns" in underpromotion_search
    assert "immediate underpromotion pawns" in underpromotion_search
    assert "after move pure KBNK yes" in underpromotion_search
    assert "after move win preserved yes" in underpromotion_search
    assert "after move win source PureKBNFinal" in underpromotion_search
    assert "root score safe no" in underpromotion_search
    assert "after move pure KBN win likely yes" in underpromotion_search
    assert "bestmove a7a8n" in underpromotion_search

    enemy_rook_cleanup = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Maximum",
            "setoption name VerboseChallengeOutput value true",
            "position fen 2k5/8/8/8/8/8/2r5/NBQ2K2 w - - 0 1",
            "go depth 8",
        ],
    )
    assert "Bad Manners selected a1c2" in enemy_rook_cleanup
    assert "after move enemy pieces 0" in enemy_rook_cleanup
    assert "after move win preserved yes" in enemy_rook_cleanup
    assert "after move win source SafeEnemyCleanupCapture" in enemy_rook_cleanup
    assert "bestmove a1c2" in enemy_rook_cleanup

    screenshot_conversion = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Maximum",
            "setoption name VerboseChallengeOutput value true",
            "position fen 8/6B1/8/6k1/R5p1/1p1B2P1/1P4KP/8 w - - 0 1",
            "go depth 8",
        ],
    )
    assert "bestmove a4a5" not in screenshot_conversion
    assert "bestmove h2h3" not in screenshot_conversion
    assert "bestmove a4g4" in screenshot_conversion
    assert "challenge PROMOTION_REQUIRED_AND_FORCEABLE" in screenshot_conversion

    final_kbn_report = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "bmreport 8/8/8/8/3N4/2B1K3/8/7k w - - 0 1",
        ],
    )
    assert "Challenge state: COMPLETE_KBN_MATE_LIKELY" in final_kbn_report
    assert "Material cleanup required: No" in final_kbn_report
    assert "Pure KBN final required: Yes" in final_kbn_report
    assert "Pure KBN final satisfied: Yes" in final_kbn_report
    assert "Current material goal: DELIVER_KBN_MATE" in final_kbn_report
    assert "Correct mating corners: a1 and h8" in final_kbn_report
    assert "KBN phase:" in final_kbn_report
    assert "Final KBN tablebase proof:" in final_kbn_report
    assert "KBN fixed-depth verification:" in final_kbn_report
    assert "Complete challenge target: REACH_VERIFIED_KBN_MATE" in final_kbn_report
    assert "Complete challenge verification:" in final_kbn_report

    mate_in_one_report = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "setoption name KBNVerificationDepth value 2",
            "bmreport 8/8/8/8/8/8/8/kBK1N3 w - - 0 1",
        ],
    )
    assert "Challenge state: COMPLETE_KBN_MATE_LIKELY" in mate_in_one_report
    assert "Proof level: PROVEN_BY_FORCED_MATE_SEARCH" in mate_in_one_report
    assert "KBN fixed-depth verification: Forced mate in 1 ply within depth 2" in mate_in_one_report
    assert "KBN fixed-depth cache hits:" in mate_in_one_report
    assert "Complete challenge target: REACH_VERIFIED_KBN_MATE" in mate_in_one_report
    assert "Complete challenge verification: Forceable within challenge depth 0 and KBN depth 2" in mate_in_one_report

    no_mate_delay_search = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Maximum",
            "setoption name VerboseChallengeOutput value true",
            "setoption name AllowMateDelay value false",
            "position fen 8/8/8/8/8/8/8/kBK1N3 w - - 0 1",
            "go depth 4",
        ],
    )
    assert "Bad Manners selected e1c2" in no_mate_delay_search
    assert "after move KBN phase DELIVER_MATE" in no_mate_delay_search
    assert "bestmove e1c2" in no_mate_delay_search

    extra_friendly_report = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "bmreport 4k3/8/8/8/8/8/8/KBQN3 w - - 0 1",
        ],
    )
    assert "Challenge state: MATERIAL_CLEANUP_REQUIRED" in extra_friendly_report
    assert "Unnecessary friendly pieces remaining: 1" in extra_friendly_report
    assert "Enemy pieces remaining: 0" in extra_friendly_report
    assert "Material cleanup required: Yes" in extra_friendly_report
    assert "Pure KBN final required: Yes" in extra_friendly_report
    assert "Pure KBN final satisfied: No" in extra_friendly_report
    assert "Current material goal: SACRIFICE_QUEEN" in extra_friendly_report

    fixed_depth_cleanup_search = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Maximum",
            "setoption name VerboseChallengeOutput value true",
            "position fen 4k3/8/8/8/8/8/8/KBQN4 w - - 0 1",
            "go depth 4",
        ],
    )
    assert "Bad Manners selected c1c7" in fixed_depth_cleanup_search
    assert "proof VERIFIED_TO_FIXED_DEPTH" in fixed_depth_cleanup_search
    assert "after move win source FixedDepthRoute" in fixed_depth_cleanup_search
    assert "root score safe no" in fixed_depth_cleanup_search
    assert "bestmove c1c7" in fixed_depth_cleanup_search

    forced_queen_sacrifice_search = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Maximum",
            "setoption name VerboseChallengeOutput value true",
            "position fen 4k3/8/8/8/8/8/4Q3/KB1N4 w - - 0 1",
            "go depth 4",
        ],
    )
    assert "Bad Manners selected e2e7" in forced_queen_sacrifice_search
    assert "after move win source SafeCleanupSacrifice" in forced_queen_sacrifice_search
    assert "opponent safe sacrifice captures 1" in forced_queen_sacrifice_search
    assert "safe sacrifice captures reach pure KBNK 1" in forced_queen_sacrifice_search
    assert "unsafe sacrifice capture results 0" in forced_queen_sacrifice_search
    assert "forced sacrifice yes" in forced_queen_sacrifice_search
    assert "bestmove e2e7" in forced_queen_sacrifice_search

    pure_final_disabled_report = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "setoption name RequirePureKBNFinal value false",
            "bmreport 4k3/8/8/8/8/8/8/KBQN3 w - - 0 1",
        ],
    )
    assert "Pure KBN final required: No" in pure_final_disabled_report
    assert "Pure KBN final satisfied: No" in pure_final_disabled_report

    enemy_material_report = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "bmreport 4k2q/8/8/8/8/8/8/KBN5 w - - 0 1",
        ],
    )
    assert "Challenge state: MATERIAL_CLEANUP_REQUIRED" in enemy_material_report
    assert "Unnecessary friendly pieces remaining: 0" in enemy_material_report
    assert "Enemy pieces remaining: 1" in enemy_material_report
    assert "Material cleanup required: Yes" in enemy_material_report
    assert "Current material goal: REMOVE_ENEMY_MAJOR_PIECES" in enemy_material_report

    attacked_knight_report = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "bmreport 4k3/8/8/8/8/8/2q5/KBN5 w - - 0 1",
        ],
    )
    assert "Designated knight attackers: 1" in attacked_knight_report
    assert "Designated survivor attack risk: Yes" in attacked_knight_report

    attacked_bishop_report = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Puzzle",
            "bmreport 4k3/8/8/8/8/8/1q6/KBN5 w - - 0 1",
        ],
    )
    assert "Designated bishop attackers: 1" in attacked_bishop_report
    assert "Designated survivor attack risk: Yes" in attacked_bishop_report

    bad = run_engine(
        ENGINE,
        [
            "uci",
            "isready",
            "setoption name BadMannersMode value Maximum",
            "setoption name VerboseChallengeOutput value true",
            "position fen 8/8/8/8/8/8/8/KBkN4 w - - 0 1",
            "go depth 4",
        ],
    )
    assert "Bad Manners selected" in bad
    assert "after move unnecessary friendly" in bad
    assert "after move enemy pieces" in bad
    assert "after move pure KBNK" in bad
    assert "after move bishop attackers" in bad
    assert "after move knight attackers" in bad
    assert "after move win preserved yes" in bad
    assert "after move win source" in bad
    assert "root score safe" in bad
    assert "after move pure KBN win likely" in bad
    assert "current survivor attack risk" in bad
    assert "after move KBN phase" in bad
    assert "KBN worst reply legal replies" in bad
    assert "KBN worst reply phase" in bad
    assert "KBN worst reply score" in bad
    assert "opponent legal replies" in bad
    assert "immediate stalemate risk" in bad
    assert "immediate draw risk" in bad
    assert "opponent safe sacrifice captures" in bad
    assert "survivor capture risk" in bad
    assert "required pawn capture risk" in bad
    assert "bestmove " in bad
    print("source_smoke_ok")
    print(f"off_mode_bestmove={mod_best}")
    print(f"positions_checked={len(positions) - 1}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
