import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('Akshit legal markers and premoves stay responsive', async ({ page }) => {
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
  await expect(page.locator('.dialogue-row.bot-speaking .avatar-medium')).toHaveCSS(
    'animation-name',
    'botAvatarReact',
  )
  await expect(page.locator('.dialogue-row.bot-speaking .speech-bubble')).toHaveCSS(
    'animation-iteration-count',
    '1',
  )
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

test('a claimable threefold position continues instead of ending as a draw', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('play-bots-session-v3', JSON.stringify({
      botId: 'trixize',
      gameMode: 'player',
      colorChoice: 'black',
      humanColor: 'black',
      history: ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'],
      phase: 'game',
      beltMode: false,
      premoveQueue: [],
      dialogueLog: [],
    }))
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Game Review' })).toHaveCount(0)
  await expect(page.getByText('Your move', { exact: true })).toBeVisible({ timeout: 12000 })
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('play-bots-session-v3') || '{}').history?.length,
  ), { timeout: 12000 }).toBe(9)
})

test('setup and game board fit desktop and mobile without horizontal overflow', async ({ page }) => {
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

  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    const layout = await page.locator('.board-surface').evaluate((board) => {
      const box = board.getBoundingClientRect()
      return {
        left: box.left,
        right: box.right,
        width: box.width,
        height: box.height,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }
    })
    expect(layout.left).toBeGreaterThanOrEqual(0)
    expect(layout.right).toBeLessThanOrEqual(viewport.width)
    expect(Math.abs(layout.width - layout.height)).toBeLessThanOrEqual(1)
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth)
    await expect(page.locator('[data-square="a1"]')).toContainText(/a|1/)
  }
})

