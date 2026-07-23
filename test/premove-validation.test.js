import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { hasCastlingRight } from '../src/lib/premoveRules.js'

test('castling premoves require the corresponding FEN castling right', () => {
  const game = new Chess()
  for (const move of ['Nf3', 'a6', 'g3', 'a5', 'Bg2', 'a4', 'Kf1', 'a3', 'Ke1']) {
    game.move(move)
  }

  assert.equal(game.turn(), 'b')
  assert.equal(game.fen().split(/\s+/)[2], 'kq')
  assert.equal(game.get('e1')?.type, 'k')
  assert.equal(game.get('h1')?.type, 'r')
  assert.equal(game.get('f1'), undefined)
  assert.equal(game.get('g1'), undefined)
  assert.equal(hasCastlingRight(game, 'w', 1), false)
})

test('castling remains available as a premove when the right and path are intact', () => {
  const game = new Chess()
  for (const move of ['Nf3', 'a6', 'g3', 'a5', 'Bg2', 'a4']) game.move(move)

  assert.equal(game.turn(), 'w')
  assert.match(game.fen().split(/\s+/)[2], /K/)
  assert.equal(hasCastlingRight(game, 'w', 1), true)
})
