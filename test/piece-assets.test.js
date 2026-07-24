import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const expectedHashes = {
  'bB.svg': 'fdce0c2d7c2401f933a9acef83dadde78747e9d02c8c1b9bc130834503943a37',
  'bK.svg': 'bd749ec263b7d8e375359775e53190e679f349f854ed999c8b434dcff106f9e4',
  'bN.svg': '17edfeffef6ea45824f5a1ad5be852b5f41fcb97d6bef60b679f366dd31cc8bb',
  'bP.svg': 'b8423b6b4740809be0abd907b766c04d03fe1c1e0379df7f15cad7d929ccc5e6',
  'bQ.svg': '2daacf0bb6093413a56c0987272534bbdaa4a4f3420360f8f2bc49803a0461ee',
  'bR.svg': '286cd32782be6203d28b1ffdf4898cb76d864d850b8b09e8f6b56bed2cb3f420',
  'wB.svg': '6683d39caac2a793368ea3ad181e73083e70c94e4d0fca1e2937e5e4714460ff',
  'wK.svg': '46c7f647315f4414ac2eda6ab338bc4d5ccbf627c4fe9ad565f4f343f60ab91a',
  'wN.svg': '87963338cccc85773bc74c8b318a94f14abd6e8d666480e58d5f4e0b950f0836',
  'wP.svg': '9175201108420c2338c0caa0e78c7f6ac9ebaf677adc7ed066e8a92f075e3308',
  'wQ.svg': 'a1dc6f576298d46af39645e593c5bcfa49d4fc17d08fd4de3a1aa800d7cf55ca',
  'wR.svg': 'f14e9c11200ac5a3fb97f257ca94cf46c2c94a85102157b5983b38f22916f3c6',
}

test('the complete Kaneo set stays pinned to the attributed upstream artwork', async () => {
  for (const [fileName, expectedHash] of Object.entries(expectedHashes)) {
    const bytes = await readFile(
      new URL(`../public/assets/pieces/kaneo/${fileName}`, import.meta.url),
    )
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash)
  }

  const source = await readFile(
    new URL('../public/assets/pieces/kaneo/SOURCE.md', import.meta.url),
    'utf8',
  )
  const license = await readFile(
    new URL('../public/assets/pieces/kaneo/LICENSE.txt', import.meta.url),
    'utf8',
  )
  assert.match(source, /b035b0cc6a68e9fb99c872c8fe073c3ae3eba8a0/)
  assert.match(source, /CC BY 4\.0/)
  assert.match(license, /Creative Commons Attribution 4\.0 International/)
})
