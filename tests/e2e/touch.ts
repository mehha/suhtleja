import { randomUUID } from 'crypto'
import { expect as baseExpect, test as base, type APIRequestContext, type Locator, type Page } from '@playwright/test'

import { createMember } from './member'
import { pageReady } from './ready'

// Shared by the device tests (devices*.e2e.spec.ts): one member per worker with boards and a game,
// made through the API, and checks for pages on touch screens.

export type BoardShape = { cols: number; words: string[] }

// A board as a parent fills one: six columns, words in reading order, every other with a picture,
// and long words that have to shrink to fit a phone's tile. Six columns fit an upright tablet.
export const BOARD: BoardShape = {
  cols: 6,
  words: [
    ...['mina', 'sina', 'tahan', 'ei', 'jah', 'veel'],
    ...['süüa', 'juua', 'mängida', 'magada', 'õue', 'koju'],
    ...['ema', 'isa', 'vanaema', 'sõber', 'õpetaja', 'kass'],
    ...['rõõmus', 'kurb', 'väsinud', 'mänguväljak', 'aitäh', 'palun'],
  ],
}
export const WORDS = BOARD.words
// Eight columns are too many for an upright tablet, which shows four, rearranged.
export const WIDE_BOARD: BoardShape = {
  cols: 8,
  words: [
    ...['üks', 'kaks', 'kolm', 'neli', 'viis', 'kuus', 'seitse', 'kaheksa'],
    ...['punane', 'sinine', 'kollane', 'roheline', 'must', 'valge', 'hall', 'pruun'],
  ],
}
// Normalized dots, in the order they are connected.
export const DOTS = [
  { x: 0.2, y: 0.3 },
  { x: 0.5, y: 0.75 },
  { x: 0.8, y: 0.3 },
  { x: 0.5, y: 0.15 },
]

export type Member = {
  boardId: number
  boardName: string
  cookies: Awaited<ReturnType<APIRequestContext['storageState']>>['cookies']
  email: string
  password: string
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

export const test = base.extend<object, { member: Member }>({
  // One member per worker, made through the API, so the tests start on the member's own pages.
  member: [
    async ({ playwright }, use, workerInfo) => {
      const api = await playwright.request.newContext({ baseURL: workerInfo.project.use.baseURL })
      const { email, password, run } = await createMember(api)

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
      await use({ boardId, boardName, cookies, email, password, puzzleId: (await puzzle.json()).doc.id, wideBoardId })
      await api.dispose()
    },
    { scope: 'worker' },
  ],
  // The member is logged in on every page the test opens.
  storageState: async ({ member }, provide) => provide({ cookies: member.cookies, origins: [] }),
  // Every page a test opens is used once React has taken it over (see ready.ts): on CI's WebKit a
  // tap right after the page shows found the server's markup without its handlers, and did nothing.
  // A test that wants the page before that passes `waitUntil: 'commit'`.
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page)
    page.goto = async (url, options) => {
      const response = await goto(url, options)
      if (options?.waitUntil !== 'commit') await pageReady(page)
      return response
    }
    await provide(page)
  },
})


// A board of the test's own, for a test that changes it, made through the API as the member. Cells
// are one row, in the given order. Made, not saved, so it has no speech cache: its words come from
// /next/tts-ms.
export async function createOwnBoard(
  request: APIRequestContext,
  name: string,
  cells: Array<{ title: string; wordClass?: string }>,
  extra?: { ai?: boolean; grammar?: boolean; wordClassColors?: boolean },
) {
  const response = await request.post('/api/boards', {
    data: {
      name,
      pinned: false,
      actionBar: { enabled: true },
      ...(extra ? { extra } : {}),
      grid: {
        cols: cells.length,
        rows: 1,
        cells: cells.map((cell, index) => ({ id: randomUUID(), x: index, y: 0, w: 1, h: 1, ...cell })),
      },
    },
  })
  baseExpect(response.status(), await response.text()).toBe(201)
  return (await response.json()).doc.id as number
}

