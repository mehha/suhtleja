import { type Page } from '@playwright/test'

import { countPlayedAudio, silentWav } from './audio'
import { DEFAULT_PIN } from './member'
import { pageReady } from './ready'
import {
  BOARD,
  DOTS,
  WIDE_BOARD,
  WORDS,
  createOwnBoard,
  enterParentView,
  expect,
  expectFingerSized,
  expectNoSidewaysScroll,
  expectOnScreen,
  expectTouchFriendly,
  orientations,
  rgb,
  test,
  type BoardShape,
} from './touch'
import { WORD_CLASS_INFO } from '../../src/utilities/wordClass'

// The child's pages on the screens they are used on: tablets most of all, and phones, held upright
// and turned sideways. Each touch project (see playwright.config.ts) gets its own member with a full
// board and a game; the tests tap with touch events, as a finger does. They create an account, so
// they run only against a local server; Playwright's global teardown deletes it.

test.skip(!!process.env.SMOKE_BASE_URL, 'Creates an account, so it never runs against a deployed site.')
test.skip(({ hasTouch }) => !hasTouch, 'Touch screens only.')

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
        await expectTouchFriendly(page, `child home, ${name}`)
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
      await expectTouchFriendly(page, `board, ${name}`)
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

  test("a word class colours the tile's border and the word in the phrase", async ({ page, member }) => {
    await page.route('**/next/tts-ms', (route) => route.fulfill({ body: silentWav(), contentType: 'audio/wav' }))
    const played = await countPlayedAudio(page)
    const boardId = await createOwnBoard(page.request, `Sõnaliigid ${member.boardName}`, [
      { title: 'mina', wordClass: 'person' },
      { title: 'jooksma', wordClass: 'verb' },
      { title: 'õue' },
    ])
    await page.goto(`/boards/${boardId}`)

    const tile = (word: string) =>
      page.locator('.layout > .react-grid-item').filter({ has: page.getByRole('button', { name: word, exact: true }) })
    const border = (word: string) => tile(word).evaluate((cell) => getComputedStyle(cell).borderTopColor)
    await expect.poll(() => border('mina')).toBe(rgb(WORD_CLASS_INFO.person.color))
    expect(await border('jooksma')).toBe(rgb(WORD_CLASS_INFO.verb.color))
    // A card without a class keeps the plain border.
    expect(await border('õue')).toBe('rgb(226, 232, 240)')

    await tile('jooksma').getByRole('button').tap()
    await expect.poll(played).toBe(1)
    const phraseWord = page.locator('.actionbar-container').getByText('jooksma', { exact: true }).locator('xpath=..')
    expect(await phraseWord.evaluate((word) => getComputedStyle(word).borderTopColor)).toBe(
      rgb(WORD_CLASS_INFO.verb.color),
    )

    // The parent can turn the colours off for the board.
    const off = await page.request.patch(`/api/boards/${boardId}?depth=0`, { data: { extra: { wordClassColors: false } } })
    expect(off.status(), await off.text()).toBe(200)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => border('mina')).toBe('rgb(226, 232, 240)')
  })

  test('a verb takes the form the sentence gives it, in the speech, the tile and the phrase', async ({
    page,
    member,
  }) => {
    const spoken: string[] = []
    await page.route('**/next/tts-ms', async (route) => {
      spoken.push(JSON.parse(route.request().postData() ?? '{}').text)
      await route.fulfill({ body: silentWav(), contentType: 'audio/wav' })
    })
    const boardId = await createOwnBoard(page.request, `Sõnavormid ${member.boardName}`, [
      { title: 'mina', wordClass: 'person' },
      { title: 'ei' },
      { title: 'jooksma', wordClass: 'verb' },
    ])
    await page.goto(`/boards/${boardId}`)

    // By place: a tapped tile shows the word's form ("jooksen") as its name.
    const tile = (index: number) => page.locator('.layout > .react-grid-item').nth(index).getByRole('button')
    const phrase = page.locator('.actionbar-container')

    // Speech the board hasn't saved comes from /next/tts-ms: the tapped word, then the sentence,
    // which the runner fetches ahead for "play all".
    await tile(0).tap()
    await expect.poll(() => spoken).toContain('mina.')
    await tile(2).tap()
    await expect.poll(() => spoken).toContain('jooksen.')
    await expect.poll(() => spoken).toContain('mina jooksen.')
    await expect(tile(2)).toHaveAccessibleName('jooksen')
    await expect(phrase.getByText('jooksen', { exact: true })).toBeVisible()

    // Undo and say it with "ei".
    await page.getByRole('button', { name: 'Võta viimane tagasi' }).tap()
    await tile(1).tap()
    await tile(2).tap()
    await expect.poll(() => spoken).toContain('jookse.')
    await expect(phrase.getByText('jookse', { exact: true })).toBeVisible()

    // The parent can turn the word forms off for the board. (The save also caches the cards'
    // speech, so the words now come from the cache.)
    const off = await page.request.patch(`/api/boards/${boardId}?depth=0`, { data: { extra: { grammar: false } } })
    expect(off.status(), await off.text()).toBe(200)
    await page.goto(`/boards/${boardId}`)
    await tile(0).tap()
    await tile(2).tap()
    await expect(tile(2)).toHaveAccessibleName('jooksma')
    await expect(phrase.getByText('jooksma', { exact: true })).toBeVisible()
    await expect.poll(() => spoken).toContain('mina jooksma.')
  })

  test('a card opens another board with the sentence, and the back button returns with it', async ({
    page,
    member,
  }) => {
    await page.route('**/next/tts-ms', (route) => route.fulfill({ body: silentWav(), contentType: 'audio/wav' }))
    const food = `Söök ${member.boardName}`
    const foodId = await createOwnBoard(page.request, food, [
      { title: 'õun', wordClass: 'noun' },
      { title: 'piim', wordClass: 'noun' },
    ])
    const start = `Algus ${member.boardName}`
    const startId = await createOwnBoard(page.request, start, [
      { title: 'mina', wordClass: 'person' },
      { title: 'tahtma', wordClass: 'verb' },
      { title: 'söök', linkBoard: foodId },
    ])
    await page.goto(`/boards/${startId}`)
    const phrase = page.locator('.actionbar-container')

    await page.getByRole('button', { name: 'mina', exact: true }).tap()
    await page.getByRole('button', { name: 'tahtma', exact: true }).tap()
    await expect(phrase.getByText('tahan', { exact: true })).toBeVisible()

    // The card says where it goes and opens the board; its word isn't added.
    await page.getByRole('button', { name: `söök, avab tahvli ${food}` }).tap()
    await expect(page).toHaveURL(new RegExp(`/boards/${foodId}\\?from=${startId}$`))
    await expect(phrase.getByText('tahan', { exact: true })).toBeVisible()
    await expect(phrase).not.toContainText('söök')

    // The sentence goes on, in its forms, with this board's word.
    await page.getByRole('button', { name: 'õun', exact: true }).tap()
    for (const word of ['mina', 'tahan', 'õuna']) {
      await expect(phrase.getByText(word, { exact: true })).toBeVisible()
    }
    await expectTouchFriendly(page, 'a board opened by a card')

    // Back to the first board, the sentence with it.
    await page.getByRole('link', { name: `Tagasi: ${start}` }).tap()
    await expect(page).toHaveURL(new RegExp(`/boards/${startId}$`))
    for (const word of ['mina', 'tahan', 'õuna']) {
      await expect(phrase.getByText(word, { exact: true })).toBeVisible()
    }

    // From the home a board starts with an empty sentence.
    await page.goto(`/boards/${foodId}`)
    await expect(phrase.getByText('Vali pilte, et fraasi koostada')).toBeVisible()
  })

  test('a noun before a postposition is in the genitive', async ({ page, member }) => {
    const spoken: string[] = []
    await page.route('**/next/tts-ms', async (route) => {
      spoken.push(JSON.parse(route.request().postData() ?? '{}').text)
      await route.fulfill({ body: silentWav(), contentType: 'audio/wav' })
    })
    const boardId = await createOwnBoard(page.request, `Omastav ${member.boardName}`, [
      { title: 'kass', wordClass: 'noun' },
      { title: 'laud', wordClass: 'noun' },
      { title: 'peal', wordClass: 'other' },
    ])
    await page.goto(`/boards/${boardId}`)
    const tile = (index: number) => page.locator('.layout > .react-grid-item').nth(index).getByRole('button')
    const phrase = page.locator('.actionbar-container')

    for (const index of [0, 1, 2]) await tile(index).tap()
    // The noun took its form when the postposition came.
    for (const word of ['kass', 'laua', 'peal']) {
      await expect(phrase.getByText(word, { exact: true })).toBeVisible()
    }
    await expect.poll(() => spoken).toContain('kass laua peal.')
  })

  test('after "eile" a verb is in the past', async ({ page, member }) => {
    const spoken: string[] = []
    await page.route('**/next/tts-ms', async (route) => {
      spoken.push(JSON.parse(route.request().postData() ?? '{}').text)
      await route.fulfill({ body: silentWav(), contentType: 'audio/wav' })
    })
    const boardId = await createOwnBoard(page.request, `Minevik ${member.boardName}`, [
      { title: 'eile', wordClass: 'other' },
      { title: 'mina', wordClass: 'person' },
      { title: 'minema', wordClass: 'verb' },
      { title: 'pood', wordClass: 'place' },
    ])
    await page.goto(`/boards/${boardId}`)
    const tile = (index: number) => page.locator('.layout > .react-grid-item').nth(index).getByRole('button')
    const phrase = page.locator('.actionbar-container')

    // A tapped tile shows its word's form until the next tap.
    for (const index of [0, 1, 2]) await tile(index).tap()
    await expect(tile(2)).toHaveAccessibleName('läksin')
    await tile(3).tap()
    await expect(tile(3)).toHaveAccessibleName('poodi')
    for (const word of ['eile', 'mina', 'läksin', 'poodi']) {
      await expect(phrase.getByText(word, { exact: true })).toBeVisible()
    }
    await expect.poll(() => spoken).toContain('eile mina läksin poodi.')
  })

  test('an object takes the partitive, and its adjective with it', async ({ page, member }) => {
    const spoken: string[] = []
    await page.route('**/next/tts-ms', async (route) => {
      spoken.push(JSON.parse(route.request().postData() ?? '{}').text)
      await route.fulfill({ body: silentWav(), contentType: 'audio/wav' })
    })
    const boardId = await createOwnBoard(page.request, `Käänded ${member.boardName}`, [
      { title: 'mina', wordClass: 'person' },
      { title: 'tahtma', wordClass: 'verb' },
      { title: 'suur', wordClass: 'adjective' },
      { title: 'õun', wordClass: 'noun' },
    ])
    await page.goto(`/boards/${boardId}`)
    const tile = (index: number) => page.locator('.layout > .react-grid-item').nth(index).getByRole('button')
    const phrase = page.locator('.actionbar-container')

    for (const index of [0, 1, 2, 3]) await tile(index).tap()
    await expect.poll(() => spoken).toContain('õuna.')
    await expect(tile(3)).toHaveAccessibleName('õuna')
    // The adjective took its form once the noun came.
    for (const word of ['mina', 'tahan', 'suurt', 'õuna']) {
      await expect(phrase.getByText(word, { exact: true })).toBeVisible()
    }
    await expect.poll(() => spoken).toContain('mina tahan suurt õuna.')
  })

  test('a place takes its case from the verb, and its adjective with it', async ({ page, member }) => {
    const spoken: string[] = []
    await page.route('**/next/tts-ms', async (route) => {
      spoken.push(JSON.parse(route.request().postData() ?? '{}').text)
      await route.fulfill({ body: silentWav(), contentType: 'audio/wav' })
    })
    const boardId = await createOwnBoard(page.request, `Kohad ${member.boardName}`, [
      { title: 'mina', wordClass: 'person' },
      { title: 'minema', wordClass: 'verb' },
      { title: 'suur', wordClass: 'adjective' },
      { title: 'park', wordClass: 'place' },
    ])
    await page.goto(`/boards/${boardId}`)
    const tile = (index: number) => page.locator('.layout > .react-grid-item').nth(index).getByRole('button')
    const phrase = page.locator('.actionbar-container')

    for (const index of [0, 1, 2, 3]) await tile(index).tap()
    await expect.poll(() => spoken).toContain('parki.')
    await expect(tile(3)).toHaveAccessibleName('parki')
    for (const word of ['mina', 'lähen', 'suurde', 'parki']) {
      await expect(phrase.getByText(word, { exact: true })).toBeVisible()
    }
    await expect.poll(() => spoken).toContain('mina lähen suurde parki.')
  })

  test('a toy after "mängima" is played with, and its adjective with it', async ({ page, member }) => {
    const spoken: string[] = []
    await page.route('**/next/tts-ms', async (route) => {
      spoken.push(JSON.parse(route.request().postData() ?? '{}').text)
      await route.fulfill({ body: silentWav(), contentType: 'audio/wav' })
    })
    const boardId = await createOwnBoard(page.request, `Mängin ${member.boardName}`, [
      { title: 'mina', wordClass: 'person' },
      { title: 'mängima', wordClass: 'verb' },
      { title: 'suur', wordClass: 'adjective' },
      { title: 'auto', wordClass: 'noun' },
    ])
    await page.goto(`/boards/${boardId}`)
    const tile = (index: number) => page.locator('.layout > .react-grid-item').nth(index).getByRole('button')
    const phrase = page.locator('.actionbar-container')

    for (const index of [0, 1, 2, 3]) await tile(index).tap()
    await expect.poll(() => spoken).toContain('autoga.')
    await expect(tile(3)).toHaveAccessibleName('autoga')
    for (const word of ['mina', 'mängin', 'suure', 'autoga']) {
      await expect(phrase.getByText(word, { exact: true })).toBeVisible()
    }
    await expect.poll(() => spoken).toContain('mina mängin suure autoga.')
  })

  test("with AI on, a tap speaks at once and the AI's forms for the sentence follow", async ({ page, member }) => {
    const spoken: string[] = []
    await page.route('**/next/tts-ms', async (route) => {
      spoken.push(JSON.parse(route.request().postData() ?? '{}').text)
      await route.fulfill({ body: silentWav(), contentType: 'audio/wav' })
    })
    // The AI answers when the test lets it: "lamp" (which the word forms leave, a lamp being no place)
    // becomes "lambi", and it also tries to change "magan", which the board's word forms gave.
    let answer = () => {}
    const answered = new Promise<void>((resolve) => (answer = resolve))
    const asked: Array<{ task: string; words: string[] }> = []
    await page.route('**/next/groq', async (route) => {
      const body = route.request().postDataJSON() as { task: string; words: string[] }
      asked.push(body)
      await answered
      const forms: Record<string, string> = { lamp: 'lambi', magan: 'magas' }
      await route.fulfill({ json: { words: body.words.map((word) => forms[word] ?? word) } })
    })
    const boardId = await createOwnBoard(
      page.request,
      `AI ${member.boardName}`,
      [{ title: 'mina' }, { title: 'magama', wordClass: 'verb' }, { title: 'lamp', wordClass: 'noun' }],
      { ai: true },
    )
    await page.goto(`/boards/${boardId}`)
    const tile = (index: number) => page.locator('.layout > .react-grid-item').nth(index).getByRole('button')
    const phrase = page.locator('.actionbar-container')

    await tile(0).tap()
    await expect.poll(() => spoken).toContain('mina.')
    await tile(1).tap()
    await expect.poll(() => spoken).toContain('magan.')
    await tile(2).tap()
    // Said while the AI is still answering; the sentence goes to it in one request.
    await expect.poll(() => spoken).toContain('lamp.')
    await expect.poll(() => asked.at(-1)).toEqual({ task: 'sentence', words: ['mina', 'magan', 'lamp'] })
    await expect(phrase.getByText('lamp', { exact: true })).toBeVisible()

    answer()
    await expect(phrase.getByText('lambi', { exact: true })).toBeVisible()
    await expect(tile(2)).toHaveAccessibleName('lambi')
    // The board's word forms keep theirs.
    await expect(phrase.getByText('magan', { exact: true })).toBeVisible()
    // "Play all" is fetched ahead once the AI's forms are in, not before.
    await expect.poll(() => spoken).toContain('mina magan lambi.')
    expect(spoken).not.toContain('mina magan lamp.')
  })
})

