// Generated from the same public games as generatedRecentAlexanderRepertoireBook.js.
// This compact profile lets the runtime preserve Aleksandr Lenderman's recurring plans outside exact book positions.
// Sources: chess.com:AlexanderL=4481(1 skipped), lichess:AlexLenderman=731(169 skipped).
// Generated at 2026-11-27T03:37:15.509Z.
// Do not edit by hand; run npm run build:repertoires.
export const GENERATED_ALEXANDER_STYLE_PROFILE = {
  "generatedAt": "2026-11-27T03:37:15.509Z",
  "sourceCoverage": [
    {
      "site": "chess.com",
      "username": "AlexanderL",
      "acceptedGames": 4481,
      "skippedGames": 1,
      "earliestPlayedAt": "2010-06-24T20:48:04.000Z",
      "latestPlayedAt": "2025-10-31T03:00:50.000Z"
    },
    {
      "site": "lichess",
      "username": "AlexLenderman",
      "acceptedGames": 731,
      "skippedGames": 169,
      "earliestPlayedAt": "2020-06-24T00:05:08.000Z",
      "latestPlayedAt": "2026-10-30T23:37:52.000Z"
    }
  ],
  "sampleSize": 5212,
  "recentWeight": 15.103,
  "sources": {
    "chess.com": {
      "games": 4481,
      "recentWeight": 11.715
    },
    "lichess": {
      "games": 731,
      "recentWeight": 3.387
    }
  },
  "byColor": {
    "white": {
      "games": 2631,
      "recentWeight": 7.945,
      "results": {
        "wins": 1885,
        "losses": 439,
        "draws": 307
      },
      "motifWeights": {
        "capture": 0.224,
        "check": 0.076,
        "castle": 0.019,
        "pawnPush": 0.256,
        "queenMove": 0.111,
        "rookMove": 0.172,
        "kingMove": 0.134,
        "flankPawn": 0.101,
        "center": 0.153,
        "development": 0.064,
        "earlyQueen": 0.004
      },
      "pieceSquareWeights": {
        "n:f3": 1,
        "p:d4": 0.874,
        "n:c3": 0.773,
        "p:c4": 0.716,
        "k:g1": 0.599,
        "p:e4": 0.408,
        "p:e3": 0.397,
        "p:d5": 0.373,
        "p:g3": 0.338,
        "b:g2": 0.31,
        "p:b3": 0.239,
        "b:d3": 0.229,
        "n:e5": 0.225,
        "q:e2": 0.163,
        "n:e4": 0.162,
        "b:c4": 0.159,
        "n:g5": 0.156,
        "b:e2": 0.156,
        "n:d2": 0.149,
        "b:b2": 0.138,
        "n:f7": 0.126,
        "q:g4": 0.119,
        "n:d4": 0.116,
        "p:c3": 0.115,
        "p:c5": 0.114,
        "n:g4": 0.114,
        "b:f4": 0.109,
        "r:e1": 0.108,
        "q:b3": 0.092,
        "p:e5": 0.091,
        "p:h3": 0.073,
        "p:a4": 0.069,
        "b:g5": 0.069,
        "n:c6": 0.064,
        "r:d1": 0.056,
        "q:c2": 0.05
      },
      "favoritePieceSetups": [
        {
          "key": "n:f3",
          "weight": 7.901
        },
        {
          "key": "p:d4",
          "weight": 6.905
        },
        {
          "key": "n:c3",
          "weight": 6.11
        },
        {
          "key": "p:c4",
          "weight": 5.659
        },
        {
          "key": "k:g1",
          "weight": 4.732
        },
        {
          "key": "p:e4",
          "weight": 3.224
        },
        {
          "key": "p:e3",
          "weight": 3.137
        },
        {
          "key": "p:d5",
          "weight": 2.951
        },
        {
          "key": "p:g3",
          "weight": 2.668
        },
        {
          "key": "b:g2",
          "weight": 2.452
        },
        {
          "key": "p:b3",
          "weight": 1.887
        },
        {
          "key": "b:d3",
          "weight": 1.807
        }
      ],
      "openingLines": [
        {
          "key": "e4 c6 Nc3 d5 Nf3 dxe4 Nxe4 Nf6",
          "weight": 0.917
        },
        {
          "key": "d4 Nf6 Nf3 d5 c4 e6 e3 b6",
          "weight": 0.355
        },
        {
          "key": "d4 Nf6 Nf3 g6 g3 Bg7 Bg2 O-O",
          "weight": 0.266
        },
        {
          "key": "d4 Nf6 Nf3 d5 g3 c5 Bg2 cxd4",
          "weight": 0.221
        },
        {
          "key": "d4 Nf6 Nf3 d5 g3 Bf5 Bg2 e6",
          "weight": 0.221
        },
        {
          "key": "d4 Nf6 Nf3 d6 g3 g6 Bg2 Bg7",
          "weight": 0.219
        },
        {
          "key": "d4 Nf6 Nf3 d6 g3 Nbd7 Bg2 e5",
          "weight": 0.219
        },
        {
          "key": "Nf3 g6 d4 d5 c4 Nf6 cxd5 Bg7",
          "weight": 0.218
        },
        {
          "key": "d4 Nf6 Nf3 e6 e3 Be7 c4 O-O",
          "weight": 0.218
        },
        {
          "key": "d4 e6 Nf3 Nf6 e3 d5 c4 b6",
          "weight": 0.211
        }
      ],
      "commonPawnStructures": [
        {
          "key": "a2-b2-c4-d4-e2-f2-g3-h2",
          "weight": 0.999
        },
        {
          "key": "a2-b2-c2-d2-f2-g2-h2",
          "weight": 0.929
        },
        {
          "key": "a2-b2-d4-e3-f2-g2-h2",
          "weight": 0.839
        },
        {
          "key": "a2-b2-c4-d4-e4-f2-g2-h2",
          "weight": 0.478
        },
        {
          "key": "a2-b3-c4-d4-e3-f2-g2-h2",
          "weight": 0.426
        },
        {
          "key": "a2-b2-d4-e2-f2-g2-h2",
          "weight": 0.394
        },
        {
          "key": "a2-b3-c4-d2-e3-f2-g2-h2",
          "weight": 0.303
        },
        {
          "key": "a2-b2-c4-d4-e3-f2-g2-h2",
          "weight": 0.296
        },
        {
          "key": "a2-b3-c2-d4-e2-f2-g3-h2",
          "weight": 0.285
        },
        {
          "key": "a2-b3-c2-e2-f2-g3-h2",
          "weight": 0.221
        }
      ],
      "timeControls": [
        {
          "key": "blitz",
          "weight": 4.961
        },
        {
          "key": "bullet",
          "weight": 2.514
        },
        {
          "key": "rapid",
          "weight": 0.425
        },
        {
          "key": "classical",
          "weight": 0.045
        },
        {
          "key": "unknown",
          "weight": 0
        }
      ],
      "endgameHabits": {
        "positions": 53.691,
        "kingMoveRate": 0.37,
        "pawnMoveRate": 0.234,
        "captureRate": 0.14,
        "checkRate": 0.138
      }
    },
    "black": {
      "games": 2581,
      "recentWeight": 7.157,
      "results": {
        "wins": 1696,
        "losses": 520,
        "draws": 365
      },
      "motifWeights": {
        "capture": 0.213,
        "check": 0.065,
        "castle": 0.018,
        "pawnPush": 0.259,
        "queenMove": 0.11,
        "rookMove": 0.162,
        "kingMove": 0.145,
        "flankPawn": 0.104,
        "center": 0.132,
        "development": 0.066,
        "earlyQueen": 0.002
      },
      "pieceSquareWeights": {
        "p:d5": 1,
        "n:f6": 0.951,
        "p:e6": 0.764,
        "n:c6": 0.534,
        "k:g8": 0.448,
        "p:c5": 0.447,
        "n:d7": 0.412,
        "p:c6": 0.361,
        "p:a6": 0.329,
        "b:e7": 0.246,
        "b:d7": 0.221,
        "p:e5": 0.202,
        "b:d6": 0.201,
        "p:d6": 0.189,
        "b:b7": 0.182,
        "p:b6": 0.17,
        "p:d4": 0.15,
        "b:c5": 0.144,
        "n:e4": 0.134,
        "p:e4": 0.125,
        "r:e8": 0.121,
        "b:b4": 0.107,
        "p:g6": 0.102,
        "b:e6": 0.088,
        "n:e7": 0.086,
        "b:g4": 0.084,
        "p:c4": 0.083,
        "b:g7": 0.081,
        "b:f5": 0.073,
        "p:b5": 0.065,
        "n:e5": 0.062,
        "p:h6": 0.058,
        "q:b6": 0.057,
        "p:f6": 0.053,
        "p:f5": 0.052,
        "n:d5": 0.048
      },
      "favoritePieceSetups": [
        {
          "key": "p:d5",
          "weight": 7.457
        },
        {
          "key": "n:f6",
          "weight": 7.095
        },
        {
          "key": "p:e6",
          "weight": 5.695
        },
        {
          "key": "n:c6",
          "weight": 3.983
        },
        {
          "key": "k:g8",
          "weight": 3.338
        },
        {
          "key": "p:c5",
          "weight": 3.333
        },
        {
          "key": "n:d7",
          "weight": 3.076
        },
        {
          "key": "p:c6",
          "weight": 2.691
        },
        {
          "key": "p:a6",
          "weight": 2.452
        },
        {
          "key": "b:e7",
          "weight": 1.838
        },
        {
          "key": "b:d7",
          "weight": 1.647
        },
        {
          "key": "p:e5",
          "weight": 1.507
        }
      ],
      "openingLines": [
        {
          "key": "e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7",
          "weight": 0.898
        },
        {
          "key": "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4",
          "weight": 0.299
        },
        {
          "key": "Nf3 d5 g3 b6 c4 dxc4 Na3 Bb7",
          "weight": 0.221
        },
        {
          "key": "c4 c6 Nf3 d5 e3 Nf6 Nc3 a6",
          "weight": 0.221
        },
        {
          "key": "e4 e6 Qe2 e5 Nf3 Nc6 c3 Nf6",
          "weight": 0.22
        },
        {
          "key": "b3 e5 Bb2 Nc6 e4 Nf6 Nc3 Bc5",
          "weight": 0.218
        },
        {
          "key": "e4 e6 d4 d5 Nc3 dxe4 Nxe4 Nd7",
          "weight": 0.217
        },
        {
          "key": "e4 e6 d4 d5 Nc3 dxe4 Nxe4 Bd7",
          "weight": 0.217
        },
        {
          "key": "e4 e6 d4 d5 exd5 exd5 Nf3 Nf6",
          "weight": 0.212
        },
        {
          "key": "d4 d5 Nf3 Nf6 Bf4 c5 e3 Nc6",
          "weight": 0.135
        }
      ],
      "commonPawnStructures": [
        {
          "key": "a7-b7-c5-d5-e6-f7-g7-h7",
          "weight": 1.361
        },
        {
          "key": "a7-b7-c7-d5-f7-g7-h7",
          "weight": 0.672
        },
        {
          "key": "a7-b7-c7-e6-f7-g7-h7",
          "weight": 0.566
        },
        {
          "key": "a7-b7-c7-d7-f7-g7-h7",
          "weight": 0.282
        },
        {
          "key": "a6-b7-d5-e7-f7-g7-h7",
          "weight": 0.265
        },
        {
          "key": "a7-b6-c7-e6-f7-g7-h7",
          "weight": 0.228
        },
        {
          "key": "a6-b7-c6-d5-e6-f7-g7-h7",
          "weight": 0.226
        },
        {
          "key": "a7-b6-c7-d7-e6-f5-g7-h7",
          "weight": 0.22
        },
        {
          "key": "a6-b7-c7-d6-e5-f7-g7-h7",
          "weight": 0.218
        },
        {
          "key": "a7-b7-d4-d5-e6-f7-g7-h7",
          "weight": 0.142
        }
      ],
      "timeControls": [
        {
          "key": "blitz",
          "weight": 4.219
        },
        {
          "key": "bullet",
          "weight": 2.631
        },
        {
          "key": "rapid",
          "weight": 0.268
        },
        {
          "key": "classical",
          "weight": 0.039
        },
        {
          "key": "unknown",
          "weight": 0
        }
      ],
      "endgameHabits": {
        "positions": 57.443,
        "kingMoveRate": 0.377,
        "pawnMoveRate": 0.174,
        "captureRate": 0.114,
        "checkRate": 0.16
      }
    }
  },
  "knownWeakMoves": [
    {
      "history": "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq -",
      "san": "c6",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 0.301
    },
    {
      "history": "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -",
      "san": "c5",
      "games": 4,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 0.141
    },
    {
      "history": "rnbqkb1r/pp2pppp/2p2n2/3P4/3P4/2N5/PP2PPPP/R1BQKBNR b KQkq -",
      "san": "cxd5",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 0.134
    },
    {
      "history": "rnbqkbnr/1pp2ppp/p7/3p4/3P4/2N2N2/PP2PPPP/R1BQKB1R b KQkq -",
      "san": "Nf6",
      "games": 7,
      "winRate": 0.2,
      "lossRate": 0.8,
      "recentWeight": 0.047
    },
    {
      "history": "rn1qkbnr/pbpp1ppp/1p2p3/8/8/5NP1/PPPPPPBP/RNBQ1RK1 b kq -",
      "san": "Nf6",
      "games": 6,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 0.029
    },
    {
      "history": "rnbqk2r/p1p1nppp/1p6/3pP3/3P4/2N5/PP1Q1PPP/R3KBNR b KQkq -",
      "san": "O-O",
      "games": 8,
      "winRate": 0.25,
      "lossRate": 0.75,
      "recentWeight": 0.021
    },
    {
      "history": "rn1q1rk1/pb1pppbp/1p3np1/2p5/2P5/1P3NP1/PB1PPPBP/RN1Q1RK1 w - -",
      "san": "Nc3",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 0.012
    },
    {
      "history": "rn1qkb1r/ppp1pppp/5n2/8/2pP2b1/4PN2/PP3PPP/RNBQKB1R w KQkq -",
      "san": "Bxc4",
      "games": 4,
      "winRate": 0,
      "lossRate": 1,
      "recentWeight": 0.011
    }
  ]
}
