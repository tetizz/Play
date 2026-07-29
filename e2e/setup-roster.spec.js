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
