import { randomUUID } from 'crypto'
import { expect as baseExpect, test as base, type APIRequestContext, type Locator, type Page } from '@playwright/test'

import { countPlayedAudio, silentWav } from './audio'
import { createMember, DEFAULT_PIN } from './member'

// The child's pages on the screens they are used on: tablets most of all, and phones, held upright
// and turned sideways. Each touch project (see playwright.config.ts) gets its own member with a full
// board and a game; the tests tap with touch events, as a finger does. They create an account, so
// they run only against a local server; Playwright's global teardown deletes it.

type BoardShape = { cols: number; words: string[] }

// A board as a parent fills one: six columns, words in reading order, every other with a picture,
// and long words that have to shrink to fit a phone's tile. Six columns fit an upright tablet.
const BOARD: BoardShape = {
  cols: 6,
  words: [
    ...['mina', 'sina', 'tahan', 'ei', 'jah', 'veel'],
    ...['süüa', 'juua', 'mängida', 'magada', 'õue', 'koju'],
    ...['ema', 'isa', 'vanaema', 'sõber', 'õpetaja', 'kass'],
    ...['rõõmus', 'kurb', 'väsinud', 'mänguväljak', 'aitäh', 'palun'],
  ],
}
const WORDS = BOARD.words
// Eight columns are too many for an upright tablet, which shows four, rearranged.
const WIDE_BOARD: BoardShape = {
  cols: 8,
  words: [
    ...['üks', 'kaks', 'kolm', 'neli', 'viis', 'kuus', 'seitse', 'kaheksa'],
    ...['punane', 'sinine', 'kollane', 'roheline', 'must', 'valge', 'hall', 'pruun'],
  ],
}
// Normalized dots, in the order they are connected.
const DOTS = [
  { x: 0.2, y: 0.3 },
  { x: 0.5, y: 0.75 },
  { x: 0.8, y: 0.3 },
  { x: 0.5, y: 0.15 },
]

type Member = {
  boardId: number
  boardName: string
  cookies: Awaited<ReturnType<APIRequestContext['storageState']>>['cookies']
  puzzleId: number
  wideBoardId: number
}

// The cells of a board, row by row in the given words' order.
const cellsOf = ({ cols, words }: BoardShape) =>
  words.map((title, index) => ({
    id: randomUUID(),
    x: index % cols,
    y: Math.floor(index / cols),
    w: 1,
    h: 1,
    title,
    ...(index % 2 === 0 ? { externalImageURL: '/logo.png' } : {}),
  }))

const test = base.extend<object, { member: Member }>({
  // One member per worker, made through the API, so the tests start on the member's own pages.
  member: [
    async ({ playwright }, use, workerInfo) => {
      const api = await playwright.request.newContext({ baseURL: workerInfo.project.use.baseURL })
      const { run } = await createMember(api)

      const createBoard = async (name: string, shape: BoardShape) => {
        const response = await api.post('/api/boards', {
          data: {
            name,
            pinned: true,
            actionBar: { enabled: true },
            grid: { cols: shape.cols, rows: shape.words.length / shape.cols, cells: cellsOf(shape) },
          },
        })
        baseExpect(response.status(), await response.text()).toBe(201)
        return (await response.json()).doc.id as number
      }
      const boardName = `Seadmetahvel ${run}`
      const boardId = await createBoard(boardName, BOARD)
      const wideBoardId = await createBoard(`Lai tahvel ${run}`, WIDE_BOARD)

      const puzzle = await api.post('/api/connect-dots-puzzles', {
        data: { title: `Punktimäng ${run}`, slug: `punktimang-${run}`, enabled: true, pinned: true, externalImageURL: '/og-image.jpg', dots: DOTS },
      })
      baseExpect(puzzle.status(), await puzzle.text()).toBe(201)

      const { cookies } = await api.storageState()
      await use({ boardId, boardName, cookies, puzzleId: (await puzzle.json()).doc.id, wideBoardId })
      await api.dispose()
    },
    { scope: 'worker' },
  ],
  // The member is logged in on every page the test opens.
  storageState: async ({ member }, provide) => provide({ cookies: member.cookies, origins: [] }),
})