test('Trixize and Akshit play and talk in Bot vs Bot mode', async ({ page }) => {
  test.setTimeout(30000)
  await page.getByRole('tab', { name: 'Bot vs Bot' }).click()
  await expect(page.getByRole('heading', { name: 'Bot vs Bot' })).toBeVisible()
  await expect(page.getByLabel('White bot')).toHaveValue('trixize')
  await expect(page.getByLabel('Black bot')).toHaveValue('akshit')
  await page.getByRole('button', { name: 'Start match', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Nf3', exact: true })).toBeVisible({ timeout: 12000 })
  await expect(page.getByText('1. Nf3 is the starting move.')).toBeVisible()
  await expect(page.locator('.move-row button').filter({ hasText: /.+/ })).toHaveCount(2, { timeout: 15000 })
  const conversation = page.getByLabel('Bot conversation')
  await expect(conversation.locator('.conversation-row')).toHaveCount(2)
  await expect(conversation.locator('.conversation-row.active-speaker')).toHaveCount(1)
  await expect(conversation.locator('.conversation-row.active-speaker .avatar-small')).toHaveCSS(
    'animation-name',
    'botAvatarReact',
  )
  await expect(conversation.getByText('Trixize', { exact: true })).toBeVisible()
  await expect(conversation.getByText('Akshit', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'End match', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Game Review' })).toBeVisible()
})

test('promotion picker supports underpromotion to a knight', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('play-bots-session-v3', JSON.stringify({
      phase: 'game',
      gameMode: 'player',
      botId: 'mubassar',
      colorChoice: 'white',
      humanColor: 'white',
      history: ['a4', 'h5', 'a5', 'h4', 'a6', 'h3', 'axb7', 'hxg2'],
      beltMode: false,
      lastMove: { from: 'h3', to: 'g2' },
      premoveQueue: [],
      dialogueLog: [],
    }))
  })
  await page.reload()
  await page.locator('[data-square="b7"]').click()
  await page.locator('[data-square="a8"]').click()
  await expect(page.getByRole('dialog', { name: 'Promote pawn' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Promote to Queen' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Promote to Rook' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Promote to Bishop' })).toBeVisible()
  await page.getByRole('button', { name: 'Promote to Knight' }).click()
  await expect(page.getByRole('button', { name: 'bxa8=N', exact: true })).toBeVisible()
})

test('projected same-piece premoves append in FIFO order and execute one per bot reply', async ({ page }) => {
  test.setTimeout(35000)
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, delay, ...args) =>
      nativeSetTimeout(handler, delay === 850 ? 3500 : delay, ...args)
  })
  await page.reload()
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.locator('[data-square="e2"]').click()
  await page.locator('[data-square="e4"]').click()

  await page.locator('[data-square="g1"]').click()
  await page.locator('[data-square="f3"]').click()
  await page.locator('[data-square="f3"]').click()
  await page.locator('[data-square="g5"]').click()
  await page.locator('[data-square="g5"]').click()
  await page.locator('[data-square="h7"]').click()

  await expect(page.getByText('3 premoves queued', { exact: true })).toBeVisible()
  await expect(page.locator('.board-surface')).toHaveAttribute('data-premove-count', '3')
  await expect(page.locator('#play-bots-board-piece-wN-h7')).toBeVisible()
  await expect(page.locator('[data-square="g1"] > div')).toHaveCSS(
    'background-color',
    /rgba?\(205,\s*55,\s*64/,
  )
  for (const square of ['f3', 'g5', 'h7']) {
    await expect(page.locator(`[data-square="${square}"] > div`)).toHaveCSS(
      'background-color',
      /rgba?\(205,\s*55,\s*64/,
    )
  }
  await expect(page.locator('[data-square="h7"]')).toHaveAttribute('data-premove-step', '3')
  await expect(page.locator('[data-square="f3"]')).toHaveAttribute(
    'aria-label',
    /premove 1 destination, premove 2 source/,
  )
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('play-bots-session-v3') || '{}').premoveQueue?.length,
  )).toBe(3)

  await expect(page.getByRole('button', { name: 'Nf3', exact: true })).toBeVisible({
    timeout: 15000,
  })
  await expect(page.getByText('2 premoves queued', { exact: true })).toBeVisible()
  await expect(page.locator('.board-surface')).toHaveAttribute('data-premove-count', '2')
  await expect(page.locator('[data-square="g1"] > div')).not.toHaveCSS(
    'background-color',
    /rgba?\(205,\s*55,\s*64/,
  )
})

test('a ready-turn premove is consumed instead of remaining active after the bot move', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('play-bots-session-v3', JSON.stringify({
      phase: 'game',
      gameMode: 'player',
      botId: 'mubassar',
      colorChoice: 'white',
      humanColor: 'white',
      history: ['Nf3', 'd5', 'g3', 'Nf6', 'Bg2', 'c5', 'O-O', 'Nc6', 'd3', 'e5', 'Nbd2', 'Be7'],
      beltMode: false,
      lastMove: { from: 'f8', to: 'e7' },
      premoveQueue: [{ id: 'stuck-e4', from: 'e2', to: 'e4', promotion: 'q' }],
      dialogueLog: [],
    }))
  })
  await page.reload()

  await expect(page.getByRole('button', { name: 'e4', exact: true })).toBeVisible({
    timeout: 10000,
  })
  await expect(page.locator('.board-surface')).toHaveAttribute('data-premove-count', '0')
  await expect(page.getByText(/premoves? queued/)).toHaveCount(0)
})

test('a three-move queue plays through three alternating Trixize replies', async ({ page }) => {
  test.setTimeout(50000)
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, delay, ...args) =>
      nativeSetTimeout(handler, delay === 850 ? 1500 : delay, ...args)
  })
  await page.reload()
  await page.getByRole('button', { name: /Trixize/ }).click()
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await page.locator('[data-square="e2"]').click()
  await page.locator('[data-square="e4"]').click()
  for (const [from, to] of [['d2', 'd4'], ['b1', 'c3'], ['g1', 'f3']]) {
    await page.locator(`[data-square="${from}"]`).click()
    await page.locator(`[data-square="${to}"]`).click()
  }
  await expect(page.getByText('3 premoves queued', { exact: true })).toBeVisible()

  await expect(page.locator('.move-row button')).toHaveCount(8, {
    timeout: 45000,
  })
  await expect(page.locator('.board-surface')).toHaveAttribute('data-premove-count', '0')
  await expect(page.getByText(/premoves? queued/)).toHaveCount(0)
  const moves = (await page.locator('.move-row button').allTextContents()).filter(Boolean)
  expect(moves.filter((_, index) => index % 2 === 0)).toEqual(['e4', 'd4', 'Nc3', 'Nf3'])
})

