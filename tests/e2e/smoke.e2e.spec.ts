import { expect, test, type Page } from '@playwright/test'

import { countPlayedAudio } from './audio'
import { pageReady } from './ready'

// Read-only smoke tests for the public site. They never submit forms or change data, so they are
// safe to run against production after a deploy.

const PUBLIC_PAGES = ['/', '/kuidas-see-tootab', '/kontakt', '/meist', '/privaatsus', '/kasutustingimused']

// Uncaught errors and failed requests to the site itself or its media, collected while a page loads.
function collectProblems(page: Page, origin: string): string[] {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`))
  page.on('response', (response) => {
    const url = response.url()
    const ours = url.startsWith(origin) || url.startsWith('https://media.suhtleja.ee/')
    if (ours && response.status() >= 400) problems.push(`${response.status()} ${url}`)
  })
  return problems
}

// Scroll through the page so lazy images and one-time entrances (Reveal) load.
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < height; y += 500) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(150)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
}

for (const path of PUBLIC_PAGES) {
  test(`${path} loads with one h1, working images and no errors`, async ({ page, request, baseURL }) => {
    const problems = collectProblems(page, new URL(baseURL!).origin)

    const response = await page.goto(path)
    expect(response?.status(), 'page status').toBe(200)

    const h1 = page.locator('h1')
    await expect(h1, 'exactly one h1').toHaveCount(1)
    await expect(h1).not.toBeEmpty()
    await expect(page.locator('footer')).toBeVisible()

    await scrollThrough(page)
    // A lazy image the quick scroll didn't start loads now: the check is that it loads, not when.
    // After most deploys, WebKit on CI's iPhone left the homepage's video poster unloaded on the
    // first try, and the retry passed (2026-11-02).
    await page.evaluate(() => {
      for (const img of document.images) if (img.loading === 'lazy' && !img.complete) img.loading = 'eager'
    })
    // Images on screen must load in the browser.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            [...document.images]
              .filter((img) => img.src && img.getClientRects().length > 0)
              .filter((img) => !img.complete || img.naturalWidth === 0)
              .map((img) => img.src),
          ),
        { message: 'visible images that did not load', timeout: 15_000 },
      )
      .toEqual([])

    // Images in hidden tabs or closed panels only load when shown, so check their URLs directly.
    const allImages = await page.evaluate(() => [...new Set([...document.images].map((img) => img.currentSrc || img.src))].filter(Boolean))
    for (const src of allImages) {
      expect((await request.get(src)).status(), src).toBe(200)
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, 'horizontal scroll in px').toBeLessThanOrEqual(0)
    expect(problems).toEqual([])
  })
}

// Public pages are static (see content-pages.md, "Caching"). Reading cookies or headers in the layout
// or a page would make them render per request again, with `cache-control: private, no-store`.
test('public pages are served from the cache', async ({ request }) => {
  test.skip(!process.env.SMOKE_BASE_URL, 'next dev renders every request')
  for (const path of PUBLIC_PAGES) {
    const response = await request.get(path)
    expect(response.headers()['cache-control'], path).not.toContain('no-store')
  }
})

// Suhtleja can go on a home screen as an app (install-app.md): the pages link the manifest and the
// iOS icon, and both are served.
test('pages link the web app manifest and the home screen icon', async ({ request }) => {
  const html = await (await request.get('/')).text()
  const manifestPath = html.match(/<link rel="manifest" href="([^"]+)"/)?.[1]
  const iconPath = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/)?.[1]
  expect(manifestPath, 'manifest link').toBe('/manifest.webmanifest')
  expect(iconPath, 'apple-touch-icon link').toBeTruthy()

  const manifest = await request.get(manifestPath!)
  expect(manifest.status()).toBe(200)
  const app = await manifest.json()
  expect(app).toMatchObject({ start_url: '/kodu', display: 'standalone' })
  for (const src of [iconPath!, ...app.icons.map((icon: { src: string }) => icon.src)]) {
    const icon = await request.get(src)
    expect(icon.status(), src).toBe(200)
    expect(icon.headers()['content-type'], src).toContain('image/png')
  }
})

test('/demo redirects permanently to Kuidas see töötab', async ({ request }) => {
  const response = await request.get('/demo', { maxRedirects: 0 })
  expect(response.status()).toBe(308)
  expect(response.headers().location).toContain('/kuidas-see-tootab')
})

test('homepage speech route serves homepage words and nothing else', async ({ request }) => {
  const html = await (await request.get('/')).text()
  const speechPath = html.match(/\/next\/homepage-tts\/[a-f0-9]{64}/)?.[0]
  expect(speechPath, 'a speech URL on the homepage').toBeTruthy()

  const audio = await request.get(speechPath!)
  expect(audio.status()).toBe(200)
  expect(audio.headers()['content-type']).toContain('audio/')

  expect((await request.get(`/next/homepage-tts/${'0'.repeat(64)}`)).status()).toBe(404)
  expect((await request.get('/next/homepage-tts/not-a-hash')).status()).toBe(404)
})

test('"Kuula ise" tile says its word and adds it to the sentence bar', async ({ page }) => {
  const played = await countPlayedAudio(page)
  await page.goto('/')
  const tile = page.locator('#kuula').getByRole('button', { name: /^Ütle: / }).first()
  const word = ((await tile.getAttribute('aria-label')) ?? '').replace(/^Ütle: /, '')

  // The word plays. The test above checks the speech route's answers: WebKit on Linux loads audio in
  // two requests and reports the first with status 0, so a response's status says less than the sound.
  await tile.click()
  await expect.poll(played, { message: 'the word should play' }).toBe(1)

  await expect(page.locator('#kuula ol[aria-label="Lause"] li')).toHaveText([word])
  await expect(page.locator('#kuula').getByText('Heli ei käivitunud')).toHaveCount(0)
})

test('homepage FAQ opens an answer', async ({ page }) => {
  await page.goto('/')
  // A click before React has taken over the page does nothing, and the answer stays shut.
  await pageReady(page)
  const question = page.locator('#kkk').getByRole('button').first()
  const answer = page.locator('#kkk [role="region"]').first()

  await expect(answer).toBeHidden()
  await question.click()
  await expect(answer).toBeVisible()
})

test('homepage offers sign-up', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('a[href="/register"]:visible').first()).toBeVisible()
})

for (const path of ['/register', '/login']) {
  test(`${path} shows its form and stays out of search results`, async ({ page }) => {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })
}
