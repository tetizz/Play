import { test, expect } from '@playwright/test'

test('an active saved game at checkmate resumes into game review', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('play-bots-session-v3', JSON.stringify({
      phase: 'game',
      gameMode: 'player',
      botId: 'trixize',
      humanColor: 'white',
      colorChoice: 'white',
      history: ['f3', 'e5', 'g4', 'Qh4#'],
    }))
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Game Review' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Move classifications' })).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.review-heading')).toContainText('Black wins by checkmate')
  await expect(page.locator('.evaluation-number')).toHaveText('0-1')
})
