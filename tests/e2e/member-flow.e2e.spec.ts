import { randomUUID } from 'crypto'
import { expect as baseExpect, test } from '@playwright/test'

import { countPlayedAudio } from './audio'
import { startTrial } from './member'
import { testAccountEmail } from './testAccounts'

// A new customer's main path: register, start a trial, unlock the parent view with a PIN, put a
// board on the child home, give it a compound and hear it speak. It creates an account and a board, so it runs only
// against a local server; Playwright's global teardown deletes the account afterwards.

test.skip(!!process.env.SMOKE_BASE_URL, 'Creates an account, so it never runs against a deployed site.')

// The dev server compiles each route on its first request, which takes more than the default 5s on
// CI runners (a click that opens a new page, the first word that loads its speech).
const expect = baseExpect.configure({ timeout: 30_000 })

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

test('a new customer registers, unlocks the parent view and hears a board speak', async ({ page }) => {
  test.skip(!webhookSecret, 'Needs STRIPE_WEBHOOK_SECRET, the same one the local server uses.')
  test.setTimeout(240_000)

  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const password = `e2e-${run}-Passw0rd`
  const pin = '2580'
  const boardName = `Testtahvel ${run}`
  // The compound step makes "kass" after "kaks" into "kassi".
  const words = ['kaks', 'kass']
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
    await startTrial(page.request, user.id, run)

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

    // Managing the membership (which can cancel it) and the account name need the parent view.
    await page.goto('/profile')
    await expect(page.getByText('Liikmelisuse haldamiseks ava vanema vaade')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Halda liikmelisust' })).toHaveCount(0)
    await expect(page.getByText('Nime muutmiseks ava vanema vaade')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvesta nimi' })).toHaveCount(0)
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
    // The header's main menu has a Koduhaldus link too (in the menu sheet on phones).
    await expect(page.getByRole('main').getByRole('link', { name: 'Koduhaldus' })).toBeVisible()
  })

  await test.step('change the name on the profile', async () => {
    await page.goto('/profile')
    await page.getByLabel('Nimi').fill('  Testija Uus  ')
    await page.getByRole('button', { name: 'Salvesta nimi' }).click()
    await expect(page.getByText('Nimi salvestatud.')).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Nimi')).toHaveValue('Testija Uus')
    await page.goto('/kodu')
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

  await test.step('the board and its editor link to each other', async () => {
    await page.goto(`/boards/${boardId}`)
    await expect(page.getByRole('heading', { level: 1, name: boardName })).toBeVisible()
    await page.getByRole('link', { name: 'Muuda tahvlit' }).click()
    await expect(page).toHaveURL(new RegExp(`/boards/${boardId}/edit$`))
    await page.getByRole('link', { name: 'Vaata tahvlit' }).click()
    await expect(page).toHaveURL(new RegExp(`/boards/${boardId}$`))
  })

  await test.step('add a compound', async () => {
    await page.goto(`/boards/${boardId}/compounds`)
    await page.getByRole('button', { name: 'Lisa esimene sõnaühend' }).click()

    // The cards are picked in the order the child taps them.
    const picker = page.getByRole('dialog', { name: 'Uus sõnaühend' })
    await picker.getByRole('button', { name: 'kaks', exact: true }).click()
    await picker.getByRole('button', { name: 'kass', exact: true }).click()
    await picker.getByRole('button', { name: 'Lisa sõnaühend' }).click()

    // The new compound opens with the cards' own words.
    const compoundWords = page.getByLabel('Sõna', { exact: true })
    await expect(compoundWords).toHaveCount(2)
    await expect(compoundWords.nth(0)).toHaveValue('kaks')
    await expect(compoundWords.nth(1)).toHaveValue('kass')
    await compoundWords.nth(1).fill('kassi')

    // Leaving with unsaved changes asks first.
    await page.getByRole('link', { name: 'Muuda tahvlit' }).click()
    const leave = page.getByRole('dialog', { name: 'Salvestamata muudatused' })
    await leave.getByRole('button', { name: 'Jää lehele' }).click()
    await expect(leave).toBeHidden()

    // The save button stays locked until the save returns. The save (a server action, a POST to
    // this page) is held back a second, so the check doesn't depend on how fast the server is.
    const compoundsPage = new RegExp(`/boards/${boardId}/compounds$`)
    await page.route(compoundsPage, async (route) => {
      if (route.request().method() === 'POST') await new Promise((resolve) => setTimeout(resolve, 1000))
      await route.continue()
    })
    await page.getByRole('button', { name: 'Salvesta', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Salvestan…' })).toBeDisabled()
    // Saving synthesizes the compound's speech, so it can take a while.
    await expect(page.getByText('Sõnaühendid salvestatud.')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('button', { name: 'Salvestatud' })).toBeDisabled()
    await page.unroute(compoundsPage)

    // Kuula says the whole compound.
    const heard = page.waitForResponse((response) => new URL(response.url()).pathname === '/next/tts-ms')
    await page.getByRole('button', { name: 'Kuula: kaks kassi' }).click()
    const heardResponse = await heard
    expect(heardResponse.request().postDataJSON()).toEqual({ text: 'kaks kassi.' })
    expect(heardResponse.status()).toBe(200)
    // The board's own speech is checked from here on.
    speech.length = 0

    await page.getByRole('link', { name: 'Vaata tahvlit' }).click()
    await expect(page).toHaveURL(new RegExp(`/boards/${boardId}$`))
  })

  await test.step('put the board on the child home', async () => {
    await page.goto('/koduhaldus')
    const row = page.getByRole('row').filter({ hasText: boardName })
    const homeSwitch = row.getByRole('switch', { name: `Näita koduvaates: ${boardName}` })
    await expect(homeSwitch).not.toBeChecked()
    await homeSwitch.click()
    // The switch flips at once; the toast comes when the save returns.
    await expect(homeSwitch).toBeChecked()
    await expect(row.getByText('Koduvaates')).toBeVisible()
    await expect(page.getByText('Tahvel lisati koduvaatesse.')).toBeVisible()
    await expect(page).toHaveURL(/\/koduhaldus$/)

    await page.getByRole('button', { name: 'Lapse vaade', exact: true }).click()
    await expect(page).toHaveURL(/\/kodu$/)
    await expect(page.getByRole('button', { name: 'Vanema vaade', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Koduhaldus' })).toHaveCount(0)
  })

  await test.step('the board speaks', async () => {
    await page.getByRole('button').filter({ hasText: boardName }).click()
    await expect(page).toHaveURL(new RegExp(`/boards/${boardId}$`))

    // The sentence's speech is fetched while the child taps, so "play all" starts at once.
    const sentence = page.waitForRequest((request) => new URL(request.url()).pathname === '/next/tts-ms')
    for (const [index, word] of words.entries()) {
      await page.getByRole('button', { name: word, exact: true }).click()
      await expect.poll(playedAudio, { message: `"${word}" should play` }).toBe(index + 1)
    }
    // The compound: the tapped "kass" tile and the phrase show "kassi", and the sentence says it.
    await expect(page.getByRole('button', { name: 'kassi', exact: true })).toBeVisible()
    await expect(page.locator('.actionbar-container')).toContainText(/kaks.*kassi/)

    expect((await sentence).postDataJSON()).toEqual({ text: 'kaks kassi.' })
    await page.getByRole('button', { name: 'Esita kogu fraas' }).click()
    await expect.poll(playedAudio, { message: 'the sentence should play' }).toBe(words.length + 1)

    // Single words come from the board's saved speech (the runner loads all of it: both words and
    // the compound's "kassi"); the sentence is synthesized once, while the child taps, and "play
    // all" doesn't fetch it again.
    const saved = speech.filter((entry) => entry.path.startsWith(`/next/tts-cache/${boardId}/`))
    expect(new Set(saved.map((entry) => entry.path)).size, 'saved words loaded').toBe(words.length + 1)
    expect(saved.every((entry) => entry.status === 200), JSON.stringify(saved)).toBe(true)
    expect(speech.filter((entry) => entry.path === '/next/tts-ms')).toEqual([{ path: '/next/tts-ms', status: 200 }])
  })

  await test.step('the Kodu button leads back to the child home', async () => {
    await page.getByRole('link', { name: 'Kodu', exact: true }).click()
    await expect(page).toHaveURL(/\/kodu$/)
    // On the child home the same button stays in place as the page heading.
    await expect(page.getByRole('heading', { level: 1, name: 'Kodu' })).toBeVisible()
  })

  await test.step('the parent removes the board from the home', async () => {
    await page.getByRole('button', { name: 'Vanema vaade', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Avan vanema vaate' })
    await dialog.locator('input[data-input-otp]').pressSequentially(pin)
    await expect(dialog).toBeHidden()

    // The page carries no user document: the header gets a name, an email and an id, the cards no
    // owner. A user document has the PIN hash.
    const html = await (await page.request.get('/kodu')).text()
    expect(html).not.toContain('parentPinHash')

    const card = page.getByRole('button').filter({ hasText: boardName })
    await card.getByRole('button', { name: 'Eemalda koduvaatest' }).click()
    // The card goes at once; the toast comes when the save returns.
    await expect(card).toHaveCount(0)
    await expect(page.getByText('Tahvel eemaldati koduvaatest.')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Kodu' })).toBeVisible()
    await expect(page.getByRole('button').filter({ hasText: boardName })).toHaveCount(0)
  })

  await test.step('a word whose saved speech fails is synthesized', async () => {
    // As if the saved speech couldn't be served or made again: the word still speaks.
    const savedSpeech = `**/next/tts-cache/${boardId}/**`
    await page.route(savedSpeech, (route) => route.fulfill({ status: 502 }))
    await page.goto(`/boards/${boardId}`)

    const live = page.waitForRequest((request) => new URL(request.url()).pathname === '/next/tts-ms')
    await page.getByRole('button', { name: 'kaks', exact: true }).click()
    expect((await live).postDataJSON()).toEqual({ text: 'kaks.' })
    await expect.poll(playedAudio, { message: '"kaks" should play' }).toBe(1)
    await page.unroute(savedSpeech)
  })
})
