import { test, expect } from '@playwright/test'

test('the setup screen opens when browser policy denies storage access', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage access denied', 'SecurityError')
      },
    })
  })

  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.locator('[data-square="e2"]').click()
  await page.locator('[data-square="e4"]').click()
  await expect(page.locator('.move-table')).toContainText('e4')
  expect(errors).toEqual([])
})