test('multiple projected premoves remain usable on a mobile board', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, delay, ...args) =>
      nativeSetTimeout(handler, delay === 850 ? 3500 : delay, ...args)
  })
  await page.reload()
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.locator('[data-square="e2"]').click()
  await page.locator('[data-square="e4"]').click()
  for (const [from, to] of [['g1', 'f3'], ['f3', 'g5'], ['g5', 'h7']]) {
    await page.locator(`[data-square="${from}"]`).click()
    await page.locator(`[data-square="${to}"]`).click()
  }

  await expect(page.getByText('3 premoves queued', { exact: true })).toBeVisible()
  const layout = await page.evaluate(() => {
    const clearButton = document.querySelector('.premove-status button')?.getBoundingClientRect()
    const board = document.querySelector('.board-surface')?.getBoundingClientRect()
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      boardWidth: board?.width,
      boardHeight: board?.height,
      clearWidth: clearButton?.width,
      clearHeight: clearButton?.height,
    }
  })
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth)
  expect(Math.abs(layout.boardWidth - layout.boardHeight)).toBeLessThanOrEqual(1)
  expect(layout.clearWidth).toBeGreaterThanOrEqual(44)
  expect(layout.clearHeight).toBeGreaterThanOrEqual(44)

  await page.getByRole('button', { name: 'Clear all 3 queued premoves' }).click()
  await expect(page.locator('.board-surface')).toHaveAttribute('data-premove-count', '0')
})

test('a deep repeated-square queue keeps badges and labels compact on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, delay, ...args) =>
      nativeSetTimeout(handler, delay === 250 || delay === 850 ? 3500 : delay, ...args)
    const cycle = [
      { from: 'g1', to: 'f3' },
      { from: 'f3', to: 'g5' },
      { from: 'g5', to: 'f3' },
      { from: 'f3', to: 'g1' },
    ]
    localStorage.setItem('play-bots-session-v3', JSON.stringify({
      phase: 'game',
      gameMode: 'player',
      botId: 'mubassar',
      colorChoice: 'white',
      humanColor: 'white',
      history: ['e4'],
      beltMode: false,
      lastMove: { from: 'e2', to: 'e4' },
      premoveQueue: Array.from({ length: 40 }, (_, index) => ({
        id: `deep-${index}`,
        promotion: 'q',
        ...cycle[index % cycle.length],
      })),
      dialogueLog: [],
    }))
  })
  await page.reload()

  await expect(page.locator('.board-surface')).toHaveAttribute('data-premove-count', '40')
  await expect(page.getByText('40 premoves queued', { exact: true })).toBeVisible()
  const compact = await page.locator('[data-square="f3"]').evaluate((square) => {
    const badgeWidth = Number.parseFloat(
      getComputedStyle(square, '::after').width,
    )
    return {
      badge: square.dataset.premoveStep,
      badgeWidth,
      labelLength: square.getAttribute('aria-label')?.length,
      squareWidth: square.getBoundingClientRect().width,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  expect(compact.badge).toMatch(/^\d+\+\d+$/)
  expect(compact.badgeWidth).toBeLessThan(compact.squareWidth)
  expect(compact.labelLength).toBeLessThan(180)
  expect(compact.overflow).toBe(0)
})

test('resigning clears queued premoves from the persisted review', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, delay, ...args) =>
      nativeSetTimeout(handler, delay === 850 ? 3500 : delay, ...args)
  })
  await page.reload()
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.locator('[data-square="e2"]').click()
  await page.locator('[data-square="e4"]').click()
  await page.locator('[data-square="g1"]').click()
  await page.locator('[data-square="f3"]').click()
  await expect(page.getByText('1 premove queued', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Resign', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Game Review' })).toBeVisible()
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('play-bots-session-v3') || '{}').premoveQueue?.length,
  )).toBe(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Game Review' })).toBeVisible()
  await expect(page.locator('.board-surface')).toHaveAttribute('data-premove-count', '0')
})

