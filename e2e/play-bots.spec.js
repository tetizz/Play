import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('Akshit legal markers and premove chain stay responsive', async ({ page }) => {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.getByRole('button', { name: /Akshit Sharma/ }).click()
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await page.locator('[data-square="e2"]').click()
  await expect(page.locator('[data-square="e4"] > div')).toHaveCSS('background-image', /radial-gradient/)
  await page.locator('[data-square="e4"]').click()
  await page.locator('[data-square="g1"]').click()
  await page.locator('[data-square="f3"]').click()

  await expect(page.getByRole('button', { name: 'Nf3', exact: true })).toBeVisible({ timeout: 12000 })
  await expect(page.getByText('Akshit is thinking')).toBeVisible()
  await expect(page.getByText(/AydenICN|AA01001|knightmanuveur_12|keepitcoming|trixize1234/i)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('reload during Mubassar bot delay resumes one forced d4 move', async ({ page }) => {
  await page.getByRole('button', { name: 'Black', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(350)
  await page.reload()
  await expect(page.getByRole('button', { name: 'd4', exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.move-row button').filter({ hasText: 'd4' })).toHaveCount(1)
})

test('mobile setup has no horizontal page overflow', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.reload()
    const sizes = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth)
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  }
})

test('all bots start as White, Black, and Random without exposing account names', async ({ page }) => {
  test.setTimeout(120000)
  for (const botName of ['Mubassar', 'Ayden Spellman', 'Akshit Sharma', 'Trixize']) {
    for (const color of ['White', 'Black', 'Random']) {
      await page.evaluate(() => localStorage.clear())
      await page.goto(`/?matrix=${encodeURIComponent(`${botName}-${color}`)}`)
      await page.getByRole('button', { name: new RegExp(botName) }).click()
      await page.getByRole('button', { name: color === 'Random' ? /Random/ : color, exact: color !== 'Random' }).click()
      await page.getByRole('button', { name: 'Play', exact: true }).click()
      await expect(page.locator('.board-surface')).toBeVisible()
      await expect(page.getByText(/AydenICN|AA01001|knightmanuveur_12|keepitcoming|real64squares|guardup|trixize1234/i)).toHaveCount(0)
    }
  }
})

test('Trixize opens with Nf3 and delivers the requested opening line', async ({ page }) => {
  await page.getByRole('button', { name: /Trixize/ }).click()
  await page.getByRole('button', { name: 'Black', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Nf3', exact: true })).toBeVisible({ timeout: 12000 })
  await expect(page.getByText('1. Nf3 is the starting move.')).toBeVisible()
})

test('cancelled drags restore the piece instead of leaving it invisible', async ({ page }) => {
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const pawn = page.locator('#play-bots-board-piece-wP-e2')
  const box = await pawn.boundingBox()
  const board = await page.locator('.board-surface').boundingBox()
  expect(box).not.toBeNull()
  expect(board).not.toBeNull()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(board.x + board.width + 30, board.y + board.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(page.locator('#play-bots-board-piece-wP-e2')).toBeVisible()
})

test('dragged pieces remain the size of one board square', async ({ page }) => {
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const pawn = page.locator('#play-bots-board-piece-wP-e2')
  const square = page.locator('[data-square="e2"]')
  const pawnBox = await pawn.boundingBox()
  const squareBox = await square.boundingBox()
  expect(pawnBox).not.toBeNull()
  expect(squareBox).not.toBeNull()

  await page.mouse.move(pawnBox.x + pawnBox.width / 2, pawnBox.y + pawnBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(pawnBox.x + squareBox.width * 0.8, pawnBox.y - squareBox.height * 0.8, { steps: 4 })

  const pieces = page.locator('[data-piece="wP"]')
  const pieceCount = await pieces.count()
  expect(pieceCount).toBeGreaterThanOrEqual(2)
  const boxes = await Promise.all(Array.from({ length: pieceCount }, (_, index) => pieces.nth(index).boundingBox()))
  const largest = Math.max(...boxes.filter(Boolean).map((box) => Math.max(box.width, box.height)))
  expect(largest).toBeLessThanOrEqual(squareBox.width * 1.08)

  await page.mouse.up()
  await expect(page.locator('[data-piece="wP"]')).toHaveCount(8)
  const remainingBoxes = await Promise.all(
    Array.from({ length: 8 }, (_, index) => page.locator('[data-piece="wP"]').nth(index).boundingBox()),
  )
  expect(Math.max(...remainingBoxes.filter(Boolean).map((box) => Math.max(box.width, box.height))))
    .toBeLessThanOrEqual(squareBox.width * 1.08)
})

test('Alt plus right drag draws a blue analysis arrow', async ({ page }) => {
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const from = await page.locator('[data-square="e2"]').boundingBox()
  const to = await page.locator('[data-square="e4"]').boundingBox()
  expect(from).not.toBeNull()
  expect(to).not.toBeNull()

  await page.keyboard.down('Alt')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 5 })
  await page.mouse.up({ button: 'right' })
  await page.keyboard.up('Alt')

  const arrowMarkup = await page.locator('.board-surface').innerHTML()
  expect(arrowMarkup).toMatch(/#3d8fe8|rgb\(61,\s*143,\s*232\)/i)
})

test('Fool’s Mate highlights the checked king and completes review promptly', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('play-bots-session-v3', JSON.stringify({
      phase: 'review',
      botId: 'mubassar',
      colorChoice: 'white',
      humanColor: 'white',
      history: ['f3', 'e5', 'g4', 'Qh4#'],
      beltMode: false,
      lastMove: { from: 'd8', to: 'h4' },
    }))
  })
  const startedAt = Date.now()
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Game Review' })).toBeVisible()
  await expect(page.locator('[data-square="e1"] > div')).toHaveCSS('background-image', /211,\s*43,\s*50/)
  await expect(page.getByRole('heading', { name: 'Move classifications' })).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('heading', { name: 'Game performance' })).toBeVisible()
  const evaluationData = await page.evaluate(() => ({
    graph: Number(document.querySelector('.evaluation-graph')?.dataset.evalPercent),
    bar: Number(document.querySelector('.evaluation-bar')?.dataset.evalPercent),
  }))
  expect(evaluationData.graph).toBe(evaluationData.bar)
  await page.getByRole('tab', { name: 'Review moves' }).click()
  await expect(page.locator('.move-explanation')).toContainText('Best move')
  expect(Date.now() - startedAt).toBeLessThan(8500)
})
