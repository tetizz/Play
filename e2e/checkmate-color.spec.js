import { test, expect } from '@playwright/test'

test('a White bot checkmating the Black player reports the correct winner', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('play-bots-session-v3', JSON.stringify({
      phase: 'game',
      gameMode: 'player',
      botId: 'trixize',
      humanColor: 'black',
      colorChoice: 'black',
      history: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6'],
    }))
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Game Review' })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.review-heading')).toContainText('White wins by checkmate')
})
