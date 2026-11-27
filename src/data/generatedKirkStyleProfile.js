// Generated from the same public games as generatedRecentKirkRepertoireBook.js.
// This compact profile lets the runtime preserve Kirk's recurring plans outside exact book positions.
// Sources: chess.com:Mrlovechess432=373, lichess:Coachkirk432=900.
// Generated at 2026-11-27T03:41:41.879Z.
// Do not edit by hand; run npm run build:repertoires.
export const GENERATED_KIRK_STYLE_PROFILE = {
  "generatedAt": "2026-11-27T03:41:41.879Z",
  "sourceCoverage": [
    {
      "site": "chess.com",
      "username": "Mrlovechess432",
      "acceptedGames": 373,
      "skippedGames": 0,
      "earliestPlayedAt": "2021-07-06T05:43:37.000Z",
      "latestPlayedAt": "2025-05-28T16:16:40.000Z"
    },
    {
      "site": "lichess",
      "username": "Coachkirk432",
      "acceptedGames": 900,
      "skippedGames": 0,
      "earliestPlayedAt": "2026-03-29T01:57:27.000Z",
      "latestPlayedAt": "2026-11-26T08:52:16.000Z"
    }
  ],
  "sampleSize": 1273,
  "recentWeight": 578.521,
  "sources": {
    "chess.com": {
      "games": 373,
      "recentWeight": 1.852
    },
    "lichess": {
      "games": 900,
      "recentWeight": 576.669
    }
  },
  "byColor": {
    "white": {
      "games": 633,
      "recentWeight": 287.994,
      "results": {
        "wins": 312,
        "losses": 300,
        "draws": 21
      },
      "motifWeights": {
        "capture": 0.229,
        "check": 0.062,
        "castle": 0.029,
        "pawnPush": 0.267,
        "queenMove": 0.127,
        "rookMove": 0.156,
        "kingMove": 0.106,
        "flankPawn": 0.09,
        "center": 0.183,
        "development": 0.087,
        "earlyQueen": 0.011
      },
      "pieceSquareWeights": {
        "p:e4": 1,
        "p:d4": 0.956,
        "n:f3": 0.941,
        "n:c3": 0.747,
        "k:g1": 0.676,
        "p:d5": 0.368,
        "b:d3": 0.324,
        "b:c4": 0.276,
        "n:d4": 0.276,
        "p:e5": 0.265,
        "b:g5": 0.25,
        "p:c3": 0.242,
        "b:b5": 0.208,
        "p:c4": 0.176,
        "b:e3": 0.176,
        "p:h3": 0.155,
        "b:e2": 0.154,
        "r:e1": 0.14,
        "q:d4": 0.132,
        "p:a3": 0.108,
        "q:e2": 0.105,
        "k:c1": 0.102,
        "q:d2": 0.101,
        "n:d2": 0.093,
        "n:e2": 0.093,
        "p:d3": 0.081,
        "n:e5": 0.079,
        "n:c6": 0.078,
        "b:f4": 0.075,
        "n:b3": 0.07,
        "n:e4": 0.068,
        "p:c5": 0.062,
        "q:d3": 0.062,
        "p:a4": 0.06,
        "p:f3": 0.06,
        "b:c6": 0.059
      },
      "favoritePieceSetups": [
        {
          "key": "p:e4",
          "weight": 284.932
        },
        {
          "key": "p:d4",
          "weight": 272.384
        },
        {
          "key": "n:f3",
          "weight": 268.097
        },
        {
          "key": "n:c3",
          "weight": 212.82
        },
        {
          "key": "k:g1",
          "weight": 192.592
        },
        {
          "key": "p:d5",
          "weight": 104.833
        },
        {
          "key": "b:d3",
          "weight": 92.397
        },
        {
          "key": "b:c4",
          "weight": 78.708
        },
        {
          "key": "n:d4",
          "weight": 78.543
        },
        {
          "key": "p:e5",
          "weight": 75.515
        },
        {
          "key": "b:g5",
          "weight": 71.309
        },
        {
          "key": "p:c3",
          "weight": 69.082
        }
      ],
      "openingLines": [
        {
          "key": "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5",
          "weight": 18.26
        },
        {
          "key": "e4 c6 d4 d5 e5 Bf5 Bd3 Bxd3",
          "weight": 10.866
        },
        {
          "key": "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nxd4",
          "weight": 7.793
        },
        {
          "key": "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6",
          "weight": 5.736
        },
        {
          "key": "e4 c5 Nc3 e6 d4 cxd4 Qxd4 a6",
          "weight": 5.484
        },
        {
          "key": "e4 c5 Nc3 e6 d4 cxd4 Qxd4 Nc6",
          "weight": 4.79
        },
        {
          "key": "e4 e6 d4 d5 e5 c5 c3 Nc6",
          "weight": 4.485
        },
        {
          "key": "e4 c5 Nc3 Nc6 Bb5 Nd4 Bc4 e6",
          "weight": 3.737
        },
        {
          "key": "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4",
          "weight": 3.715
        },
        {
          "key": "e4 c5 Nc3 d6 d4 cxd4 Qxd4 Nf6",
          "weight": 3.142
        }
      ],
      "commonPawnStructures": [
        {
          "key": "a2-b2-c2-e4-f2-g2-h2",
          "weight": 79.217
        },
        {
          "key": "a2-b2-c2-d4-f2-g2-h2",
          "weight": 52.595
        },
        {
          "key": "a2-b2-c2-d4-e5-f2-g2-h2",
          "weight": 21.607
        },
        {
          "key": "a2-b2-c4-e4-f2-g2-h2",
          "weight": 10.278
        },
        {
          "key": "a2-b2-c2-d2-f2-g2-h2",
          "weight": 9.649
        },
        {
          "key": "a2-b2-c2-d4-e4-f2-g2-h2",
          "weight": 9.265
        },
        {
          "key": "a2-b2-c2-d2-e4-f2-g2-h2",
          "weight": 7.972
        },
        {
          "key": "a2-b2-c2-e5-f2-g2-h2",
          "weight": 6.601
        },
        {
          "key": "a2-b3-c2-e4-f2-g2-h2",
          "weight": 6.017
        },
        {
          "key": "a2-b2-c4-d5-e4-f2-g2-h2",
          "weight": 5.495
        }
      ],
      "timeControls": [
        {
          "key": "bullet",
          "weight": 188.651
        },
        {
          "key": "blitz",
          "weight": 98.76
        },
        {
          "key": "unknown",
          "weight": 0.584
        }
      ],
      "endgameHabits": {
        "positions": 800.619,
        "kingMoveRate": 0.403,
        "pawnMoveRate": 0.2,
        "captureRate": 0.144,
        "checkRate": 0.102
      }
    },
    "black": {
      "games": 640,
      "recentWeight": 290.527,
      "results": {
        "wins": 313,
        "losses": 305,
        "draws": 22
      },
      "motifWeights": {
        "capture": 0.236,
        "check": 0.068,
        "castle": 0.026,
        "pawnPush": 0.27,
        "queenMove": 0.125,
        "rookMove": 0.161,
        "kingMove": 0.111,
        "flankPawn": 0.095,
        "center": 0.154,
        "development": 0.086,
        "earlyQueen": 0.005
      },
      "pieceSquareWeights": {
        "n:f6": 1,
        "n:c6": 0.887,
        "p:d5": 0.858,
        "p:e5": 0.777,
        "k:g8": 0.611,
        "p:d4": 0.435,
        "b:c5": 0.368,
        "p:c5": 0.354,
        "p:e6": 0.328,
        "b:g4": 0.267,
        "p:d6": 0.261,
        "b:b4": 0.251,
        "b:e7": 0.246,
        "p:c6": 0.238,
        "p:c4": 0.219,
        "p:a6": 0.185,
        "b:e6": 0.184,
        "b:d6": 0.179,
        "n:e4": 0.173,
        "p:h6": 0.15,
        "b:f5": 0.117,
        "n:d7": 0.102,
        "r:e8": 0.099,
        "n:d5": 0.098,
        "p:e4": 0.094,
        "b:b6": 0.086,
        "p:b5": 0.085,
        "p:g6": 0.079,
        "b:h5": 0.077,
        "n:e7": 0.07,
        "n:e5": 0.069,
        "b:d7": 0.066,
        "q:b6": 0.066,
        "q:d7": 0.062,
        "q:f6": 0.061,
        "q:e7": 0.06
      },
      "favoritePieceSetups": [
        {
          "key": "n:f6",
          "weight": 262.718
        },
        {
          "key": "n:c6",
          "weight": 232.902
        },
        {
          "key": "p:d5",
          "weight": 225.47
        },
        {
          "key": "p:e5",
          "weight": 204.176
        },
        {
          "key": "k:g8",
          "weight": 160.391
        },
        {
          "key": "p:d4",
          "weight": 114.268
        },
        {
          "key": "b:c5",
          "weight": 96.763
        },
        {
          "key": "p:c5",
          "weight": 92.892
        },
        {
          "key": "p:e6",
          "weight": 86.248
        },
        {
          "key": "b:g4",
          "weight": 70.163
        },
        {
          "key": "p:d6",
          "weight": 68.498
        },
        {
          "key": "b:b4",
          "weight": 66.015
        }
      ],
      "openingLines": [
        {
          "key": "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6",
          "weight": 14.767
        },
        {
          "key": "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6",
          "weight": 12.519
        },
        {
          "key": "e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6",
          "weight": 8.701
        },
        {
          "key": "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6",
          "weight": 6.592
        },
        {
          "key": "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4",
          "weight": 5.865
        },
        {
          "key": "e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4",
          "weight": 4.966
        },
        {
          "key": "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6",
          "weight": 4.493
        },
        {
          "key": "e4 e5 Nf3 Nc6 Bc4 Bc5 Nc3 Nf6",
          "weight": 3.922
        },
        {
          "key": "e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4",
          "weight": 3.892
        },
        {
          "key": "e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6",
          "weight": 3.472
        }
      ],
      "commonPawnStructures": [
        {
          "key": "a7-b7-c7-d6-e5-f7-g7-h7",
          "weight": 19.992
        },
        {
          "key": "a7-b7-c7-d7-f7-g7-h7",
          "weight": 19.184
        },
        {
          "key": "a7-b7-c7-d5-f7-g7-h7",
          "weight": 17.892
        },
        {
          "key": "a7-b7-c5-d5-e6-f7-g7-h7",
          "weight": 17.484
        },
        {
          "key": "a7-b7-c7-d7-e5-f7-g7-h7",
          "weight": 13.045
        },
        {
          "key": "a7-b7-c7-e5-f7-g7-h7",
          "weight": 10.803
        },
        {
          "key": "a7-b7-c5-e6-f7-g7-h7",
          "weight": 10.23
        },
        {
          "key": "a6-b7-c7-d7-e5-f7-g7-h7",
          "weight": 8.706
        },
        {
          "key": "a7-c6-c7-d7-f7-g7-h7",
          "weight": 7.831
        },
        {
          "key": "a7-b7-c7-d6-f7-g7-h7",
          "weight": 7.402
        }
      ],
      "timeControls": [
        {
          "key": "bullet",
          "weight": 193.322
        },
        {
          "key": "blitz",
          "weight": 97.204
        }
      ],
      "endgameHabits": {
        "positions": 1092.778,
        "kingMoveRate": 0.335,
        "pawnMoveRate": 0.215,
        "captureRate": 0.133,
        "checkRate": 0.153
      }
    }
  },
  "knownWeakMoves": [
    {
      "history": "rnbqkbnr/pp1p1ppp/4p3/8/3pP3/2N5/PPP2PPP/R1BQKBNR w KQkq -",
      "san": "Qxd4",
      "games": 14,
      "winRate": 0.214,
      "lossRate": 0.786,
      "recentWeight": 10.274
    },
    {
      "history": "r1bqkbnr/pp1p1ppp/2n1p3/8/3QP3/2N5/PPP2PPP/R1B1KBNR w KQkq -",
      "san": "Qd2",
      "games": 7,
      "winRate": 0.143,
      "lossRate": 0.857,
      "recentWeight": 4.79
    },
    {
      "history": "rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq -",
      "san": "Nf6",
      "games": 7,
      "winRate": 0.167,
      "lossRate": 0.833,
      "recentWeight": 4.787
    },
    {
      "history": "r1bqkb1r/1ppp1ppp/p1B5/2n1p3/8/5N2/PPPP1PPP/RNBQR1K1 b kq -",
      "san": "dxc6",
      "games": 8,
      "winRate": 0.125,
      "lossRate": 0.875,
      "recentWeight": 4.742
    },
    {
      "history": "rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -",
      "san": "d4",
      "games": 8,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 4.69
    },
    {
      "history": "rnbqkbnr/pp1p1ppp/4p3/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -",
      "san": "Nxd4",
      "games": 8,
      "winRate": 0.125,
      "lossRate": 0.875,
      "recentWeight": 4.115
    },
    {
      "history": "rnbqkbnr/pp3ppp/2p5/3p4/3P4/5N2/PPP2PPP/RNBQKB1R w KQkq -",
      "san": "Bd3",
      "games": 6,
      "winRate": 0.167,
      "lossRate": 0.833,
      "recentWeight": 3.85
    },
    {
      "history": "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -",
      "san": "d4",
      "games": 5,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 3.68
    },
    {
      "history": "r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq -",
      "san": "d4",
      "games": 5,
      "winRate": 0.2,
      "lossRate": 0.8,
      "recentWeight": 3.394
    },
    {
      "history": "r1bqkbnr/pp1ppppp/2n5/8/3pP3/2N5/PPP2PPP/R1BQKBNR w KQkq -",
      "san": "Nb5",
      "games": 5,
      "winRate": 0.2,
      "lossRate": 0.8,
      "recentWeight": 3.394
    },
    {
      "history": "r1bqkb1r/pppp1ppp/2N2n2/8/4P3/8/PPP2PPP/RNBQKB1R b KQkq -",
      "san": "bxc6",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 3.208
    },
    {
      "history": "rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -",
      "san": "Nc6",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 3.131
    },
    {
      "history": "rnbqkbnr/pp1ppppp/8/8/3pP3/8/PPP2PPP/RNBQKBNR w KQkq -",
      "san": "Qxd4",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 3.108
    },
    {
      "history": "rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR b KQkq -",
      "san": "d5",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.946
    },
    {
      "history": "rnbqkb1r/ppp1pppp/5n2/8/2pPP3/2N5/PP3PPP/R1BQKBNR b KQkq -",
      "san": "e6",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.943
    },
    {
      "history": "rnbqkbnr/ppp2ppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -",
      "san": "Nxd4",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.6
    },
    {
      "history": "rnbqkb1r/ppp1pppp/5n2/8/2pPP3/2N5/PP3PPP/R1BQKBNR b KQkq -",
      "san": "e5",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 2.562
    },
    {
      "history": "r1bqk2r/ppppnppp/1bn5/8/4P3/1N6/PPP1QPPP/RNB1KB1R w KQkq -",
      "san": "Nc3",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.417
    },
    {
      "history": "r1bqk1nr/ppp2ppp/2np4/2b5/2BPP3/5N2/PP3PPP/RNBQK2R b KQkq -",
      "san": "Bb6",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.236
    },
    {
      "history": "r1bqk1nr/pppp1ppp/2n5/2b5/2BpP3/2P2N2/PP3PPP/RNBQK2R b KQkq -",
      "san": "d6",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.236
    },
    {
      "history": "r1bqk2r/1pp1bppp/p1p1n3/4N3/3P4/2P5/PP3PPP/RNBQR1K1 b kq -",
      "san": "O-O",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 2.088
    },
    {
      "history": "r1bqk2r/1pp1bppp/p1p5/2n1N3/3P4/8/PPP2PPP/RNBQR1K1 b kq -",
      "san": "Ne6",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 2.088
    },
    {
      "history": "r1bqkb1r/1pp2ppp/p1p5/2n1N3/8/8/PPPP1PPP/RNBQR1K1 b kq -",
      "san": "Be7",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 2.088
    },
    {
      "history": "r1b1kbnr/pp3ppp/1qn1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R w KQkq -",
      "san": "a3",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 1.915
    },
    {
      "history": "r1bqkbnr/pp1p1ppp/2n1p3/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq -",
      "san": "c4",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 1.913
    },
    {
      "history": "rnbqkbnr/ppp2ppp/4p3/3P4/3P4/8/PPP2PPP/RNBQKBNR b KQkq -",
      "san": "exd5",
      "games": 16,
      "winRate": 0.188,
      "lossRate": 0.813,
      "recentWeight": 1.659
    },
    {
      "history": "rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq -",
      "san": "d5",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 1.205
    },
    {
      "history": "r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2P5/PP1P1PPP/RNBQKBNR w KQkq -",
      "san": "d4",
      "games": 13,
      "winRate": 0.231,
      "lossRate": 0.769,
      "recentWeight": 0.055
    }
  ]
}
