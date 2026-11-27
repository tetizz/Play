import { test, expect } from '@playwright/test'

const cases = [
  { name: 'White move pending Black reply', color: 'white', history: ['e4', 'e5', 'Nf3'], retained: ['e4', 'e5'] },
  { name: 'Black move pending White reply', color: 'black', history: ['e4', 'e5', 'Nf3', 'Nc6'], retained: ['e4', 'e5', 'Nf3'] },
  { name: 'White move with a completed Black reply', color: 'white', history: ['e4', 'e5', 'Nf3', 'Nc6'], retained: ['e4', 'e5'] },
  { name: 'Black move with a completed White reply', color: 'black', history: ['e4', 'e5', 'Nf3'], retained: ['e4'] },
]

for (const scenario of cases) {
  test(`undo returns to the player decision before ${scenario.name}`, async ({ page }) => {
    await page.addInitScript(({ color, history }) => {
      localStorage.setItem('play-bots-session-v3', JSON.stringify({
        phase: 'game',
        gameMode: 'player',
        botId: 'trixize',
        humanColor: color,
        colorChoice: color,
        history,
      }))
      const nativeSetTimeout = window.setTimeout.bind(window)
      window.setTimeout = (handler, delay, ...args) =>
        nativeSetTimeout(handler, delay === 250 ? 60000 : delay, ...args)
    }, scenario)

    await page.goto('/')
    await expect(page.locator('.move-table')).toContainText(scenario.history.at(-1))
    await page.getByRole('button', { name: 'Undo', exact: true }).click()

    await expect.poll(() => page.evaluate(() =>
      JSON.parse(localStorage.getItem('play-bots-session-v3')).history,
    )).toEqual(scenario.retained)
    await expect(page.locator('.game-status').getByRole('status')).toHaveText('Your move')
  })
}