test('a queued premove can be cancelled with Escape or the visible cancel button', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, delay, ...args) =>
      nativeSetTimeout(handler, delay === 850 ? 3500 : delay, ...args)
  })
  await page.reload()
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.locator('[data-square="e2"]').click()
  await page.locator('[data-square="e4"]').click()

  await page.locator('[data-square="g1"]').click()
  await page.locator('[data-square="f3"]').click()
  await expect(page.getByText('1 premove queued', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText(/premoves? queued/)).toHaveCount(0)
  await expect(page.locator('.board-surface')).toHaveAttribute('data-has-premove', 'false')

  await page.locator('[data-square="b1"]').click()
  await page.locator('[data-square="c3"]').click()
  await expect(page.getByText('1 premove queued', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear all 1 queued premove' }).click()
  await expect(page.getByText(/premoves? queued/)).toHaveCount(0)
  await expect(page.locator('.board-surface')).toHaveAttribute('data-has-premove', 'false')
})

test('keyboard users can move, premove, navigate, and cancel on the board', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, delay, ...args) =>
      nativeSetTimeout(handler, delay === 850 ? 3500 : delay, ...args)
  })
  await page.reload()
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  const e2 = page.locator('[data-square="e2"]')
  await e2.focus()
  await expect(e2).toHaveAttribute('role', 'button')
  await expect(e2).toHaveAttribute('tabindex', '0')
  await expect(e2).toHaveAttribute('aria-label', /e2, White pawn/)
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('[data-square="e3"]')).toBeFocused()
  await expect(page.locator('[data-square="e3"]')).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('[data-square="e4"]')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'e4', exact: true })).toBeVisible()

  await page.locator('[data-square="g1"]').focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('[data-square="f3"]')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByText('1 premove queued', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText(/premoves? queued/)).toHaveCount(0)

  await page.locator('[data-square="f1"]').focus()
  await expect(page.getByRole('button', { name: 'Next move' })).toBeDisabled()
  await expect(page.locator('.move-row button')).toHaveCount(2, { timeout: 12000 })
  await expect(page.locator('[data-square="f1"]')).toBeFocused()

  await page.locator('[data-square="g1"]').focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('[data-square="f3"]')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Nf3', exact: true })).toBeVisible()

  await page.locator('[data-square="b1"]').focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('[data-square="c3"]')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByText('1 premove queued', { exact: true })).toBeVisible()
  await expect(page.locator('[data-square="b1"]')).toHaveAttribute('aria-label', /premove 1 source/)
  await expect(page.locator('[data-square="c3"]')).toHaveAttribute('aria-label', /premove 1 destination/)

  await page.keyboard.press('Escape')
  await expect(page.getByText(/premoves? queued/)).toHaveCount(0)
  await expect(page.locator('.board-surface')).toHaveAttribute('data-has-premove', 'false')
})

test('a king that has moved cannot highlight or queue a castling premove', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('play-bots-session-v3', JSON.stringify({
      phase: 'game',
      gameMode: 'player',
      botId: 'akshit',
      colorChoice: 'white',
      humanColor: 'white',
      history: ['Nf3', 'a6', 'g3', 'a5', 'Bg2', 'a4', 'Kf1', 'a3', 'Ke1'],
      beltMode: false,
      premoveQueue: [],
      dialogueLog: [],
    }))
  })
  await page.reload()

  await page.locator('[data-square="e1"]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-square="g1"] > div')).not.toHaveCSS(
    'background-image',
    /radial-gradient/,
  )
  await page.locator('[data-square="g1"]').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/premoves? queued/)).toHaveCount(0)
  await expect(page.locator('.board-surface')).toHaveAttribute('data-has-premove', 'false')
})

test('speaking reactions respect reduced motion without delaying the game', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await expect(page.locator('.dialogue-row.bot-speaking .avatar-medium')).toHaveCSS(
    'animation-name',
    'none',
  )
  await page.locator('[data-square="e2"]').click()
  await page.locator('[data-square="e4"]').click()
  await expect(page.locator('.move-row button')).toHaveCount(2, { timeout: 12000 })
})