test.skip(!!process.env.SMOKE_BASE_URL, 'Creates an account, so it never runs against a deployed site.')
test.skip(({ hasTouch }) => !hasTouch, 'Touch screens only.')

// The dev server compiles each route on its first request, which takes more than the default 5s on
// CI runners.
const expect = baseExpect.configure({ timeout: 30_000 })

type Viewport = { width: number; height: number }

// The device as it comes (upright) and turned sideways.
function orientations(viewport: Viewport | null): Array<[string, Viewport]> {
  const { width, height } = viewport!
  const upright = { width: Math.min(width, height), height: Math.max(width, height) }
  return [
    ['upright', upright],
    ['sideways', { width: upright.height, height: upright.width }],
  ]
}

async function enterParentView(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([{ name: 'uiMode', value: 'parent', url: baseURL! }])
}

// Nothing makes the page wider than the screen: a sideways swipe must not move the page.
async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'horizontal scroll in px').toBeLessThanOrEqual(0)
}

// The element is fully on the screen (after scrolling it into view).
async function expectOnScreen(page: Page, locator: Locator, what: string) {
  await locator.scrollIntoViewIfNeeded()
  const box = (await locator.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.x, `${what}: left edge`).toBeGreaterThanOrEqual(0)
  expect(box.y, `${what}: top edge`).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, `${what}: right edge`).toBeLessThanOrEqual(viewport.width + 0.5)
  expect(box.y + box.height, `${what}: bottom edge`).toBeLessThanOrEqual(viewport.height + 0.5)
}

// Big enough for a finger: Apple and Google both ask for 44 px or more.
async function expectFingerSized(locator: Locator, what: string, min = 44) {
  const box = (await locator.boundingBox())!
  expect(box.width, `${what}: width`).toBeGreaterThanOrEqual(min)
  expect(box.height, `${what}: height`).toBeGreaterThanOrEqual(min)
}

type Tile = { label: string; left: number; top: number; width: number; height: number }

// Every tile of a board grid (runner or editor), in page coordinates.
function readTiles(page: Page, gridItem: string) {
  return page.locator(gridItem).evaluateAll((items) =>
    items.map((item) => {
      const rect = item.getBoundingClientRect()
      const label = item.querySelector('.board-cell-label-text')?.textContent?.trim() ?? ''
      return {
        label,
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      }
    }),
  )
}

function overlapping(tiles: Tile[]) {
  const pairs: string[] = []
  for (const [i, a] of tiles.entries()) {
    for (const b of tiles.slice(i + 1)) {
      const x = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
      const y = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
      if (x > 1 && y > 1) pairs.push(`${a.label} / ${b.label}`)
    }
  }
  return pairs
}

// The columns a board shows at a grid width (Runner.tsx): its own while a tile is at least 96px
// wide (always from 1024px), otherwise at most 4 from 768px and 3 below.
function expectedColumns(gridWidth: number, cols: number) {
  if (gridWidth >= 1024 || (gridWidth - 16 * (cols - 1)) / cols >= 96) return cols
  return Math.min(cols, gridWidth >= 768 ? 4 : 3)
}

