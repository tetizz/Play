// Generated from the same public games as generatedRecentBrianRepertoireBook.js.
// This compact profile lets the runtime preserve Brian's recurring plans outside exact book positions.
// Sources: chess.com:Bdot=615, lichess:BrianART=874(26 skipped).
// Generated at 2026-11-27T03:40:42.989Z.
// Do not edit by hand; run npm run build:repertoires.
export const GENERATED_BRIAN_STYLE_PROFILE = {
  "generatedAt": "2026-11-27T03:40:42.989Z",
  "sourceCoverage": [
    {
      "site": "chess.com",
      "username": "Bdot",
      "acceptedGames": 615,
      "skippedGames": 0,
      "earliestPlayedAt": "2023-06-07T01:10:17.000Z",
      "latestPlayedAt": "2026-10-20T18:38:08.000Z"
    },
    {
      "site": "lichess",
      "username": "BrianART",
      "acceptedGames": 874,
      "skippedGames": 26,
      "earliestPlayedAt": "2026-04-17T01:55:58.000Z",
      "latestPlayedAt": "2026-11-26T23:36:31.000Z"
    }
  ],
  "sampleSize": 1489,
  "recentWeight": 652.378,
  "sources": {
    "chess.com": {
      "games": 615,
      "recentWeight": 159.699
    },
    "lichess": {
      "games": 874,
      "recentWeight": 492.679
    }
  },
  "byColor": {
    "white": {
      "games": 744,
      "recentWeight": 324.381,
      "results": {
        "wins": 435,
        "losses": 277,
        "draws": 32
      },
      "motifWeights": {
        "capture": 0.226,
        "check": 0.079,
        "castle": 0.023,
        "pawnPush": 0.265,
        "queenMove": 0.134,
        "rookMove": 0.166,
        "kingMove": 0.118,
        "flankPawn": 0.098,
        "center": 0.159,
        "development": 0.078,
        "earlyQueen": 0.009
      },
      "pieceSquareWeights": {
        "p:d4": 1,
        "n:c3": 0.84,
        "n:f3": 0.755,
        "p:e4": 0.643,
        "b:d3": 0.445,
        "k:g1": 0.41,
        "b:f4": 0.399,
        "p:e3": 0.376,
        "p:e5": 0.226,
        "p:h4": 0.225,
        "p:c3": 0.219,
        "p:d5": 0.201,
        "n:e5": 0.172,
        "n:e4": 0.154,
        "b:c4": 0.152,
        "n:e2": 0.14,
        "r:e1": 0.139,
        "q:d3": 0.137,
        "p:c5": 0.133,
        "q:d4": 0.132,
        "b:g5": 0.123,
        "p:f4": 0.118,
        "p:h3": 0.111,
        "b:e3": 0.102,
        "b:b5": 0.099,
        "q:d2": 0.096,
        "b:e2": 0.094,
        "p:g3": 0.091,
        "q:e2": 0.086,
        "p:a3": 0.082,
        "p:h5": 0.081,
        "p:g4": 0.081,
        "k:c1": 0.08,
        "b:g2": 0.078,
        "p:c4": 0.071,
        "p:f3": 0.071
      },
      "favoritePieceSetups": [
        {
          "key": "p:d4",
          "weight": 326.332
        },
        {
          "key": "n:c3",
          "weight": 274.012
        },
        {
          "key": "n:f3",
          "weight": 246.53
        },
        {
          "key": "p:e4",
          "weight": 209.858
        },
        {
          "key": "b:d3",
          "weight": 145.06
        },
        {
          "key": "k:g1",
          "weight": 133.768
        },
        {
          "key": "b:f4",
          "weight": 130.344
        },
        {
          "key": "p:e3",
          "weight": 122.782
        },
        {
          "key": "p:e5",
          "weight": 73.673
        },
        {
          "key": "p:h4",
          "weight": 73.564
        },
        {
          "key": "p:c3",
          "weight": 71.362
        },
        {
          "key": "p:d5",
          "weight": 65.546
        }
      ],
      "openingLines": [
        {
          "key": "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6",
          "weight": 13.018
        },
        {
          "key": "e4 e5 d4 exd4 Qxd4 Nc6 Qd3 Nf6",
          "weight": 9.057
        },
        {
          "key": "d4 Nf6 Nc3 g6 Bf4 d6 e3 Bg7",
          "weight": 5.246
        },
        {
          "key": "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5",
          "weight": 5.076
        },
        {
          "key": "d4 d5 Nc3 c6 Bf4 Nf6 e3 Bf5",
          "weight": 4.646
        },
        {
          "key": "e4 c5 d4 cxd4 Qxd4 Nc6 Qd3 g6",
          "weight": 4.615
        },
        {
          "key": "d4 Nf6 Nc3 e6 Bf4 d5 e3 Bd6",
          "weight": 3.941
        },
        {
          "key": "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7",
          "weight": 3.61
        },
        {
          "key": "e4 d5 exd5 Qxd5 Nc3 Qd8 Nf3 Nf6",
          "weight": 3.528
        },
        {
          "key": "e4 e6 d4 d5 Nc3 dxe4 Nxe4 Nf6",
          "weight": 3.357
        }
      ],
      "commonPawnStructures": [
        {
          "key": "a2-b2-c2-d4-e3-f2-g2-h2",
          "weight": 48.759
        },
        {
          "key": "a2-b2-c2-e4-f2-g2-h2",
          "weight": 34.544
        },
        {
          "key": "a2-b2-c2-d4-f2-g2-h2",
          "weight": 32.806
        },
        {
          "key": "a2-b2-c2-e3-f2-g2-h2",
          "weight": 10.662
        },
        {
          "key": "a2-b2-c2-d4-e3-f2-g2-h4",
          "weight": 10.473
        },
        {
          "key": "a2-b2-c2-d4-e3-f2-g2-h5",
          "weight": 8.975
        },
        {
          "key": "a2-b2-c3-d4-f2-g2-h2",
          "weight": 7.6
        },
        {
          "key": "a2-b2-c2-d4-f2-g2-h3",
          "weight": 7.04
        },
        {
          "key": "a2-b2-c2-e5-f2-g2-h2",
          "weight": 6.472
        },
        {
          "key": "a2-b2-c2-d2-f2-g2-h2",
          "weight": 6.193
        }
      ],
      "timeControls": [
        {
          "key": "bullet",
          "weight": 321.855
        },
        {
          "key": "blitz",
          "weight": 2.516
        },
        {
          "key": "rapid",
          "weight": 0.01
        }
      ],
      "endgameHabits": {
        "positions": 1509.968,
        "kingMoveRate": 0.349,
        "pawnMoveRate": 0.232,
        "captureRate": 0.153,
        "checkRate": 0.139
      }
    },
    "black": {
      "games": 745,
      "recentWeight": 327.997,
      "results": {
        "wins": 377,
        "losses": 330,
        "draws": 38
      },
      "motifWeights": {
        "capture": 0.224,
        "check": 0.065,
        "castle": 0.02,
        "pawnPush": 0.268,
        "queenMove": 0.124,
        "rookMove": 0.154,
        "kingMove": 0.136,
        "flankPawn": 0.089,
        "center": 0.153,
        "development": 0.072,
        "earlyQueen": 0.004
      },
      "pieceSquareWeights": {
        "p:d5": 1,
        "p:c6": 0.72,
        "n:f6": 0.695,
        "p:e6": 0.525,
        "n:d7": 0.419,
        "b:d6": 0.334,
        "k:g8": 0.271,
        "b:g4": 0.258,
        "n:c6": 0.253,
        "b:f5": 0.232,
        "p:e4": 0.226,
        "p:e5": 0.192,
        "p:c5": 0.146,
        "b:e7": 0.12,
        "n:e4": 0.108,
        "p:g6": 0.105,
        "p:h5": 0.095,
        "p:d4": 0.094,
        "p:f6": 0.092,
        "p:h6": 0.09,
        "r:e8": 0.087,
        "p:a6": 0.086,
        "q:c7": 0.085,
        "b:f3": 0.076,
        "b:g7": 0.067,
        "p:c4": 0.065,
        "q:a5": 0.064,
        "b:d3": 0.063,
        "q:e7": 0.06,
        "n:e5": 0.059,
        "b:e6": 0.058,
        "q:b6": 0.051,
        "n:e7": 0.05,
        "b:g6": 0.048,
        "n:d5": 0.046,
        "b:h5": 0.044
      },
      "favoritePieceSetups": [
        {
          "key": "p:d5",
          "weight": 409.368
        },
        {
          "key": "p:c6",
          "weight": 294.554
        },
        {
          "key": "n:f6",
          "weight": 284.374
        },
        {
          "key": "p:e6",
          "weight": 214.725
        },
        {
          "key": "n:d7",
          "weight": 171.615
        },
        {
          "key": "b:d6",
          "weight": 136.865
        },
        {
          "key": "k:g8",
          "weight": 110.959
        },
        {
          "key": "b:g4",
          "weight": 105.448
        },
        {
          "key": "n:c6",
          "weight": 103.553
        },
        {
          "key": "b:f5",
          "weight": 94.955
        },
        {
          "key": "p:e4",
          "weight": 92.683
        },
        {
          "key": "p:e5",
          "weight": 78.45
        }
      ],
      "openingLines": [
        {
          "key": "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6",
          "weight": 16.703
        },
        {
          "key": "e4 c6 Nf3 d5 exd5 cxd5 d4 Nf6",
          "weight": 9.994
        },
        {
          "key": "e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6",
          "weight": 9.885
        },
        {
          "key": "e4 c6 d4 d5 e5 Bf5 Bd3 Bxd3",
          "weight": 8.392
        },
        {
          "key": "e4 c6 d4 d5 exd5 cxd5 c4 Nf6",
          "weight": 8.002
        },
        {
          "key": "e4 c6 d4 d5 e5 Bf5 h4 h5",
          "weight": 7.976
        },
        {
          "key": "e4 c6 d4 d5 Nd2 dxe4 Nxe4 Nf6",
          "weight": 6.683
        },
        {
          "key": "e4 c6 Nc3 d5 d4 dxe4 Nxe4 Nf6",
          "weight": 6.176
        },
        {
          "key": "Nf3 c6 g3 d5 Bg2 Nf6 O-O Nbd7",
          "weight": 5.919
        },
        {
          "key": "e4 c6 Nc3 d5 Nf3 dxe4 Nxe4 Nf6",
          "weight": 5.88
        }
      ],
      "commonPawnStructures": [
        {
          "key": "a7-b7-c6-d5-e6-f7-g7-h7",
          "weight": 49.745
        },
        {
          "key": "a7-b7-c6-d5-e7-f7-g7-h7",
          "weight": 29.864
        },
        {
          "key": "a7-b7-c6-e7-f7-g7-h7",
          "weight": 23.65
        },
        {
          "key": "a7-b7-c6-f6-f7-g7-h7",
          "weight": 21.396
        },
        {
          "key": "a7-b7-d5-e7-f7-g7-h7",
          "weight": 16.584
        },
        {
          "key": "a7-b7-d5-e6-f7-g7-h7",
          "weight": 14.28
        },
        {
          "key": "a6-b7-d5-e7-f7-g7-h7",
          "weight": 13.32
        },
        {
          "key": "a7-b7-c6-d5-e5-f7-g7-h7",
          "weight": 11.127
        },
        {
          "key": "a7-b7-d5-e7-f7-g6-h7",
          "weight": 10.389
        },
        {
          "key": "a7-b7-c5-d5-e6-f7-g7-h7",
          "weight": 9.879
        }
      ],
      "timeControls": [
        {
          "key": "bullet",
          "weight": 322.33
        },
        {
          "key": "blitz",
          "weight": 3.376
        },
        {
          "key": "classical",
          "weight": 1.458
        },
        {
          "key": "unknown",
          "weight": 0.833
        }
      ],
      "endgameHabits": {
        "positions": 1507.046,
        "kingMoveRate": 0.439,
        "pawnMoveRate": 0.197,
        "captureRate": 0.14,
        "checkRate": 0.108
      }
    }
  },
  "knownWeakMoves": [
    {
      "history": "rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -",
      "san": "Nc3",
      "games": 23,
      "winRate": 0.238,
      "lossRate": 0.762,
      "recentWeight": 13.346
    },
    {
      "history": "rnbqkbnr/ppp2ppp/4p3/8/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq -",
      "san": "Nxe4",
      "games": 13,
      "winRate": 0.154,
      "lossRate": 0.846,
      "recentWeight": 8.168
    },
    {
      "history": "rn1qkbnr/pp2pppp/2p3b1/8/3P4/6N1/PPP2PPP/R1BQKBNR w KQkq -",
      "san": "h4",
      "games": 9,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 5.076
    },
    {
      "history": "rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq -",
      "san": "Ng3",
      "games": 9,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 5.076
    },
    {
      "history": "rnbqkbnr/pp2pppp/2p5/3p4/3P1B2/2N5/PPP1PPPP/R2QKBNR b KQkq -",
      "san": "Nf6",
      "games": 8,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 4.347
    },
    {
      "history": "rn1qkbnr/pp2ppp1/2p3bp/8/3P3P/6N1/PPP2PP1/R1BQKBNR w KQkq -",
      "san": "Nh3",
      "games": 7,
      "winRate": 0.143,
      "lossRate": 0.857,
      "recentWeight": 3.95
    },
    {
      "history": "r1bqkb1r/1p2pppp/p1n2n2/3p4/3P1B2/2N1PN2/PP3PPP/R2QKB1R b KQkq -",
      "san": "Bg4",
      "games": 6,
      "winRate": 0.167,
      "lossRate": 0.833,
      "recentWeight": 3.403
    },
    {
      "history": "rnbqkb1r/pp2pppp/2p2N2/8/8/5N2/PPPP1PPP/R1BQKB1R b KQkq -",
      "san": "exf6",
      "games": 8,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 3.128
    },
    {
      "history": "rnbqkbnr/pp1ppppp/2p5/8/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq -",
      "san": "d5",
      "games": 6,
      "winRate": 0.167,
      "lossRate": 0.833,
      "recentWeight": 2.894
    },
    {
      "history": "rnbqkbnr/pp2pppp/2p5/3p4/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq -",
      "san": "Nf6",
      "games": 6,
      "winRate": 0.167,
      "lossRate": 0.833,
      "recentWeight": 2.894
    },
    {
      "history": "r1bqkbnr/pp1npppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR w KQkq -",
      "san": "Nf3",
      "games": 5,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.726
    },
    {
      "history": "rn1qkb1r/pp3pp1/2p1pn1p/3p1b2/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b kq -",
      "san": "Nbd7",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.599
    },
    {
      "history": "rn1qkb1r/pp2pppp/2p2n2/3p1b2/3P4/5NP1/PPP1PPBP/RNBQ1RK1 b kq -",
      "san": "h6",
      "games": 5,
      "winRate": 0.2,
      "lossRate": 0.8,
      "recentWeight": 2.554
    },
    {
      "history": "rnbqkb1r/pp2pppp/2p2n2/3P4/3P4/5N2/PP2PPPP/RNBQKB1R b KQkq -",
      "san": "cxd5",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.552
    },
    {
      "history": "rnbqkb1r/1p2pppp/p4n2/3p4/3P1B2/2N2N2/PP2PPPP/R2QKB1R b KQkq -",
      "san": "Nc6",
      "games": 5,
      "winRate": 0.2,
      "lossRate": 0.8,
      "recentWeight": 2.548
    },
    {
      "history": "rnbqkbnr/pp3ppp/4p3/2pp4/4P3/2P2N2/PP1P1PPP/RNBQKB1R w KQkq -",
      "san": "exd5",
      "games": 5,
      "winRate": 0.2,
      "lossRate": 0.8,
      "recentWeight": 2.539
    },
    {
      "history": "rnbqkb1r/ppp2ppp/4pn2/8/3PN3/8/PPP2PPP/R1BQKBNR w KQkq -",
      "san": "Bd3",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.509
    },
    {
      "history": "rnbqkb1r/pp2pppp/2p2n2/3p4/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq -",
      "san": "Bg4",
      "games": 5,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.474
    },
    {
      "history": "r1bqkb1r/1p2pppp/p1n2n2/3p4/3P1B2/2N4P/PPP2PP1/R2QKBNR w KQkq -",
      "san": "Nf3",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.433
    },
    {
      "history": "rn1qkb1r/pp2ppp1/2p2n1p/3p1b2/2PP4/5NP1/PP2PPBP/RNBQ1RK1 b kq -",
      "san": "e6",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 2.391
    },
    {
      "history": "rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq -",
      "san": "d5",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.359
    },
    {
      "history": "r1bqkb1r/pp1n1ppp/2p2n2/3Pp3/8/5NP1/PP1PPPBP/RNBQ1RK1 b kq -",
      "san": "cxd5",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.196
    },
    {
      "history": "r1bqkb1r/pp1npppp/2p2n2/3p4/2P5/5NP1/PP1PPPBP/RNBQ1RK1 b kq -",
      "san": "e5",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.196
    },
    {
      "history": "rnbqkb1r/pp3ppp/5n2/2pp4/3P4/2P2N2/PP3PPP/RNBQKB1R w KQkq -",
      "san": "Bb5+",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 2.183
    },
    {
      "history": "rnbq1rk1/pp3ppp/2pb1p2/8/3P4/3BBN2/PPP2PPP/R2QK2R b KQ -",
      "san": "Re8",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 2.088
    },
    {
      "history": "rnbqkb1r/pp2pppp/2p2B2/3p4/3P4/5N2/PPP1PPPP/RN1QKB1R b KQkq -",
      "san": "exf6",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 2.013
    },
    {
      "history": "rnbqkbnr/pp2pppp/2p5/3p2B1/3P4/5N2/PPP1PPPP/RN1QKB1R b KQkq -",
      "san": "Nf6",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 2.013
    },
    {
      "history": "r1bqkb1r/pppp1ppp/2n2n2/8/2BpP3/5N2/PPP2PPP/RNBQK2R w KQkq -",
      "san": "O-O",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 1.907
    },
    {
      "history": "rnbqkbnr/pp1ppppp/2p5/8/8/3P4/PPPNPPPP/R1BQKBNR b KQkq -",
      "san": "d5",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 1.844
    },
    {
      "history": "rnbqkbnr/pp2pppp/2p5/3P4/2P5/8/PP1P1PPP/RNBQKBNR b KQkq -",
      "san": "cxd5",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 1.806
    },
    {
      "history": "rnbqkb1r/pp3ppp/2p2p2/8/2B5/5N2/PPPP1PPP/R1BQK2R b KQkq -",
      "san": "Bd6",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 1.573
    },
    {
      "history": "rnbqk2r/pp3ppp/2pb1p2/8/3P4/4BN2/PPP2PPP/R2QKB1R b KQkq -",
      "san": "O-O",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 1.525
    },
    {
      "history": "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -",
      "san": "d4",
      "games": 5,
      "winRate": 0.2,
      "lossRate": 0.8,
      "recentWeight": 1.396
    },
    {
      "history": "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -",
      "san": "e6",
      "games": 7,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 1.273
    },
    {
      "history": "rn2kbnr/pp3pp1/1qp1p3/3pP1Bp/3P3P/3Q4/PPPN1PP1/R3K1NR b KQkq -",
      "san": "c5",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 1.14
    },
    {
      "history": "rnbqkb1r/pppp1ppp/4pn2/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq -",
      "san": "Bb4",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 0.554
    },
    {
      "history": "rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq -",
      "san": "Nf6",
      "games": 5,
      "winRate": 0.2,
      "lossRate": 0.8,
      "recentWeight": 0.101
    },
    {
      "history": "rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq -",
      "san": "e6",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 0.064
    },
    {
      "history": "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq -",
      "san": "Be7",
      "games": 5,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 0.063
    }
  ]
}
