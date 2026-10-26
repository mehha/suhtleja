import { createHmac, randomUUID } from 'crypto'
import { expect as baseExpect, test, type Page } from '@playwright/test'

import { testAccountEmail } from './testAccounts'

// A new customer's main path: register, start a trial, unlock the parent view with a PIN, put a
// board on the child home and hear it speak. It creates an account and a board, so it runs only
// against a local server; Playwright's global teardown deletes the account afterwards.

test.skip(!!process.env.SMOKE_BASE_URL, 'Creates an account, so it never runs against a deployed site.')

// The dev server compiles each route on its first request, which takes more than the default 5s on
// CI runners (a click that opens a new page, the first word that loads its speech).
const expect = baseExpect.configure({ timeout: 30_000 })

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// What a finished Checkout leads to: Stripe sends a signed customer.subscription.created event for a
// trial, and the webhook gives the account its membership.
async function startTrial(page: Page, userId: number, run: string) {
  const now = Math.floor(Date.now() / 1000)
  const trialEnd = now + 14 * 24 * 60 * 60
  const body = JSON.stringify({
    id: `evt_e2e_${run}`,
    object: 'event',
    type: 'customer.subscription.created',
    created: now,
    data: {
      object: {
        id: `sub_e2e_${run}`,
        object: 'subscription',
        customer: `cus_e2e_${run}`,
        status: 'trialing',
        trial_end: trialEnd,
        cancel_at: null,
        cancel_at_period_end: false,
        items: { object: 'list', data: [{ id: `si_e2e_${run}`, object: 'subscription_item', current_period_end: trialEnd }] },
        metadata: { payloadUserId: String(userId) },
      },
    },
  })
  const signature = createHmac('sha256', webhookSecret!).update(`${now}.${body}`).digest('hex')
  const response = await page.request.post('/next/stripe/webhook', {
    data: body,
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${now},v1=${signature}` },
  })
  expect(response.status(), await response.text()).toBe(200)
}

// Counts the sounds the page starts playing, so the test knows a board really spoke. The board's
// silent unlock sound (a data: URL) doesn't count.
async function countPlayedAudio(page: Page) {
  await page.addInitScript(() => {
    const played: string[] = []
    Object.assign(window, { __playedAudio: played })
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      const src = this.src
      const started = play.call(this)
      if (!src.startsWith('data:')) void started.then(() => played.push(src), () => undefined)
      return started
    }
  })
  return () => page.evaluate(() => (window as unknown as { __playedAudio: string[] }).__playedAudio.length)
}

test('a new customer registers, unlocks the parent view and hears a board speak', async ({ page }) => {
  test.skip(!webhookSecret, 'Needs STRIPE_WEBHOOK_SECRET, the same one the local server uses.')
  test.setTimeout(240_000)

  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const password = `e2e-${run}-Passw0rd`
  const pin = '2580'
  const boardName = `Testtahvel ${run}`
  const words = ['tere', 'aitäh']
  const playedAudio = await countPlayedAudio(page)

  const speech: Array<{ path: string; status: number }> = []
  page.on('response', (response) => {
    const { pathname } = new URL(response.url())
    if (pathname.startsWith('/next/tts-')) speech.push({ path: pathname, status: response.status() })
  })

  await test.step('register', async () => {
    await page.goto('/register')
    await page.getByLabel('Nimi').fill('Testija')
    await page.getByLabel('E-post').fill(testAccountEmail(run))
    await page.getByLabel('Parool', { exact: true }).fill(password)
    await page.getByLabel('Korda parooli').fill(password)
    await page.getByRole('button', { name: 'Loo konto' }).click()

    // Without a membership, the child home sends a new customer to the trial offer.
    await expect(page).toHaveURL(/\/profile\?membership=required$/, { timeout: 60_000 })
    await expect(page.getByText('Alusta tasuta prooviperioodi', { exact: true })).toBeVisible()
  })

  await test.step('start a trial', async () => {
    const { user } = await (await page.request.get('/api/users/me')).json()
    await startTrial(page, user.id, run)

    await page.goto('/profile')
    await expect(page.getByText(/^Prooviperiood lõpeb:/)).toBeVisible()
  })

  await test.step('set a parent PIN', async () => {
    // A new account has the default PIN and starts in the child view, so changing the PIN takes the
    // account password (the forgotten-PIN path), and the PIN can't be removed from here.
    await expect(page.getByRole('button', { name: 'Eemalda PIN' })).toHaveCount(0)
    await page.locator('input[data-input-otp]').pressSequentially(pin)
    await page.getByLabel('Konto parool').fill(`${password}-wrong`)
    await page.getByRole('button', { name: /^(Sea|Uuenda) PIN$/ }).click()
    await expect(page.getByText('Vale parool.')).toBeVisible()

    await page.getByLabel('Konto parool').fill(password)
    await page.getByRole('button', { name: /^(Sea|Uuenda) PIN$/ }).click()
    await expect(page.getByText('PIN salvestatud.')).toBeVisible()
  })

  await test.step('child home keeps the parent pages locked', async () => {
    await page.goto('/kodu')
    await expect(page.getByRole('heading', { level: 1, name: 'Kodu' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Vanema vaade', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lisa tahvel' })).toHaveCount(0)

    await page.goto('/koduhaldus')
    await expect(page).toHaveURL(/\/kodu$/)

    // The game page is a full-screen child page too: no site header or account menu.
    await page.goto('/connect-dots')
    await expect(page.getByRole('button', { name: 'Vanema vaade', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kasutaja menüü' })).toHaveCount(0)

    // Managing the membership (which can cancel it) needs the parent view.
    await page.goto('/profile')
    await expect(page.getByText('Liikmelisuse haldamiseks ava vanema vaade')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Halda liikmelisust' })).toHaveCount(0)
    await page.goto('/kodu')
  })

  await test.step('unlock the parent view with the PIN', async () => {
    await page.getByRole('button', { name: 'Vanema vaade', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Avan vanema vaate' })
    const pinInput = dialog.locator('input[data-input-otp]')

    await pinInput.pressSequentially('1111')
    await expect(dialog.getByText('Vale PIN.')).toBeVisible()
    await expect(pinInput).toHaveValue('')

    await pinInput.pressSequentially(pin)
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('link', { name: 'Koduhaldus' })).toBeVisible()
  })

  let boardId = ''
  await test.step('add a board', async () => {
    await page.getByRole('button', { name: 'Lisa tahvel' }).click()
    const dialog = page.getByRole('dialog', { name: 'Lisa tahvel' })
    await dialog.getByLabel('Nimi').fill(boardName)
    await dialog.getByRole('button', { name: 'Lisa tahvel' }).click()

    await expect(page).toHaveURL(/\/boards\/\d+\/edit$/, { timeout: 60_000 })
    boardId = page.url().match(/\/boards\/(\d+)\/edit$/)![1]!

    // The editor itself isn't covered here. Save the words with the request the editor sends.
    const saved = await page.request.patch(`/api/boards/${boardId}`, {
      data: {
        actionBar: { enabled: true },
        grid: {
          cols: 6,
          rows: 8,
          cells: words.map((title, x) => ({ id: randomUUID(), x, y: 0, w: 1, h: 1, title })),
        },
      },
    })
    expect(saved.status(), await saved.text()).toBe(200)
  })

  await test.step('put the board on the child home', async () => {
    await page.goto('/koduhaldus')
    const row = page.getByRole('row').filter({ hasText: boardName })
    await expect(row.getByText('Peidetud')).toBeVisible()
    await row.getByRole('button', { name: 'Lisa koduvaatesse' }).click()
    await expect(row.getByText('Koduvaates')).toBeVisible()

    await page.getByRole('button', { name: 'Laps', exact: true }).click()
    await expect(page).toHaveURL(/\/kodu$/)
    await expect(page.getByRole('button', { name: 'Vanema vaade', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Koduhaldus' })).toHaveCount(0)
  })

  await test.step('the board speaks', async () => {
    await page.getByRole('button').filter({ hasText: boardName }).click()
    await expect(page).toHaveURL(new RegExp(`/boards/${boardId}$`))

    for (const [index, word] of words.entries()) {
      await page.getByRole('button', { name: word, exact: true }).click()
      await expect.poll(playedAudio, { message: `"${word}" should play` }).toBe(index + 1)
    }
    await expect(page.locator('.actionbar-container')).toContainText(new RegExp(words.join('.*')))

    await page.getByRole('button', { name: 'Esita kogu fraas' }).click()
    await expect.poll(playedAudio, { message: 'the sentence should play' }).toBe(words.length + 1)

    // Single words come from the board's saved speech, the sentence is synthesized on demand.
    const saved = speech.filter((entry) => entry.path.startsWith(`/next/tts-cache/${boardId}/`))
    expect(new Set(saved.map((entry) => entry.path)).size, 'saved words loaded').toBe(words.length)
    expect(saved.every((entry) => entry.status === 200), JSON.stringify(saved)).toBe(true)
    expect(speech.filter((entry) => entry.path === '/next/tts-ms')).toEqual([{ path: '/next/tts-ms', status: 200 }])
  })
})