// The board shows every word on the screen's width, in square tiles big enough to tap, without
// tiles covering each other, in the board's own reading order, with every word whole.
async function expectBoardLaidOut(page: Page, { cols, words }: BoardShape = BOARD, { order = true } = {}) {
  await expect(async () => {
    const tiles = await readTiles(page, '.layout > .react-grid-item')
    const viewport = page.viewportSize()!
    const gridWidth = await page.locator('.layout').evaluate((grid) => grid.getBoundingClientRect().width)

    expect(tiles.map((tile) => tile.label).sort()).toEqual([...words].sort())
    for (const tile of tiles) {
      expect(tile.left, `${tile.label}: left edge`).toBeGreaterThanOrEqual(0)
      expect(tile.left + tile.width, `${tile.label}: right edge`).toBeLessThanOrEqual(viewport.width)
      expect(Math.abs(tile.width - tile.height), `${tile.label}: square`).toBeLessThanOrEqual(1.5)
      expect(tile.width, `${tile.label}: size`).toBeGreaterThanOrEqual(96)
    }
    expect(overlapping(tiles), 'tiles on top of each other').toEqual([])

    const columns = new Set(tiles.map((tile) => Math.round(tile.left))).size
    expect(columns, `columns at a ${gridWidth}px grid`).toBe(expectedColumns(gridWidth, cols))

    // Read row by row, left to right, the words come in the board's order: a child finds a word
    // where it was the last time.
    if (order) {
      const reading = [...tiles].sort((a, b) => Math.round(a.top) - Math.round(b.top) || a.left - b.left)
      expect(reading.map((tile) => tile.label), 'reading order').toEqual(words)
    }
  }).toPass({ timeout: 15_000 })

  // CellLabel shrinks a long word instead of breaking it over two lines or letting it spill out.
  const broken = await page.locator('.layout .board-cell-label-text').evaluateAll((labels) =>
    labels
      .filter((label) => {
        if (label.scrollWidth > label.clientWidth + 1) return true
        const text = label.firstChild
        if (!text || text.nodeType !== Node.TEXT_NODE) return false
        const range = document.createRange()
        for (const match of text.textContent!.matchAll(/\S+/g)) {
          range.setStart(text, match.index)
          range.setEnd(text, match.index + match[0].length)
          if (range.getClientRects().length > 1) return true
        }
        return false
      })
      .map((label) => label.textContent),
  )
  expect(broken, 'labels that do not fit their tile').toEqual([])
  await expectNoSidewaysScroll(page)
}

// The action bar sits on the bottom edge, and the last row can be scrolled clear of it; the child
// bar stays on top and leaves the first row uncovered.
async function expectBarsClearOfTiles(page: Page) {
  const actionBar = page.locator('.actionbar-container > div')
  const childBar = page.getByRole('link', { name: 'Kodu', exact: true })

  await page.evaluate(() => window.scrollTo(0, 0))
  await expectOnScreen(page, childBar, 'Kodu button')
  const childBarBottom = await childBar.evaluate((link) => link.parentElement!.getBoundingClientRect().bottom)
  const firstTileTop = await page.locator('.layout > .react-grid-item').first().evaluate((tile) => tile.getBoundingClientRect().top)
  expect(firstTileTop, 'first row below the child bar').toBeGreaterThanOrEqual(childBarBottom)

  await expect(async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const barTop = (await actionBar.boundingBox())!.y
    const viewport = page.viewportSize()!
    const lastTileBottom = await page
      .locator('.layout > .react-grid-item')
      .evaluateAll((tiles) => Math.max(...tiles.map((tile) => tile.getBoundingClientRect().bottom)))
    expect(lastTileBottom, 'last row above the action bar').toBeLessThanOrEqual(barTop)
    expect(barTop + (await actionBar.boundingBox())!.height, 'action bar bottom').toBeLessThanOrEqual(viewport.height)
  }).toPass({ timeout: 5_000 })
  // The child bar stays at the top while the board scrolls under it.
  await expect(childBar).toBeInViewport()
  await page.evaluate(() => window.scrollTo(0, 0))
}

