import assert from 'node:assert/strict'
import test from 'node:test'
import { materialDisplayFromFen, materialDisplayFromHistory } from '../src/lib/materialDisplay.js'

test('starts with no captured pieces or material advantage', () => {
  assert.deepEqual(materialDisplayFromHistory([]), {
    white: { captures: [], advantage: 0 },
    black: { captures: [], advantage: 0 },
  })
})

test('tracks captured pieces and the leading side from visible history', () => {
  const history = ['e4', 'd5', 'exd5']
  assert.deepEqual(materialDisplayFromHistory(history), {
    white: { captures: ['p'], advantage: 1 },
    black: { captures: [], advantage: 0 },
  })
})

test('rewinding history removes later captures and material leads', () => {
  const history = ['e4', 'd5', 'exd5']
  assert.deepEqual(materialDisplayFromHistory(history, 2), {
    white: { captures: [], advantage: 0 },
    black: { captures: [], advantage: 0 },
  })
})

test('tracks both players captures without showing a lead after an even trade', () => {
  const history = ['e4', 'd5', 'exd5', 'Qxd5']
  assert.deepEqual(materialDisplayFromHistory(history), {
    white: { captures: ['p'], advantage: 0 },
    black: { captures: ['p'], advantage: 0 },
  })
})

test('material balance includes promotion value', () => {
  const summary = materialDisplayFromFen('7k/P7/8/8/8/8/8/7K w - - 0 1')
  assert.deepEqual(summary, { white: 1, black: 0 })

  const promoted = materialDisplayFromFen('Q6k/8/8/8/8/8/8/7K b - - 0 1')
  assert.deepEqual(promoted, { white: 9, black: 0 })
})
