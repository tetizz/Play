import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { getBotProfile } from '../src/data/botProfiles.js'
import { chooseCoachMove } from '../src/lib/coachEngine.js'
import {
  annotateBadMannersCandidates,
  createBadMannersClient,
  shouldUseBadMannersTakeover,
} from '../src/lib/badMannersClient.js'
import { isExactWinningMove } from '../src/lib/tablebaseClient.js'

test('Trixize is the profile with Bad Manners endgame takeover enabled', () => {
  assert.equal(getBotProfile('trixize').capabilities.badMannersTakeover, true)
  assert.equal(getBotProfile('mubassar').capabilities.badMannersTakeover, undefined)
})

test('Bad Manners takeover waits for an endgame or bishop-knight objective', () => {
  const trixize = getBotProfile('trixize')
  assert.equal(shouldUseBadMannersTakeover(new Chess(), trixize), false)

  const promotion = new Chess('7k/P7/8/8/8/8/8/6BK w - - 0 1')
  assert.equal(shouldUseBadMannersTakeover(promotion, trixize), true)

  const winningEndgame = new Chess('7k/8/8/8/8/8/8/QBN3K1 w - - 0 1')
  assert.equal(shouldUseBadMannersTakeover(winningEndgame, trixize), true)
})

test('Bad Manners candidates are marked objective-verified for local objective moves', () => {
  const game = new Chess('7k/P7/8/8/8/8/8/6BK w - - 0 1')
  const [candidate] = annotateBadMannersCandidates(game, [
    { uci: 'a7a8n', score: 900, rank: 1, pv: ['a7a8n'] },
  ])
  assert.equal(candidate.objectiveVerified, true)
  assert.equal(candidate.badManners, true)
})

test('Bad Manners objective underpromotion can use a modest KBN conversion score', () => {
  const game = new Chess('7k/P7/8/8/8/8/8/6BK w - - 0 1')
  const candidates = annotateBadMannersCandidates(game, [
    { uci: 'a7a8n', score: 183, rank: 1, pv: ['a7a8n'], badManners: true },
  ])
  const decision = chooseCoachMove(
    game,
    candidates,
    getBotProfile('trixize'),
    { openingBook: {}, bookMaxPlies: 0 },
  )
  assert.equal(decision.move.san, 'a8=N')
  assert.equal(decision.source, 'engine-objective')
})

test('exact tablebase validation recognizes winning Bad Manners moves', () => {
  assert.equal(isExactWinningMove({
    category: 'win',
    moves: [
      { uci: 'a7a8q', category: 'loss' },
      { uci: 'a7a8n', category: 'loss' },
    ],
  }, 'a7a8n'), true)
  assert.equal(isExactWinningMove({
    category: 'win',
    moves: [{ uci: 'a7a8n', category: 'draw' }],
  }, 'a7a8n'), false)
})

test('Bad Manners client returns sanitized bridge candidates', async () => {
  let receivedBody = null
  const client = createBadMannersClient({
    endpoint: 'http://127.0.0.1:47818',
    fetchImpl: async (_url, request) => {
      receivedBody = JSON.parse(request.body)
      return {
        ok: true,
        json: async () => ({
          lines: [
            { uci: 'a7a8n', score: 900, mate: 30, rank: 1, pv: ['a7a8n'] },
            { uci: 'bad', score: 1, rank: 2 },
          ],
        }),
      }
    },
  })

  const lines = await client.bestMoves('7k/P7/8/8/8/8/8/6BK w - - 0 1', {
    depth: 24,
    moveTime: 4200,
    count: 8,
  })
  assert.equal(receivedBody.options.depth, 24)
  assert.equal(lines.length, 1)
  assert.equal(lines[0].uci, 'a7a8n')
  assert.equal(lines[0].badManners, true)
})