test.describe('child home', () => {
  test('fits the screen and opens a board with a tap', async ({ page, member, viewport }) => {
    for (const [name, size] of orientations(viewport)) {
      await test.step(name, async () => {
        await page.setViewportSize(size)
        await page.goto('/kodu')

        const home = page.getByRole('heading', { level: 1, name: 'Kodu' })
        await expect(home).toBeVisible()
        await expectFingerSized(home, 'Kodu')
        await expectOnScreen(page, page.getByRole('button', { name: 'Vanema vaade', exact: true }), 'Vanema vaade')

        const card = page.getByRole('button').filter({ hasText: member.boardName })
        await expectOnScreen(page, card, 'board card')
        await expectFingerSized(card, 'board card')
        await expectNoSidewaysScroll(page)
      })
    }

    await page.getByRole('button').filter({ hasText: member.boardName }).tap()
    await expect(page).toHaveURL(new RegExp(`/boards/${member.boardId}$`))
  })
})

test.describe('board', () => {
  for (const [index, name] of ['upright', 'sideways'].entries()) {
    test(`shows every word in square tiles in reading order, ${name}`, async ({ page, member, viewport }) => {
      await page.setViewportSize(orientations(viewport)[index]![1])
      await page.goto(`/boards/${member.boardId}`)
      await expectBoardLaidOut(page)
    })

    test(`keeps a wide board's reading order when it shows fewer columns, ${name}`, async ({ page, member, viewport }) => {
      await page.setViewportSize(orientations(viewport)[index]![1])
      await page.goto(`/boards/${member.wideBoardId}`)
      await expectBoardLaidOut(page, WIDE_BOARD)
    })

    test(`keeps the first and last rows clear of the bars, ${name}`, async ({ page, member, viewport }) => {
      await page.setViewportSize(orientations(viewport)[index]![1])
      await page.goto(`/boards/${member.boardId}`)
      // The grid lays itself out once it knows its width; measure after that.
      await expectBoardLaidOut(page, BOARD, { order: false })
      await expectBarsClearOfTiles(page)
    })
  }

  test('follows the device when it turns', async ({ page, member, viewport }) => {
    // Turning the device resizes the open page; the board takes the new width without a reload.
    const [[, upright], [, sideways]] = orientations(viewport)
    await page.setViewportSize(upright)
    await page.goto(`/boards/${member.boardId}`)
    for (const size of [sideways, upright]) {
      await page.setViewportSize(size)
      await expectBoardLaidOut(page)
      await expectBarsClearOfTiles(page)
    }
  })

  test('taps build a phrase that speaks, and the bar undoes and clears it', async ({ page, member }) => {
    // Speech comes from a stand-in, so the test needs no speech service: the member flow test hears
    // the real one.
    await page.route('**/next/tts-ms', (route) => route.fulfill({ body: silentWav(), contentType: 'audio/wav' }))
    const played = await countPlayedAudio(page)
    await page.goto(`/boards/${member.boardId}`)

    const bar = page.locator('.actionbar-container')
    const playAll = bar.getByRole('button', { name: 'Esita kogu fraas' })
    const undo = bar.getByRole('button', { name: 'Võta viimane tagasi' })
    const clear = bar.getByRole('button', { name: 'Tühjenda fraas' })
    for (const [button, what] of [
      [playAll, 'play'],
      [undo, 'undo'],
      [clear, 'clear'],
    ] as const) {
      await expectOnScreen(page, button, what)
      await expectFingerSized(button, what)
    }

    for (const [index, word] of ['mina', 'tahan', 'süüa'].entries()) {
      await page.getByRole('button', { name: word, exact: true }).tap()
      await expect.poll(played, { message: `"${word}" should play` }).toBe(index + 1)
    }
    await expect(bar).toContainText(/mina.*tahan.*süüa/)

    await playAll.tap()
    await expect.poll(played, { message: 'the phrase should play' }).toBe(4)

    await undo.tap()
    await expect(bar).toContainText(/mina.*tahan/)
    await expect(bar).not.toContainText('süüa')

    await clear.tap()
    await expect(bar.getByText('Vali pilte, et fraasi koostada')).toBeVisible()
    await expect(page.getByText('Heli ei õnnestunud')).toHaveCount(0)
  })

  test('a tapped tile does not stay highlighted', async ({ page, member }) => {
    // Touch screens keep :hover on the last tapped element, so hover-only styles stick to a tile
    // until the child taps somewhere else.
    await page.route('**/next/tts-ms', (route) => route.fulfill({ body: silentWav(), contentType: 'audio/wav' }))
    const played = await countPlayedAudio(page)
    await page.goto(`/boards/${member.boardId}`)

    const tile = (word: string) => page.locator('.layout > .react-grid-item').filter({ has: page.getByRole('button', { name: word, exact: true }) })
    const look = (word: string) =>
      tile(word).evaluate((cell) => {
        const style = getComputedStyle(cell)
        return { border: style.borderColor, ring: style.boxShadow }
      })
    const untouched = await look('sina')
    await tile('mina').getByRole('button').tap()
    await expect.poll(played).toBe(1)
    // Once the word has played, the tile looks like the others again.
    await expect.poll(() => look('mina'), { timeout: 5_000 }).toEqual(untouched)
  })
})

