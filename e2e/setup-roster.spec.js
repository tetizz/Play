import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

function familyButton(roster, name) {
  return roster.getByRole('button', { name, exact: true })
}

async function controlledPanel(page, button) {
  const id = await button.getAttribute('aria-controls')
  expect(id).toBeTruthy()
  return page.locator(`[id="${id}"]`)
}

test('bot families expand one at a time with mouse and keyboard', async ({ page }) => {
  const roster = page.locator('.bot-roster')
  const player = familyButton(roster, 'Player Bots')
  const stockfish = familyButton(roster, 'Stockfish Variants')
  const martin = familyButton(roster, 'Martin Variants')
  const playerPanel = await controlledPanel(page, player)
  const stockfishPanel = await controlledPanel(page, stockfish)
  const martinPanel = await controlledPanel(page, martin)

  await expect(player).toHaveAttribute('aria-expanded', 'true')
  await expect(playerPanel.getByRole('button', { name: /Brian Arthur/ })).toBeVisible()
  await expect(playerPanel.getByRole('button', { name: /^Kirk / })).toBeVisible()
  await expect(playerPanel.getByRole('button', { name: /^Aleksandr Lenderman / })).toBeVisible()
  await expect(stockfish).toHaveAttribute('aria-expanded', 'false')
  await expect(martin).toHaveAttribute('aria-expanded', 'false')
  await expect(playerPanel.getByRole('button', { name: /Mubassar/ })).toBeVisible()
  await expect(stockfishPanel.getByRole('button', { name: /PityFish/ })).toBeHidden()
  await expect(martinPanel.getByRole('button', { name: /Smartin/ })).toBeHidden()

  await stockfish.click()
  await expect(player).toHaveAttribute('aria-expanded', 'false')
  await expect(stockfish).toHaveAttribute('aria-expanded', 'true')
  await expect(stockfishPanel.getByRole('button', { name: /PityFish/ })).toBeVisible()

  await martin.focus()
  await page.keyboard.press('Enter')
  await expect(stockfish).toHaveAttribute('aria-expanded', 'false')
  await expect(martin).toHaveAttribute('aria-expanded', 'true')
  await expect(martinPanel.getByRole('button', { name: /Smartin/ })).toBeVisible()
  await expect(martinPanel.getByRole('button', { name: /^Martin Starts at 250 Elo and gains 200 Elo/ })).toBeVisible()

  await player.focus()
  await page.keyboard.press('Space')
  await expect(player).toHaveAttribute('aria-expanded', 'true')
  await expect(martin).toHaveAttribute('aria-expanded', 'false')
})

test('selecting a bot keeps its family open and updates the profile', async ({ page }) => {
  const roster = page.locator('.bot-roster')
  const stockfish = familyButton(roster, 'Stockfish Variants')
  const stockfishPanel = await controlledPanel(page, stockfish)

  await stockfish.click()
  const pityFish = stockfishPanel.getByRole('button', { name: /PityFish/ })
  await pityFish.click()

  await expect(stockfish).toHaveAttribute('aria-expanded', 'true')
  await expect(pityFish).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'PityFish', exact: true })).toBeVisible()
})

test('a newly selected opening profile exposes honest readiness while it loads', async ({ page }) => {
  let releaseBook
  const bookGate = new Promise((resolve) => { releaseBook = resolve })
  await page.route('**/src/data/generatedRecentAkshitRepertoireBook.js*', async (route) => {
    await bookGate
    await route.continue()
  })

  const roster = page.locator('.bot-roster')
  const playerPanel = page.locator('.setup-player-panel')
  await roster.getByRole('button', { name: /Akshit Sharma/ }).click()
  await expect(playerPanel.getByRole('status')).toHaveText('Preparing opponent')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()

  releaseBook()
  await expect(playerPanel.getByRole('status')).toHaveText('Profile loaded for Akshit.')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
})

test('the public variants render in the roster and exclude Tony', async ({ page }) => {
  const roster = page.locator('.bot-roster')
  const stockfish = familyButton(roster, 'Stockfish Variants')
  const stockfishPanel = await controlledPanel(page, stockfish)
  const names = ['ClockFish', 'MirrorFish', 'ZebraFish', 'SimpFish', 'CheckFish', 'ScaredFish']

  await stockfish.click()
  for (const name of names) {
    const option = stockfishPanel.getByRole('button', { name: new RegExp(`^${name} `) })
    await expect(option).toBeVisible()
    const portrait = option.locator('img')
    await expect(portrait).toBeVisible()
    await expect.poll(() => portrait.evaluate((image) => image.complete && image.naturalWidth > 0))
      .toBe(true)
  }
  await expect(stockfishPanel.getByRole('button', { name: /^TortureFish / })).toBeVisible()
  await expect(roster.getByRole('button', { name: /Tony/i })).toHaveCount(0)
})

test('ClockFish uses the rating at move submission to play its Stockfish 19 reply', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.stockfishCommands = []
    window.stockfishLines = []
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options)
        this.addEventListener('message', ({ data }) => window.stockfishLines.push(data))
      }
      postMessage(command) {
        window.stockfishCommands.push(command)
        super.postMessage(command)
      }
    }
  })
  await page.reload()
  const start = new Date('2026-11-26T18:00:00Z')
  await page.clock.setFixedTime(start)
  await familyButton(page.locator('.bot-roster'), 'Stockfish Variants').click()
  const stockfishPanel = page.getByRole('region', { name: 'Stockfish Variants' })
  await stockfishPanel.getByRole('button', { name: /^ClockFish / }).click()
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Moves', exact: true })).toBeVisible()
  await page.clock.setFixedTime(new Date(start.getTime() + 2500))
  await page.locator('[data-square="e2"]').click()
  await page.locator('[data-square="e4"]').click()
  await page.clock.setFixedTime(new Date(start.getTime() + 5000))
  await expect(page.locator('.move-row button')).toHaveCount(2, { timeout: 30000 })
  const turn = await page.evaluate(() => ({
    commands: window.stockfishCommands,
    lines: window.stockfishLines,
    game: JSON.parse(localStorage.getItem('play-bots-session-v3')),
  }))
  expect(turn.commands).toContain('setoption name UCI_Elo value 1800')
  expect(turn.lines).toContain('id name Stockfish 19')
  const bestMove = turn.lines.find((line) => typeof line === 'string' && line.startsWith('bestmove '))
  expect(bestMove?.split(' ')[1]).toBe(`${turn.game.lastMove.from}${turn.game.lastMove.to}`)
  await expect(page.locator('.player-strip').filter({ hasText: 'ClockFish' })).toContainText('(0)')
})

test('an unavailable engine pauses the game and retry makes the actual move', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.rejectStockfishWorker = true
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        if (window.rejectStockfishWorker && String(url).includes('/stockfish/')) {
          throw new Error('Stockfish worker temporarily unavailable')
        }
        super(url, options)
      }
    }
  })
  await page.reload()
  await page.getByRole('button', { name: 'Black', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('.game-status').getByRole('status')).toHaveText('Stockfish could not finish this turn.')
  await expect(page.locator('.move-row button')).toHaveCount(0)

  await page.evaluate(() => { window.rejectStockfishWorker = false })
  await page.getByRole('button', { name: 'Retry analysis' }).click()
  await expect(page.getByRole('button', { name: 'd4', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry analysis' })).toHaveCount(0)
})
