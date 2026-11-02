import { randomUUID } from 'crypto'
import { chromium, request, webkit, type Browser, type FullConfig } from '@playwright/test'

import { createMember } from './member'
import { pageReady } from './ready'

// Before the tests, the dev server compiles every page and API route they use. It compiles each on
// its first request, and one compiled while a test ran made the dev server reload the pages open in
// the browsers, or a server action fail: the tests on them lost what they had tapped and failed.
//
// The API routes take a plain request (no login: they answer 401, compiled all the same). The pages
// take a browser, as a member in the parent view: a page compiled for a plain request got another
// server action id once the browser compiled its client side, and the action failed. The member is
// an e2e account, which the global teardown deletes with its board and game.

const ROUTES: Array<[method: 'GET' | 'POST', path: string]> = [
  ['GET', '/api/users/me'],
  ['GET', '/next/word-class?word=a'],
  ['GET', '/next/picture-bank'],
  ['GET', '/next/image-search?q=a'],
  ['GET', '/next/symbols?q=a'],
  ['GET', '/next/symbol-image'],
  ['GET', '/next/symbol-generate'],
  ['GET', '/next/tts-cache/1/warmup'],
  ['GET', '/next/homepage-tts/warmup'],
  // Linked from every page; browsers fetch it as a page loads.
  ['GET', '/manifest.webmanifest'],
  ['POST', '/next/tts-ms'],
  ['POST', '/next/groq'],
  ['POST', '/next/symbol-generate/save'],
  ['POST', '/next/stripe/webhook'],
]

// Without a login (a member is sent on from them).
const PUBLIC_PAGES = ['/', '/login', '/register']
// As a member, in the parent view.
const MEMBER_PAGES = (boardId: number, puzzleId: number) => [
  '/kodu',
  '/koduhaldus',
  '/profile',
  `/boards/${boardId}`,
  `/boards/${boardId}/edit`,
  `/boards/${boardId}/compounds`,
  `/boards/${boardId}/print`,
  `/connect-dots?puzzle=${puzzleId}`,
  `/connect-dots/manage/${puzzleId}`,
  '/connect-dots/manage/new',
]

// The first compile of a page can take a while on a CI runner.
const PAGE_TIMEOUT = 180_000

async function warmRoutes(baseURL: string) {
  for (const [method, path] of ROUTES) {
    await fetch(new URL(path, baseURL), {
      method,
      redirect: 'manual',
      ...(method === 'POST' ? { body: '{}', headers: { 'Content-Type': 'application/json' } } : {}),
      signal: AbortSignal.timeout(PAGE_TIMEOUT),
    }).catch(() => undefined)
  }
}

// Whichever browser the job installed (the iPhone job has only WebKit). The client code is the same.
async function launchBrowser(): Promise<Browser | null> {
  for (const type of [chromium, webkit]) {
    try {
      return await type.launch()
    } catch {
      // Not installed here.
    }
  }
  return null
}

async function warmPages(baseURL: string): Promise<number> {
  const browser = await launchBrowser()
  if (!browser) return 0
  const api = await request.newContext({ baseURL })
  let warmed = 0

  try {
    // A page's first compile can reload it while it loads (the very thing this does before the
    // tests), so a visit that breaks off is tried again.
    const visit = async (context: Awaited<ReturnType<Browser['newContext']>>, paths: string[]) => {
      const page = await context.newPage()
      for (const path of paths) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await page.goto(path, { timeout: PAGE_TIMEOUT })
            await pageReady(page)
            warmed++
            break
          } catch (error) {
            if (attempt === 3) console.warn(`Warming up ${path} failed:`, error instanceof Error ? error.message : error)
          }
        }
      }
    }

    await visit(await browser.newContext({ baseURL }), PUBLIC_PAGES)

    await createMember(api)
    const board = await api.post('/api/boards', {
      data: {
        name: 'Soojendus',
        actionBar: { enabled: true },
        grid: { cols: 2, rows: 1, cells: ['mina', 'jooksma'].map((title, x) => ({ id: randomUUID(), x, y: 0, w: 1, h: 1, title })) },
      },
    })
    const puzzle = await api.post('/api/connect-dots-puzzles', {
      data: {
        title: 'Soojendus',
        slug: `soojendus-${randomUUID()}`,
        enabled: true,
        externalImageURL: '/og-image.jpg',
        dots: [
          { x: 0.2, y: 0.3 },
          { x: 0.8, y: 0.3 },
        ],
      },
    })
    const boardId = (await board.json()).doc.id as number
    const puzzleId = (await puzzle.json()).doc.id as number

    const { cookies } = await api.storageState()
    const member = await browser.newContext({ baseURL, storageState: { cookies, origins: [] } })
    await member.addCookies([{ name: 'uiMode', value: 'parent', url: baseURL }])
    await visit(member, MEMBER_PAGES(boardId, puzzleId))
  } finally {
    await api.dispose()
    await browser.close()
  }
  return warmed
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000'
  const started = Date.now()

  await warmRoutes(baseURL)
  // A warm-up that fails leaves the pages to compile during the tests, as before.
  const pages = await warmPages(baseURL).catch((error: unknown) => {
    console.warn('Warming up the pages failed:', error instanceof Error ? error.message : error)
    return 0
  })

  console.log(`Dev server warmed up: ${ROUTES.length} routes and ${pages} pages in ${Math.round((Date.now() - started) / 1000)}s`)
}
