import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

test('a failed account preserves both existing repertoire outputs', async () => {
  await withBuilder(async (directory, script) => {
    const result = runBuilder(script, true)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /refresh incomplete.*lichess:guardup/)
    for (const filename of outputFiles) {
      assert.equal(await readFile(path.join(directory, 'src/data', filename), 'utf8'), 'existing data')
    }
  })
})

test('a complete refresh records source coverage and excludes future games and opponent moves', async () => {
  await withBuilder(async (directory, script) => {
    const result = runBuilder(script, false)
    assert.equal(result.status, 0, result.stderr)
    const style = await import(pathToFileURL(path.join(directory, 'src/data', outputFiles[1])).href)
    const profile = style.GENERATED_MUBASSAR_STYLE_PROFILE
    assert.equal(profile.sampleSize, 2)
    assert.equal(profile.sourceCoverage.length, 3)
    assert.equal(profile.sourceCoverage[1].acceptedGames, 1, result.stderr + JSON.stringify(profile.sourceCoverage))
    assert.equal(profile.sourceCoverage[1].skippedGames, 1)
    assert.equal(profile.sourceCoverage[1].latestPlayedAt, '2025-01-01T00:00:00.000Z')
    const book = await import(pathToFileURL(path.join(directory, 'src/data', outputFiles[0])).href)
    const positions = Object.entries(book.GENERATED_RECENT_REPERTOIRE_BOOK)
    assert.ok(positions.length > 0)
    assert.ok(positions.every(([fen]) => fen.split(' ')[1] === 'w'))
    assert.deepEqual(positions.find(([fen]) => fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/'))[1].map((move) => move.san), ['d4'])
  })
})

test('an explicit archive window limits the public monthly archives used', async () => {
  await withBuilder(async (directory, script) => {
    const result = runBuilder(script, false, 6)
    assert.equal(result.status, 0, result.stderr)
    const style = await import(pathToFileURL(path.join(directory, 'src/data', outputFiles[1])).href)
    assert.equal(style.GENERATED_MUBASSAR_STYLE_PROFILE.sourceCoverage[0].acceptedGames, 6)
    const book = await readFile(path.join(directory, 'src/data', outputFiles[0]), 'utf8')
    assert.match(book, /Chess.com window: last 6 monthly archives/)
  })
})

const outputFiles = ['generatedRecentRepertoireBook.js', 'generatedMubassarStyleProfile.js']

async function withBuilder(check) {
  const directory = await mkdtemp(path.join(root, 'node_modules', '.repertoire-test-'))
  try {
    await mkdir(path.join(directory, 'scripts'))
    await mkdir(path.join(directory, 'src/data'), { recursive: true })
    const script = path.join(directory, 'scripts/buildRecentRepertoireBook.mjs')
    await copyFile(path.join(root, 'scripts/buildRecentRepertoireBook.mjs'), script)
    for (const filename of outputFiles) {
      await writeFile(path.join(directory, 'src/data', filename), 'existing data')
    }
    await check(directory, script)
  } finally {
    assert.ok(directory.startsWith(path.join(root, 'node_modules', '.repertoire-test-')))
    await rm(directory, { recursive: true, force: true })
  }
}

function runBuilder(script, failAccount, archiveMonths) {
  const mock = `
    const pgn = (username, date) => '[Event "test"]\\n[Date "' + date + '"]\\n[White "' + username + '"]\\n[Black "opponent"]\\n[Result "1-0"]\\n\\n1. d4 d5 2. c4 e6 1-0';
    globalThis.fetch = async (url) => {
      const address = String(url);
      if (address.includes('chess.com')) {
        if (address.endsWith('/archives')) return Response.json({ archives: ${archiveMonths ? 'Array.from({ length: 8 }, (_, index) => "https://api.chess.com/month/" + index)' : '[]'} });
        return Response.json({ games: [{ rules: 'chess', pgn: pgn('keepitcoming', '2025.01.01') }] });
      }
      const username = new URL(address).pathname.split('/').at(-1);
      if (${failAccount} && username === 'guardup') return new Response('', { status: 403 });
      return new Response(pgn(username, '2025.01.01') + '\\n\\n' + pgn(username, '2099.01.01'));
    };
  `
  const options = ['--import', `data:text/javascript,${encodeURIComponent(mock)}`, script, '--profile', 'mubassar']
  if (archiveMonths) options.push('--archive-months', String(archiveMonths))
  return spawnSync(process.execPath, options, {
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true,
  })
}