test.describe('parent view', () => {
  test('opens with the PIN typed on the number pad', async ({ page, viewport }) => {
    await page.goto('/kodu')
    await page.getByRole('button', { name: 'Vanema vaade', exact: true }).tap()

    const dialog = page.getByRole('dialog', { name: 'Avan vanema vaate' })
    await expect(dialog).toBeVisible()
    await expectOnScreen(page, dialog, 'PIN dialog')
    await expectTouchFriendly(page, 'PIN dialog')

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
      await page.getByRole('button', { name: 'Ava menüü' }).tap()
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

    const row = page.getByRole('listitem').filter({ hasText: member.boardName })
    const homeSwitch = row.getByRole('switch', { name: `Näita koduvaates: ${member.boardName}` })
    await expect(homeSwitch).toBeChecked()
    await expectNoSidewaysScroll(page)

    // The list fits the screen; the switch is on the row's second line on a phone.
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
        await expectTouchFriendly(page, `game, ${name}`)
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

test.describe('without the network', () => {
  // The child's home, its boards and game, and their speech are kept on the device (offline.md). In
  // Chromium, Playwright's routes and offline mode cover the service worker's own requests too, so
  // the test can stand in for the speech and cut the network for the worker as well.
  test('the home, its boards, a card that opens a board, the speech and the game work offline', async ({
    page,
    context,
    member,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', "Playwright reaches a service worker's requests in Chromium only.")
    test.setTimeout(180_000)
    // next dev runs the worker only when asked (offlineCache.ts).
    await page.addInitScript(() => window.localStorage.setItem('suhtleja:offline-dev', '1'))
    const speech = ['**/next/tts-ms', '**/next/tts-cache/**']
    for (const url of speech) {
      await context.route(url, (route) => route.fulfill({ body: silentWav(), contentType: 'audio/wav' }))
    }
    const played = await countPlayedAudio(page)

    // A board on the home whose card opens another board. A save gives both their saved speech.
    const food = `Söök võrguta ${member.boardName}`
    const foodId = await createOwnBoard(page.request, food, [
      { title: 'õun', wordClass: 'noun' },
      { title: 'piim', wordClass: 'noun' },
    ])
    const start = `Võrguta ${member.boardName}`
    const startId = await createOwnBoard(page.request, start, [
      { title: 'mina', wordClass: 'person' },
      { title: 'tahan', wordClass: 'verb' },
      { title: 'söök', linkBoard: foodId },
    ])
    for (const id of [foodId, startId]) {
      const saved = await page.request.patch(`/api/boards/${id}`, {
        data: { pinned: id === startId, extra: { grammar: false } },
      })
      expect(saved.status(), await saved.text()).toBe(200)
    }

    try {
      await page.goto('/kodu')
      await expect(page.locator('html')).toHaveAttribute('data-offline', 'ready', { timeout: 120_000 })
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready
      })
      // A production page names the scripts of its route; next dev's page leaves them to webpack, so
      // here the worker keeps them as a board and the game load once with the network.
      for (const url of [`/boards/${member.boardId}`, `/connect-dots?puzzle=${member.puzzleId}`]) {
        await page.goto(url)
        await expect(page.locator('html')).toHaveAttribute('data-offline', 'ready', { timeout: 60_000 })
      }
      await page.goto('/kodu')
      for (const url of speech) await context.unroute(url)
      // Every request fails, the service worker's too. next dev's own socket stays: React gets part
      // of the page's data in development through it (reactDebugChannel) and waits for it, which a
      // production build doesn't. So this is a Wi-Fi without internet, where the browser still
      // thinks it is online.
      await context.route('**/*', (route) => route.abort('internetdisconnected'))

      await page.reload()
      await expect(page.getByRole('heading', { level: 1, name: 'Kodu' })).toBeVisible()
      await pageReady(page)

      // A card on the home opens its board, whose words speak.
      await page.getByRole('button').filter({ hasText: start }).tap()
      await expect(page).toHaveURL(new RegExp(`/boards/${startId}$`))
      await pageReady(page)
      const phrase = page.locator('.actionbar-container')
      await page.getByRole('button', { name: 'mina', exact: true }).tap()
      await expect.poll(played, { message: '"mina" should play' }).toBe(1)
      await page.getByRole('button', { name: 'tahan', exact: true }).tap()
      await expect.poll(played, { message: '"tahan" should play' }).toBe(2)

      // The sentence can't be made as a whole without the network: it is said word by word.
      await phrase.getByRole('button', { name: 'Esita kogu fraas' }).tap()
      await expect.poll(played, { message: 'the phrase should play word by word' }).toBe(4)
      await expect(page.getByText('Heli ei õnnestunud')).toHaveCount(0)

      // A card opens its board with the sentence and a back button.
      await page.getByRole('button', { name: `söök, avab tahvli ${food}` }).tap()
      await expect(page).toHaveURL(new RegExp(`/boards/${foodId}\\?from=${startId}$`))
      await pageReady(page)
      await expect(phrase.getByText('tahan', { exact: true })).toBeVisible()
      // Without the network the router loads the whole page, so the count starts again.
      await page.getByRole('button', { name: 'õun', exact: true }).tap()
      await expect.poll(played, { message: '"õun" should play' }).toBe(1)
      // next dev hands React part of a page's data once, over its socket (reactDebugChannel): a kept
      // page opened a second time waited for it and never came alive. A production build has no such
      // channel, so here each kept page opens once: the back button is checked by where it goes.
      await expect(page.getByRole('link', { name: `Tagasi: ${start}` })).toHaveAttribute('href', `/boards/${startId}`)

      // The game on the home, with its picture.
      await page.goto(`/connect-dots?puzzle=${member.puzzleId}`, { waitUntil: 'commit' })
      await pageReady(page)
      await expect
        .poll(() =>
          page.locator('img[src="/og-image.jpg"]').evaluateAll(
            (images) => images.length > 0 && images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
          ),
        )
        .toBe(true)

      // A page the device hasn't kept says the network is missing.
      await page.goto('/boards/999999999', { waitUntil: 'commit' })
      await expect(page.getByRole('heading', { level: 1, name: 'Võrguühendus puudub' })).toBeVisible()
    } finally {
      await context.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined)
      // The worker's other tests have the home as it was.
      await page.request.patch(`/api/boards/${startId}`, { data: { pinned: false } }).catch(() => undefined)
    }
  })
})