test('zero-move resignation review reflects the terminal result', async ({ page }) => {
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Resign', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Game Review' })).toBeVisible()
  await expect(page.locator('[data-square][role="button"]')).toHaveCount(0)
  await expect(page.getByText('Black wins by resignation', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Move classifications' })).toBeVisible()
  const graph = await page.evaluate(() => ({
    percent: Number(document.querySelector('.evaluation-graph')?.dataset.evalPercent),
    line: document.querySelector('.evaluation-line')?.getAttribute('d'),
    area: document.querySelector('.evaluation-white-area')?.getAttribute('d'),
    activeMarkers: document.querySelectorAll('.evaluation-active').length,
  }))
  expect(graph.percent).toBe(0)
  expect(graph.line).toBe('M 0 132 L 640 132')
  expect(graph.area).toBe('M 0 132 L 640 132 L 640 132 L 0 132 Z')
  expect(graph.activeMarkers).toBe(0)
  await expect(page.locator('.evaluation-line-shadow')).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Game Review' })).toBeVisible()
  await expect(page.getByText('Black wins by resignation', { exact: true })).toBeVisible()
})

test('completed reviews expose a selectable PGN and copy it without downloading', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedPgn = text
        },
      },
    })
  })
  await page.evaluate(() => {
    localStorage.setItem('play-bots-session-v3', JSON.stringify({
      phase: 'review',
      botId: 'mubassar',
      colorChoice: 'white',
      humanColor: 'white',
      history: ['f4', 'e5', 'g4', 'Qh4#'],
      beltMode: false,
      lastMove: { from: 'd8', to: 'h4' },
    }))
  })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Move classifications' })).toBeVisible({
    timeout: 10000,
  })
  await page.getByRole('button', { name: 'Share PGN', exact: true }).click()
  const pgnField = page.getByRole('textbox', { name: 'PGN text' })
  await expect(pgnField).toBeVisible()
  await expect(pgnField).toHaveValue(/\[White "player"\]/)
  await page.getByRole('button', { name: 'Copy PGN', exact: true }).click()
  await expect(page.getByText('PGN copied', { exact: true })).toBeVisible()

  const pgn = await page.evaluate(() => window.__copiedPgn)
  expect(pgn).toContain('[White "player"]')
  expect(pgn).toContain('[Black "Mubassar"]')
  expect(pgn).toContain('[Result "0-1"]')
  expect(pgn).toContain('1. f4 e5 2. g4 Qh4# 0-1')
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

test('Trixize always enters the requested Nf3 d5 theory branch', async ({ page }) => {
  test.setTimeout(50000)

  const playAgainstD5 = async (randomValue) => {
    await page.evaluate(() => localStorage.clear())
    await page.goto('/')
    await page.evaluate((value) => {
      Math.random = () => value
    }, randomValue)
    await page.getByRole('button', { name: /Trixize/ }).click()
    await page.getByRole('button', { name: 'Black', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Nf3', exact: true })).toBeVisible({
      timeout: 15000,
    })
    await page.locator('[data-square="d7"]').click()
    await page.locator('[data-square="d5"]').click()
    await expect(page.getByRole('button', { name: 'g3', exact: true })).toBeVisible({
      timeout: 20000,
    })
    return page.locator('.move-row button').allTextContents()
  }

  const mainLine = await playAgainstD5(0)
  expect(mainLine.filter(Boolean)).toEqual(['Nf3', 'd5', 'g3'])

  const repeatedLine = await playAgainstD5(0.999)
  expect(repeatedLine.filter(Boolean)).toEqual(['Nf3', 'd5', 'g3'])
})

