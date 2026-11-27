from __future__ import annotations

import os
from pathlib import Path

import chess
import chess.engine


ROOT = Path(__file__).resolve().parent.parent
ENGINE = Path(os.environ.get("BAD_MANNERS_ENGINE", ROOT / "dist" / "BadMannersStockfish19.exe"))
EXPECTED_VARIANTS = ["Off", "Safe", "Aggressive", "Maximum", "Puzzle"]


def main() -> int:
    engine = chess.engine.SimpleEngine.popen_uci(str(ENGINE), timeout=20)
    try:
        option = engine.options["BadMannersMode"]
        assert option.type == "combo"
        assert option.default == "Off"
        assert option.var == EXPECTED_VARIANTS

        engine.configure({"BadMannersMode": "Maximum"})
        engine.configure({"BadMannersMode": "Off"})

        board = chess.Board()
        result = engine.play(board, chess.engine.Limit(depth=4))
        assert result.move in board.legal_moves
    finally:
        engine.quit()

    print("strict_uci_smoke_ok")
    print("default=Off")
    print(f"variants={','.join(EXPECTED_VARIANTS)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
