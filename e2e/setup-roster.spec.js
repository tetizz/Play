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

test('search, favorites, and recent opponents stay fast and persist separately', async ({ page }) => {
  const roster = page.locator('.bot-roster')
  const playerPanel = page.locator('.setup-player-panel')
  const search = page.getByRole('searchbox', { name: 'Search opponents' })

  await expect(playerPanel.getByText('Ready to play', { exact: true })).toBeVisible()
  await search.fill('ClockFish')
  await expect(roster.getByRole('button', { name: /^ClockFish / })).toBeVisible()
  await expect(roster.getByRole('button', { name: /Mubassar/ })).toHaveCount(0)
  await expect(page.getByText('1 opponent shown', { exact: true })).toBeVisible()

  await roster.getByRole('button', { name: /^ClockFish / }).click()
  await page.getByRole('button', { name: 'Favorite bot', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Favorited', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Clear opponent search', exact: true }).click()
  await expect(familyButton(roster, 'Stockfish Variants')).toHaveAttribute('aria-expanded', 'true')

  await page.getByRole('button', { name: /Favorites 1/, exact: true }).click()
  await expect(roster.getByRole('button', { name: /^ClockFish / })).toBeVisible()
  await page.getByRole('button', { name: /Recent 1/, exact: true }).click()
  await expect(roster.getByRole('button', { name: /^ClockFish / })).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('play-bots-session-v3')))
    .toBeNull()

  await page.reload()
  await page.getByRole('button', { name: /Favorites 1/, exact: true }).click()
  await expect(roster.getByRole('button', { name: /^ClockFish / })).toBeVisible()
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
  await expect(playerPanel.getByText('Preparing opponent', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled()

  releaseBook()
  await expect(playerPanel.getByText('Ready to play', { exact: true })).toBeVisible()
  await expect(playerPanel.getByText('Profile loaded for Akshit.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
})

test('the latest variants render, exclude Tony, and ClockFish plays a real turn', async ({ page }) => {
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
  await expect(roster.getByRole('button', { name: /Tony/i })).toHaveCount(0)

  await stockfishPanel.getByRole('button', { name: /^ClockFish / }).click()
  await page.getByRole('button', { name: 'Black', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Moves', exact: true })).toBeVisible()
  await expect(page.locator('.move-row button').first()).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.player-strip').filter({ hasText: 'ClockFish' })).toContainText('(100)')
})