test('Trixize follows the full Black Pirc and Kings Indian repertoires', async ({ page }) => {
  test.setTimeout(70000)

  const startTrixizeAsBlack = async () => {
    await page.evaluate(() => localStorage.clear())
    await page.goto('/')
    await page.evaluate(() => {
      Math.random = () => 0
    })
    await page.getByRole('button', { name: /Trixize/ }).click()
    await page.getByRole('button', { name: 'White', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
  }
  const playAndWait = async (from, to, expectedSan) => {
    await page.locator(`[data-square="${from}"]`).click()
    await page.locator(`[data-square="${to}"]`).click()
    await expect(page.getByRole('button', { name: expectedSan, exact: true })).toBeVisible({
      timeout: 15000,
    })
  }

  await startTrixizeAsBlack()
  await playAndWait('e2', 'e4', 'd6')
  await playAndWait('d2', 'd4', 'Nf6')
  await playAndWait('b1', 'c3', 'g6')
  await playAndWait('g1', 'f3', 'Bg7')

  await startTrixizeAsBlack()
  await playAndWait('d2', 'd4', 'Nf6')
  await playAndWait('c2', 'c4', 'g6')
  await playAndWait('b1', 'c3', 'Bg7')
  await playAndWait('e2', 'e4', 'd6')
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
      history: ['f4', 'e5', 'g4', 'Qh4#'],
      beltMode: false,
      lastMove: { from: 'd8', to: 'h4' },
    }))
  })
  const startedAt = Date.now()
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Game Review' })).toBeVisible()
  await expect(page.locator('[data-square="e1"] > div')).toHaveCSS('background-image', /211,\s*43,\s*50/)
  await expect(page.getByRole('heading', { name: 'Move classifications' })).toBeVisible({ timeout: 8000 })
  await expect(page.locator('.bot-metric')).toHaveText('100.0%')
  await expect(page.locator('.classification-row').filter({ hasText: 'Book' })).toContainText('1')
  await expect(page.locator('.classification-row').filter({ hasText: 'Best' })).toContainText('1')
  await expect(page.getByRole('heading', { name: 'Game performance' })).toBeVisible()
  await page.getByRole('button', { name: 'Black Best: 1. Go to first occurrence.' }).click()
  await expect(page.getByRole('tab', { name: 'Review moves' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.move-explanation')).toContainText('Qh4#')
  const reviewScrollTop = await page.evaluate(() => document.querySelector('.review-scroll')?.scrollTop)
  expect(reviewScrollTop).toBe(0)
  const evaluationData = await page.evaluate(() => ({
    graph: Number(document.querySelector('.evaluation-graph')?.dataset.evalPercent),
    bar: Number(document.querySelector('.evaluation-bar')?.dataset.evalPercent),
    path: document.querySelector('.evaluation-line')?.getAttribute('d') || '',
  }))
  expect(evaluationData.graph).toBe(evaluationData.bar)
  expect(evaluationData.path).toContain(' C ')
  expect(evaluationData.path).not.toMatch(/[HV]/)
  await expect(page.locator('.evaluation-number')).toHaveText('0-1')
  await page.getByRole('button', { name: 'Previous', exact: true }).click()
  await expect(page.locator('.evaluation-number')).toHaveText('M1')
  await page.getByRole('tab', { name: 'Review moves' }).click()
  await expect(page.locator('.move-explanation')).toContainText('Best move')
  expect(Date.now() - startedAt).toBeLessThan(8500)
})

test('a played Fool’s Mate reaches a complete synchronized review', async ({ page }) => {
  test.setTimeout(30000)
  await page.getByRole('button', { name: /Trixize/ }).click()
  await page.getByRole('button', { name: 'White', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  await page.locator('[data-square="f2"]').click()
  await page.locator('[data-square="f3"]').click()
  await expect(page.getByRole('button', { name: 'e5', exact: true })).toBeVisible({ timeout: 10000 })

  await page.locator('[data-square="g2"]').click()
  await page.locator('[data-square="g4"]').click()
  await expect(page.getByRole('heading', { name: 'Game Review' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Black wins by checkmate')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Move classifications' })).toBeVisible({ timeout: 8000 })

  const evaluationData = await page.evaluate(() => ({
    graph: Number(document.querySelector('.evaluation-graph')?.dataset.evalPercent),
    bar: Number(document.querySelector('.evaluation-bar')?.dataset.evalPercent),
  }))
  expect(evaluationData.graph).toBe(evaluationData.bar)

  await page.getByRole('tab', { name: 'Review moves' }).click()
  await expect(page.getByText('Qh4# was Stockfish’s first choice.')).toBeVisible()
  await expect(page.getByText('Best move', { exact: true })).toBeVisible()
})