// The colour a browser reports for a #rrggbb colour.
export const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(', ')})`

// The dev server compiles each route on its first request, which takes more than the default 5s on
// CI runners.
export const expect = baseExpect.configure({ timeout: 30_000 })

export type Viewport = { width: number; height: number }

// The device as it comes (upright) and turned sideways.
export function orientations(viewport: Viewport | null): Array<[string, Viewport]> {
  const { width, height } = viewport!
  const upright = { width: Math.min(width, height), height: Math.max(width, height) }
  return [
    ['upright', upright],
    ['sideways', { width: upright.height, height: upright.width }],
  ]
}

export async function enterParentView(page: Page, baseURL: string | undefined) {
  await page.context().addCookies([{ name: 'uiMode', value: 'parent', url: baseURL! }])
}

// Nothing makes the page wider than the screen: a sideways swipe must not move the page.
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'horizontal scroll in px').toBeLessThanOrEqual(0)
}

// The element is fully on the screen (after scrolling it into view).
export async function expectOnScreen(page: Page, locator: Locator, what: string) {
  await locator.scrollIntoViewIfNeeded()
  const box = (await locator.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.x, `${what}: left edge`).toBeGreaterThanOrEqual(0)
  expect(box.y, `${what}: top edge`).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, `${what}: right edge`).toBeLessThanOrEqual(viewport.width + 0.5)
  expect(box.y + box.height, `${what}: bottom edge`).toBeLessThanOrEqual(viewport.height + 0.5)
}

// Big enough for a finger: Apple and Google both ask for 44 px or more.
export async function expectFingerSized(locator: Locator, what: string, min = 44) {
  const box = (await locator.boundingBox())!
  expect(box.width, `${what}: width`).toBeGreaterThanOrEqual(min)
  expect(box.height, `${what}: height`).toBeGreaterThanOrEqual(min)
}

// What makes a page hard to use on a touch screen, as a list a test can show:
// - a control without a name (VoiceOver and TalkBack read nothing, and a tooltip never shows on touch),
// - a control smaller than 24 x 24 px (WCAG 2.2 AA target size), unless it is a link in a sentence
//   or has a label that takes the tap too,
// - on phones, a text field under 16px text: iPhone Safari zooms the page in when it gets focus,
// - a page wider than the screen.
export async function touchProblems(page: Page, { phone }: { phone: boolean }) {
  return page.evaluate((phone) => {
    const problems: string[] = []
    const describe = (element: Element) => {
      const html = element.outerHTML.replace(/\s+/g, ' ')
      return html.length > 140 ? `${html.slice(0, 140)}…` : html
    }
    const shown = (element: Element) => {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return false
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false
      // Behind an open dialog (aria-hidden), inert, or text for screen readers only.
      return !element.closest('[aria-hidden="true"], [inert], .sr-only')
    }
    const nameOf = (element: HTMLElement) => {
      const byLabel = element.getAttribute('aria-label')?.trim()
      if (byLabel) return byLabel
      const labelledBy = element.getAttribute('aria-labelledby')
      if (labelledBy) {
        const text = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim()
        if (text) return text
      }
      const labels = (element as HTMLInputElement).labels
      if (labels?.length) {
        const text = [...labels].map((label) => label.textContent ?? '').join(' ').trim()
        if (text) return text
      }
      const text = (element.innerText ?? element.textContent ?? '').trim()
      if (text) return text
      const alt = element.querySelector('img[alt]')?.getAttribute('alt')?.trim()
      if (alt) return alt
      return element.getAttribute('title')?.trim() || (element as HTMLInputElement).placeholder?.trim() || ''
    }

    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"], [role="checkbox"], [role="combobox"], [role="tab"]',
      ),
    ].filter(shown)

    for (const control of controls) {
      // A native control a styled one stands in for (a Radix checkbox or select).
      if (control.matches('input[aria-hidden="true"], select[aria-hidden="true"]')) continue
      if (!nameOf(control)) problems.push(`no name: ${describe(control)}`)

      const rect = control.getBoundingClientRect()
      const inSentence = control.matches('a') && control.closest('p') !== null
      // A tap on a control's label works the control too (a switch or a checkbox with its text).
      const labels = (control as HTMLInputElement).labels
      const labelled = [...(labels ?? [])].some((label) => label.getBoundingClientRect().width > 0)
      if (!inSentence && !labelled && (rect.width < 24 || rect.height < 24)) {
        problems.push(`${Math.round(rect.width)}x${Math.round(rect.height)}px target: ${describe(control)}`)
      }

      const typed = control.matches('textarea, input:not([type="checkbox"], [type="radio"], [type="range"], [type="file"], [type="submit"], [type="button"], [data-input-otp])')
      const fontSize = parseFloat(getComputedStyle(control).fontSize)
      if (phone && typed && fontSize < 16) problems.push(`${fontSize}px text zooms in on iPhone: ${describe(control)}`)
    }

    const overflow = document.documentElement.scrollWidth - window.innerWidth
    if (overflow > 0) problems.push(`page is ${overflow}px wider than the screen`)
    return problems
  }, phone)
}

// The page as it stands (with any open dialog) is easy to use with a finger.
export async function expectTouchFriendly(page: Page, what: string) {
  const viewport = page.viewportSize()!
  const phone = Math.min(viewport.width, viewport.height) < 600
  await expect(async () => expect(await touchProblems(page, { phone }), what).toEqual([])).toPass({ timeout: 5_000 })
}