test.describe('parent view', () => {
  test('opens with the PIN typed on the number pad', async ({ page, viewport }) => {
    await page.goto('/kodu')
    await page.getByRole('button', { name: 'Vanema vaade', exact: true }).tap()

    const dialog = page.getByRole('dialog', { name: 'Avan vanema vaate' })
    await expect(dialog).toBeVisible()
    await expectOnScreen(page, dialog, 'PIN dialog')

    // Tablets and phones bring up the number pad for this field, and offer a code to fill in.
    const pin = dialog.locator('input[data-input-otp]')
    await expect(pin).toHaveAttribute('inputmode', 'numeric')
    await dialog.locator('[data-input-otp-container]').tap()
    await expect(pin).toBeFocused()
    await page.keyboard.type(DEFAULT_PIN)
    await expect(dialog).toBeHidden()

    // From the md breakpoint (768px, an iPad upright) the main menu is in the header; narrower
    // screens open it from the menu button.
    if (viewport!.width >= 768) {
      await expect(page.getByRole('navigation', { name: 'Peamenüü' }).getByRole('link', { name: 'Koduhaldus' })).toBeVisible()
    } else {
      await page.getByRole('button', { name: 'Open menu' }).tap()
      const menu = page.getByRole('dialog')
      await expect(menu.getByRole('link', { name: 'Koduhaldus' })).toBeVisible()
      await expect(menu.getByRole('button', { name: 'Logi välja' })).toBeVisible()
      await expectOnScreen(page, menu, 'menu sheet')
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
    }

    await page.getByRole('button', { name: 'Lapse vaade', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Vanema vaade', exact: true })).toBeVisible()
  })

  test('Koduhaldus fits the screen and its switches work by touch', async ({ page, member, baseURL }) => {
    await enterParentView(page, baseURL)
    await page.goto('/koduhaldus')

    const row = page.getByRole('row').filter({ hasText: member.boardName })
    const homeSwitch = row.getByRole('switch', { name: `Näita koduvaates: ${member.boardName}` })
    await expect(homeSwitch).toBeChecked()
    await expectNoSidewaysScroll(page)

    // The table may scroll sideways in its own box; tapping brings the switch into view.
    await homeSwitch.tap()
    await expect(homeSwitch).not.toBeChecked()
    await expect(page.getByText('Tahvel eemaldati koduvaatest.')).toBeVisible()
    await homeSwitch.tap()
    await expect(homeSwitch).toBeChecked()
    await expect(page.getByText('Tahvel lisati koduvaatesse.')).toBeVisible()
  })

  test('the board editor lays out the cards and opens one with a tap', async ({ page, member, baseURL, viewport }) => {
    // The card dialog searches pictures as it opens; the test doesn't need the symbol banks.
    await page.route('**/next/image-search**', (route) => route.fulfill({ json: { banks: [], library: [], mine: [] } }))
    await enterParentView(page, baseURL)
    await page.goto(`/boards/${member.boardId}/edit`)

    for (const [name, size] of orientations(viewport)) {
      await test.step(name, async () => {
        await page.setViewportSize(size)
        await expect(async () => {
          const tiles = await readTiles(page, '.board-editor-grid .react-grid-item')
          expect(tiles.map((tile) => tile.label).sort()).toEqual([...WORDS].sort())
          for (const tile of tiles) {
            expect(tile.left, `${tile.label}: left edge`).toBeGreaterThanOrEqual(0)
            expect(tile.left + tile.width, `${tile.label}: right edge`).toBeLessThanOrEqual(size.width)
          }
          expect(overlapping(tiles), 'cards on top of each other').toEqual([])
        }).toPass({ timeout: 15_000 })
        await expectNoSidewaysScroll(page)
      })
    }

    // The cell's buttons take taps (the drag grip must not swallow the touch).
    const card = page.locator('.board-editor-grid .react-grid-item').filter({ hasText: 'mänguväljak' })
    await card.getByRole('button', { name: 'Muuda kaarti' }).tap()
    const dialog = page.getByRole('dialog', { name: 'Muuda' })
    await expect(dialog).toBeVisible()
    await expectOnScreen(page, dialog, 'card dialog')
    await expect(dialog.getByRole('textbox').first()).toHaveValue('mänguväljak')
    await dialog.getByRole('button', { name: 'Tühista' }).tap()
    await expect(dialog).toBeHidden()
  })
})

test.describe('game', () => {
  // A dot takes a tap on its round, invisible target, which is larger than the dot it draws.
  const dotTargets = (page: Page) => page.locator('[data-connect-dot="true"] > circle:first-child')

  test('shows the picture and every dot, upright and turned sideways', async ({ page, member, viewport }) => {
    await page.goto(`/connect-dots?puzzle=${member.puzzleId}`)
    await expect(dotTargets(page)).toHaveCount(DOTS.length)

    for (const [name, size] of orientations(viewport)) {
      await test.step(name, async () => {
        await page.setViewportSize(size)
        await expectNoSidewaysScroll(page)
        for (const index of DOTS.keys()) await expectOnScreen(page, dotTargets(page).nth(index), `dot ${index + 1}`)
      })
    }
  })

  // The picture sizes itself once it has loaded; the dots follow it.
  async function waitForPicture(page: Page) {
    const pictures = page.locator('img[src="/og-image.jpg"]')
    await expect
      .poll(() => pictures.evaluateAll((images) => images.length > 0 && images.every((image) => (image as HTMLImageElement).naturalWidth > 0)))
      .toBe(true)
    await expect.poll(async () => (await dotTargets(page).first().boundingBox())?.width ?? 0).toBeGreaterThan(10)
  }

  test('dots are big enough for a finger', async ({ page, member }) => {
    await page.goto(`/connect-dots?puzzle=${member.puzzleId}`)
    await waitForPicture(page)
    // A tap that misses the target counts as a wrong one (the picture flashes red). The picture
    // eases to its size, so the dots settle a moment after it loads.
    await expect(() => expectFingerSized(dotTargets(page).first(), 'dot')).toPass({ timeout: 5_000 })
  })

  test('connects the dots with taps', async ({ page, member }) => {
    await page.goto(`/connect-dots?puzzle=${member.puzzleId}`)
    await waitForPicture(page)
    // A finger lands on the middle of the dot.
    const tapDot = async (index: number) => {
      const target = dotTargets(page).nth(index)
      await target.scrollIntoViewIfNeeded()
      const box = (await target.boundingBox())!
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    }

    // A dot out of turn does nothing; the dots in turn finish the picture. The first is the start.
    await tapDot(3)
    await tapDot(1)
    await tapDot(2)
    await expect(page.getByText('Tubli!')).toHaveCount(0)
    await tapDot(3)
    await expect(page.getByText('Tubli!')).toBeVisible()
  })
})
