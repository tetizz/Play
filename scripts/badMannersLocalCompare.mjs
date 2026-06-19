import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'
import { getBotProfile } from '../src/data/botProfiles.js'
import { badMannersRouteScore, chooseCoachMove } from '../src/lib/coachEngine.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const OUT = process.argv.find((arg) => arg.startsWith('--out='))?.split('=')[1] ||
  path.join(repoRoot, 'test-results', 'bad-manners-local-compare.json')

const profile = getBotProfile('trixize')
const cases = [
  {
    id: 'minor-over-queen-promotion',
    fen: '7k/P7/8/8/8/8/8/6BK w - - 0 1',
    candidates: [
      { uci: 'a7a8q', score: 1200, rank: 1, objectiveVerified: true, badManners: true },
      { uci: 'a7a8n', score: 180, rank: 2, objectiveVerified: true, badManners: true },
    ],
    expectedImproved: 'a7a8n',
    expectedLegacy: 'a7a8q',
  },
  {
    id: 'surplus-before-ordinary-mate',
    fen: '7k/8/8/8/8/8/K5R1/1BN5 w - - 0 1',
    candidates: [
      { uci: 'c1b3', score: 99997, mate: 3, rank: 1 },
      { uci: 'g2g8', score: 99970, mate: 24, rank: 2, objectiveVerified: true, badManners: true },
    ],
    expectedImproved: 'g2g8',
    expectedLegacy: 'c1b3',
  },
  {
    id: 'reject-non-pure-mate',
    fen: '8/6B1/8/6k1/R5p1/1p1B2P1/1P4KP/8 w - - 0 1',
    candidates: [
      { uci: 'a4a5', score: 99999, mate: 1, rank: 1 },
      { uci: 'h2h3', score: 990, rank: 2, objectiveVerified: true, badManners: true },
      { uci: 'h2h4', score: 900, rank: 3, objectiveVerified: true, badManners: true },
      { uci: 'a4g4', score: 820, rank: 4, objectiveVerified: true, badManners: true },
    ],
    expectedImproved: 'a4g4',
    expectedLegacy: 'a4a5',
  },
  {
    id: 'avoid-hanging-last-bishop',
    fen: '8/8/8/8/8/2k5/P7/1NBK4 w - - 0 1',
    candidates: [
      { uci: 'c1b2', score: 900, rank: 1, objectiveVerified: true, badManners: true },
      { uci: 'a2a4', score: 850, rank: 2, objectiveVerified: true, badManners: true },
    ],
    expectedImproved: 'a2a4',
    expectedLegacy: 'c1b2',
  },
  {
    id: 'build-pair-before-engine-style',
    fen: '7k/PP6/8/8/8/8/8/7K w - - 0 1',
    candidates: [
      { uci: 'a7a8q', score: 1300, rank: 1, objectiveVerified: true, badManners: true },
      { uci: 'a7a8b', score: 220, rank: 2, objectiveVerified: true, badManners: true },
      { uci: 'a7a8n', score: 210, rank: 3, objectiveVerified: true, badManners: true },
    ],
    expectedImproved: 'a7a8b',
    expectedLegacy: 'a7a8q',
  },
]

const results = cases.map((item) => {
  const game = new Chess(item.fen)
  const improved = chooseCoachMove(
    game,
    item.candidates,
    profile,
    { openingBook: {}, bookMaxPlies: 0 },
  )
  const improvedUci = moveToUci(improved.move)
  const legacyUci = item.candidates[0].uci
  const scoredCandidates = item.candidates.map((candidate) => {
    const move = moveFromUci(game, candidate.uci)
    return {
      uci: candidate.uci,
      san: move?.san || null,
      routeScore: move ? badMannersRouteScore(game, move, candidate) : null,
      engineScore: candidate.score,
      rank: candidate.rank,
    }
  })
  return {
    id: item.id,
    fen: item.fen,
    improvedUci,
    legacyUci,
    expectedImproved: item.expectedImproved,
    expectedLegacy: item.expectedLegacy,
    improvedPassed: improvedUci === item.expectedImproved,
    legacyMatchedOld: legacyUci === item.expectedLegacy,
    improvedBeatLegacy: improvedUci !== legacyUci,
    scoredCandidates,
  }
})

const report = {
  total: results.length,
  improvedPassed: results.filter((result) => result.improvedPassed).length,
  legacyMatchedOld: results.filter((result) => result.legacyMatchedOld).length,
  improvedBeatLegacy: results.filter((result) => result.improvedBeatLegacy).length,
  failures: results.filter((result) => !result.improvedPassed),
  results,
}

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  total: report.total,
  improvedPassed: report.improvedPassed,
  legacyMatchedOld: report.legacyMatchedOld,
  improvedBeatLegacy: report.improvedBeatLegacy,
  report: OUT,
}, null, 2))
if (report.failures.length) process.exitCode = 1

function moveFromUci(game, uci) {
  return game.moves({ verbose: true }).find((move) =>
    move.from === uci.slice(0, 2) &&
    move.to === uci.slice(2, 4) &&
    (!uci[4] || move.promotion === uci[4]),
  ) || null
}

function moveToUci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`
}
