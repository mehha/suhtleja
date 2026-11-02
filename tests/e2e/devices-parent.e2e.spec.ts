import { type Page } from '@playwright/test'

import { silentWav } from './audio'
import { DEFAULT_PIN, startTrial } from './member'
import { pageReady } from './ready'
import { testAccountEmail } from './testAccounts'
import {
  BOARD,
  DOTS,
  createOwnBoard,
  enterParentView,
  expect,
  expectOnScreen,
  expectTouchFriendly,
  orientations,
  rgb,
  test,
  type Viewport,
} from './touch'
import { WORD_CLASS_INFO } from '../../src/utilities/wordClass'

// The pages a parent uses on a phone or tablet: signing up and in, the profile, Koduhaldus, the home
// in the parent view and the editors. Each page is checked upright and turned sideways with
// expectTouchFriendly (named controls, 24px targets, no zoom on iPhone, no sideways scroll), and its
// main actions are done with taps. The child's pages are in devices.e2e.spec.ts.

test.skip(!!process.env.SMOKE_BASE_URL, 'Creates an account, so it never runs against a deployed site.')
test.skip(({ hasTouch }) => !hasTouch, 'Touch screens only.')

// The page upright and turned sideways, without a reload.
async function expectTouchFriendlyBothWays(page: Page, viewport: Viewport | null, what: string) {
  for (const [name, size] of orientations(viewport)) {
    await page.setViewportSize(size)
    await expectTouchFriendly(page, `${what}, ${name}`)
  }
  await page.setViewportSize(orientations(viewport)[0]![1])
}

// An open dialog sits on the screen and is easy to use; its 36px close button shuts it.
async function expectDialogTouchFriendly(page: Page, name: string) {
  const dialog = page.getByRole('dialog', { name })
  await expect(dialog).toBeVisible()
  await expectOnScreen(page, dialog, `${name} dialog`)
  await expectTouchFriendly(page, `${name} dialog`)
  await dialog.getByRole('button', { name: 'Sulge' }).tap()
  await expect(dialog).toBeHidden()
}

// Holds the page's JavaScript back until the returned function is called, which waits for React to
// take over the form: a test can fill the form first, as a password manager or a person on a slow
// connection does.
async function holdScripts(page: Page) {
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route(/\/_next\/static\/chunks\//, async (route) => {
    await held
    await route.continue()
  })
  return async () => {
    release()
    await pageReady(page)
  }
}

test.describe('logged out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("a sign-up filled before the page is ready still goes through, and the profile's offer starts the trial", async ({
    page,
  }) => {
    const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const password = `e2e-${run}-Passw0rd`
    // The trial doesn't start (its Stripe call fails here): the home sends the new member to the
    // profile's trial offer.
    await page.route('**/next/stripe/trial', (route) => route.fulfill({ status: 500, json: { error: 'trial_failed' } }))
    const ready = await holdScripts(page)
    await page.goto('/register', { waitUntil: 'commit' })
    await page.getByLabel('Nimi').fill('Testija')
    await page.getByLabel('E-post').fill(testAccountEmail(run))
    await page.getByLabel('Parool', { exact: true }).fill(password)
    await page.getByLabel('Korda parooli').fill(password)
    await ready()

    await page.getByRole('button', { name: 'Loo konto' }).tap()
    await expect(page).toHaveURL(/\/profile\?membership=required$/, { timeout: 60_000 })

    // The offer starts it without the Stripe page. Stripe is a stand-in again: the test answers for
    // it and sends the signed webhook event a new trial brings.
    await page.unroute('**/next/stripe/trial')
    await page.route('**/next/stripe/trial', async (route) => {
      const { user } = await (await page.request.get('/api/users/me')).json()
      await startTrial(page.request, user.id, run)
      await route.fulfill({ json: { ok: true } })
    })
    await page.getByRole('button', { name: /^Alusta tasuta prooviperioodi/ }).tap()
    await expect(page.getByText('Prooviperiood algas.', { exact: false })).toBeVisible()
    await expect(page.getByText(/^Prooviperiood lõpeb:/)).toBeVisible()
    await expect(page).toHaveURL(/\/profile$/)
  })

  test('a login filled before the page is ready still goes through', async ({ page, member }) => {
    const ready = await holdScripts(page)
    await page.goto('/login', { waitUntil: 'commit' })
    await page.getByLabel('E-post').fill(member.email)
    await page.getByLabel('Parool', { exact: true }).fill(member.password)
    await ready()

    await page.locator('form').getByRole('button', { name: 'Logi sisse' }).tap()
    await expect(page).toHaveURL(/\/kodu$/, { timeout: 60_000 })
  })

  test('a form sent before the page is ready keeps the password out of the address', async ({ page }) => {
    // Before React takes over, the browser sends the form its own way: a GET to the page with every
    // named field in the address (history, server logs). The fields have no names, so nothing goes.
    const password = 'e2e-never-in-a-url'
    const addresses: string[] = []
    page.on('request', (request) => addresses.push(request.url()))
    await holdScripts(page)
    const forms = { '/login': ['E-post', 'Parool'], '/register': ['Nimi', 'E-post', 'Parool', 'Korda parooli'] }
    for (const [path, labels] of Object.entries(forms)) {
      await page.goto(path, { waitUntil: 'commit' })
      // Every field is filled, or the browser holds a required one back and sends nothing.
      for (const label of labels) {
        const value = label === 'Nimi' ? 'Testija' : label === 'E-post' ? testAccountEmail('never') : password
        await page.getByLabel(label, { exact: true }).fill(value)
      }
      const sent = page.waitForRequest((request) => request.isNavigationRequest() && request.method() === 'GET')
      await page.getByLabel('E-post').press('Enter')
      await sent
    }
    expect(addresses.filter((address) => address.includes(password) || address.includes('never%40'))).toEqual([])
  })

  for (const path of ['/login', '/register']) {
    test(`${path} fits the screen and brings up the right keyboards`, async ({ page, viewport }) => {
      await page.goto(path)
      await expectTouchFriendlyBothWays(page, viewport, path)

      // The email keyboard, and addresses and passwords the device has saved.
      const email = page.getByLabel('E-post')
      await expect(email).toHaveAttribute('type', 'email')
      await expect(email).toHaveAttribute('autocomplete', 'email')
      const password = page.getByLabel('Parool', { exact: true })
      await expect(password).toHaveAttribute('autocomplete', path === '/login' ? 'current-password' : 'new-password')
      await email.tap()
      await expect(email).toBeFocused()
    })
  }
})

test.describe('profile', () => {
  test('child view fits the screen, and the PIN field has its name and number pad', async ({ page, viewport }) => {
    await page.goto('/profile')
    await expectTouchFriendlyBothWays(page, viewport, 'profile, child view')

    const pin = page.getByLabel('Uus PIN (4 numbrit)')
    await expect(pin).toHaveAttribute('inputmode', 'numeric')
    // Without the parent view, changing the PIN takes the account password.
    await expect(page.getByLabel('Konto parool')).toBeVisible()
  })

  test('parent view changes the name and the PIN by touch', async ({ page, baseURL, viewport }) => {
    await enterParentView(page, baseURL)
    await page.goto('/profile')
    await expectTouchFriendlyBothWays(page, viewport, 'profile, parent view')
    await expectOnScreen(page, page.getByRole('button', { name: 'Halda liikmelisust' }), 'Halda liikmelisust')

    const name = page.getByLabel('Nimi')
    await name.tap()
    await name.fill('Testija Tahvel')
    await page.getByRole('button', { name: 'Salvesta nimi' }).tap()
    await expect(page.getByText('Nimi salvestatud.')).toBeVisible()

    // The same PIN again, so the other tests still open the parent view with it.
    await page.getByLabel('Uus PIN (4 numbrit)').tap()
    await page.keyboard.type(DEFAULT_PIN)
    await page.getByRole('button', { name: /^(Sea|Uuenda) PIN$/ }).tap()
    await expect(page.getByText('PIN salvestatud.')).toBeVisible()
  })
})

test.describe('Koduhaldus', () => {
  test('fits the screen, and its links and dialog take taps', async ({ page, member, baseURL, viewport }) => {
    await enterParentView(page, baseURL)
    await page.goto('/koduhaldus')
    await expect(page.getByRole('row').filter({ hasText: member.boardName })).toBeVisible()
    await expectTouchFriendlyBothWays(page, viewport, 'Koduhaldus')

    await page.getByRole('button', { name: 'Lisa tahvel' }).tap()
    await expectDialogTouchFriendly(page, 'Lisa tahvel')

    // The table scrolls sideways in its own box; a tap brings the link into view.
    await page.getByRole('row').filter({ hasText: member.boardName }).getByRole('link', { name: 'Muuda' }).tap()
    await expect(page).toHaveURL(new RegExp(`/boards/${member.boardId}/edit$`))
  })
})

test.describe('Koduhaldus, deleting', () => {
  test('a board goes only after the dialog asks, and a member sees no admin columns', async ({
    page,
    member,
    baseURL,
  }) => {
    const name = `Kustutatav ${member.boardName}`
    await createOwnBoard(page.request, name, [{ title: 'mina' }])
    await enterParentView(page, baseURL)
    await page.goto('/koduhaldus')
    await expect(page.getByRole('heading', { level: 1, name: 'Koduhaldus' })).toBeVisible()
    for (const column of ['#', 'Looja', 'Nähtavus']) {
      await expect(page.getByRole('columnheader', { name: column, exact: true })).toHaveCount(0)
    }

    const row = page.getByRole('row').filter({ hasText: name })
    const bin = row.getByRole('button', { name: `Kustuta tahvel: ${name}` })
    const dialog = page.getByRole('alertdialog', { name: 'Kustuta tahvel?' })
    await bin.tap()
    await expect(dialog).toBeVisible()
    await expectOnScreen(page, dialog, 'delete dialog')
    await expectTouchFriendly(page, 'delete dialog')
    await dialog.getByRole('button', { name: 'Loobu' }).tap()
    await expect(dialog).toBeHidden()
    await expect(row).toBeVisible()

    await bin.tap()
    await dialog.getByRole('button', { name: 'Kustuta', exact: true }).tap()
    await expect(page.getByText('Tahvel kustutati.')).toBeVisible()
    await expect(row).toHaveCount(0)
  })
})

test.describe('the starter set', () => {
  test('makes the boards, and the core words open the topic boards', async ({ page, baseURL }, testInfo) => {
    // Its speech is made as the boards are (Azure in CI, about 200 words and forms): one device does.
    test.skip(testInfo.project.name !== 'ipad', 'Runs on the iPad only.')
    test.setTimeout(240_000)
    // The boards load their cards' speech at once: a stand-in, so the browser makes no Azure calls.
    for (const speech of ['**/next/tts-ms', '**/next/tts-cache/**']) {
      await page.route(speech, (route) => route.fulfill({ body: silentWav(), contentType: 'audio/wav' }))
    }
    await enterParentView(page, baseURL)
    await page.goto('/koduhaldus')

    await page.getByRole('button', { name: 'Lisa tahvel' }).tap()
    const dialog = page.getByRole('dialog', { name: 'Lisa tahvel' })
    await dialog.getByRole('button', { name: 'Loo alustuskomplekt' }).tap()

    // The core words board opens, which is on the home.
    await expect(page).toHaveURL(/\/boards\/\d+(\?toast=starter-created)?$/, { timeout: 200_000 })
    await expect(page.getByText('Alustuskomplekt loodud.', { exact: false })).toBeVisible()
    const coreId = Number(new URL(page.url()).pathname.split('/').pop())
    const phrase = page.locator('.actionbar-container')

    await page.getByRole('button', { name: 'mina', exact: true }).tap()
    await page.getByRole('button', { name: 'tahtma', exact: true }).tap()
    await expect(phrase.getByText('tahan', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Söök, avab tahvli Söök ja jook' }).tap()
    await expect(page).toHaveURL(new RegExp(`/boards/\\d+\\?from=${coreId}$`))
    await page.getByRole('button', { name: 'õun', exact: true }).tap()
    for (const word of ['mina', 'tahan', 'õuna']) {
      await expect(phrase.getByText(word, { exact: true })).toBeVisible()
    }

    // The five boards are the member's own (the worker's other tests share the member: they go).
    const me = await (await page.request.get('/api/users/me')).json()
    const names = ['Põhisõnad', 'Söök ja jook', 'Mängimine', 'Tunded', 'Kohad']
    const query = new URLSearchParams({ depth: '0', limit: '50', 'where[owner][equals]': String(me.user.id) })
    names.forEach((name, index) => query.set(`where[name][in][${index}]`, name))
    const { docs } = await (await page.request.get(`/api/boards?${query}`)).json()
    expect(docs.map((board: { name: string }) => board.name).sort()).toEqual([...names].sort())
    expect(docs.filter((board: { pinned: boolean }) => board.pinned).map((board: { id: number }) => board.id)).toEqual([coreId])
    for (const board of docs as Array<{ id: number }>) {
      expect((await page.request.delete(`/api/boards/${board.id}`)).ok()).toBe(true)
    }
  })
})

test.describe('home in the parent view', () => {
  test('fits the screen, and the card buttons take taps', async ({ page, member, baseURL, viewport }) => {
    await enterParentView(page, baseURL)
    await page.goto('/kodu')
    const card = page.getByRole('button').filter({ hasText: member.boardName })
    await expect(card).toBeVisible()
    await expectTouchFriendlyBothWays(page, viewport, 'home, parent view')

    await page.getByRole('button', { name: 'Lisa tahvel' }).tap()
    await expectDialogTouchFriendly(page, 'Lisa tahvel')

    await card.getByRole('link', { name: 'Muuda tahvlit' }).tap()
    await expect(page).toHaveURL(new RegExp(`/boards/${member.boardId}/edit$`))
  })

  test('the menu fits the screen', async ({ page, baseURL, viewport }) => {
    await enterParentView(page, baseURL)
    await page.goto('/kodu')
    // Phones open the menu sheet; from 768px the account menu is in the header.
    if (viewport!.width < 768) {
      await page.getByRole('button', { name: 'Ava menüü' }).tap()
      const sheet = page.getByRole('dialog')
      await expect(sheet.getByRole('link', { name: 'Koduhaldus' })).toBeVisible()
      await expectOnScreen(page, sheet, 'menu sheet')
      await expectTouchFriendly(page, 'menu sheet')
    } else {
      await page.getByRole('button', { name: 'Kasutaja menüü' }).tap()
      const menu = page.getByRole('menu')
      await expect(menu.getByRole('menuitem', { name: 'Logi välja' })).toBeVisible()
      await expectOnScreen(page, menu, 'account menu')
      await expectTouchFriendly(page, 'account menu')
    }
  })
})

test.describe('board editor', () => {
  test('fits the screen, and its dialogs fit and take taps', async ({ page, member, baseURL, viewport }) => {
    // The card dialog searches pictures as it opens; the test doesn't need the symbol banks.
    await page.route('**/next/image-search**', (route) => route.fulfill({ json: { banks: [], library: [], mine: [] } }))
    await enterParentView(page, baseURL)
    await page.goto(`/boards/${member.boardId}/edit`)
    await expect(page.getByRole('button', { name: 'Muuda kaarti' }).first()).toBeVisible()
    await expectTouchFriendlyBothWays(page, viewport, 'board editor')

    for (const name of ['Lisa plokk', 'Lisaseaded']) {
      await page.getByRole('button', { name }).tap()
      await expectDialogTouchFriendly(page, name)
    }
    await page.getByRole('button', { name: 'Muuda kaarti' }).first().tap()
    await expectDialogTouchFriendly(page, 'Muuda')

    await page.getByRole('button', { name: 'Muuda nime' }).tap()
    await expect(page.getByPlaceholder('Nimetu tahvel')).toHaveValue(member.boardName)
    await page.getByRole('button', { name: 'Tühista' }).tap()
    await expect(page.getByRole('heading', { level: 1, name: member.boardName })).toBeVisible()
  })

  test('the card dialog suggests a word class, and the card keeps the one the parent picks', async ({
    page,
    member,
    baseURL,
  }) => {
    await page.route('**/next/image-search**', (route) => route.fulfill({ json: { banks: [], library: [], mine: [] } }))
    const boardId = await createOwnBoard(page.request, `Sõnaliigi valik ${member.boardName}`, [
      { title: 'mina' },
      { title: 'kass' },
    ])
    await enterParentView(page, baseURL)
    await page.goto(`/boards/${boardId}/edit`)

    const card = (word: string) => page.locator('.board-editor-grid > .react-grid-item').filter({ hasText: word })
    await card('mina').getByRole('button', { name: 'Muuda kaarti' }).tap()
    const dialog = page.getByRole('dialog', { name: 'Muuda' })
    const wordClass = dialog.getByRole('combobox', { name: 'Sõnaliik' })
    // A pronoun is known without the picture bank, and so is a ma-infinitive.
    await expect(wordClass).toHaveText(new RegExp(WORD_CLASS_INFO.person.label))
    await dialog.getByRole('textbox', { name: 'Tekst', exact: true }).fill('jooksma')
    await expect(wordClass).toHaveText(new RegExp(WORD_CLASS_INFO.verb.label))

    // Once the parent picks a class, the text no longer changes it.
    await wordClass.tap()
    await page.getByRole('option', { name: new RegExp(`^${WORD_CLASS_INFO.place.label}`) }).tap()
    await dialog.getByRole('textbox', { name: 'Tekst', exact: true }).fill('mina')
    await expect(wordClass).toHaveText(new RegExp(WORD_CLASS_INFO.place.label))
    await dialog.getByRole('button', { name: 'Salvesta' }).tap()
    await expect(dialog).toBeHidden()

    await expect
      .poll(() => card('mina').evaluate((cell) => getComputedStyle(cell).borderTopColor))
      .toBe(rgb(WORD_CLASS_INFO.place.color))
    await page.getByRole('button', { name: 'Salvesta', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Salvestatud' })).toBeVisible()

    const saved = await page.request.get(`/api/boards/${boardId}?depth=0`)
    const cells = (await saved.json()).grid.cells as Array<{ title: string; wordClass: string | null }>
    expect(cells.map(({ title, wordClass }) => ({ title, wordClass }))).toEqual([
      { title: 'mina', wordClass: 'place' },
      { title: 'kass', wordClass: null },
    ])
  })

  test('the card dialog shows how a verb is said, and the board keeps the forms its sentences need', async ({
    page,
    member,
    baseURL,
  }) => {
    await page.route('**/next/image-search**', (route) => route.fulfill({ json: { banks: [], library: [], mine: [] } }))
    // The dialog suggests a word's class from the picture bank's categories ("õun" is in a food
    // category). The test database has no picture bank, so the suggestions come from here; the
    // lookup itself is tested in tests/int/word-class.int.spec.ts.
    const suggestedClasses: Record<string, string> = { jooksma: 'verb', kirjeldama: 'verb', kool: 'place', õun: 'noun' }
    await page.route('**/next/word-class?**', (route) => {
      const word = new URL(route.request().url()).searchParams.get('word') ?? ''
      return route.fulfill({ json: { classes: { [word]: suggestedClasses[word] ?? null } } })
    })
    const boardId = await createOwnBoard(page.request, `Sõnavormid ${member.boardName}`, [
      { title: 'mina', wordClass: 'person' },
      { title: 'jooksma', wordClass: 'verb' },
    ])
    await enterParentView(page, baseURL)
    await page.goto(`/boards/${boardId}/edit`)

    const card = (word: string) => page.locator('.board-editor-grid > .react-grid-item').filter({ hasText: word })
    await card('jooksma').getByRole('button', { name: 'Muuda kaarti' }).tap()
    const dialog = page.getByRole('dialog', { name: 'Muuda' })
    const forms = dialog.getByTestId('cell-verb-forms')
    await expect(forms).toHaveText('Lauses: mina jooksen · tema jookseb · ei jookse · eile jooksin')
    await dialog.getByRole('textbox', { name: 'Tekst', exact: true }).fill('kirjeldama')
    await expect(forms).toHaveText(/veel ei pööra/)
    // A noun card shows its object form.
    await dialog.getByRole('textbox', { name: 'Tekst', exact: true }).fill('õun')
    await expect(forms).toHaveText('Lauses: tahan õuna · kaks õuna')
    // A place card shows where to and where.
    await dialog.getByRole('textbox', { name: 'Tekst', exact: true }).fill('kool')
    await expect(forms).toHaveText('Lauses: lähen kooli · olen koolis')
    await dialog.getByRole('button', { name: 'Tühista' }).tap()
    await expect(dialog).toBeHidden()

    // The switch in Lisaseaded; turned off and on, the board has changes to save.
    await page.getByRole('button', { name: 'Lisaseaded' }).tap()
    const settings = page.getByRole('dialog', { name: 'Lisaseaded' })
    await settings.getByRole('switch', { name: 'Sõnavormid lauses sees' }).tap()
    await settings.getByRole('switch', { name: 'Sõnavormid lauses väljas' }).tap()
    await expect(settings.getByRole('switch', { name: 'Sõnavormid lauses sees' })).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(settings).toBeHidden()
    await page.getByRole('button', { name: 'Salvesta', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Salvestatud' })).toBeVisible()

    // The speech cache has the form "mina" gives the verb, kept apart from the cards' words.
    const saved = await (await page.request.get(`/api/boards/${boardId}?depth=0`)).json()
    const entries = saved.ttsCache.entries as Array<{ source: string; text: string }>
    expect(entries.filter((entry) => entry.source === 'grammar').map((entry) => entry.text)).toEqual(['jooksen.'])
    expect(saved.extra.grammar).toBe(true)
  })

  test('the profile sets the voice and the rate, and the boards speak with them', async ({ page, baseURL }) => {
    const spoken: unknown[] = []
    await page.route('**/next/tts-ms', async (route) => {
      spoken.push(route.request().postDataJSON())
      await route.fulfill({ body: silentWav(), contentType: 'audio/wav' })
    })
    await enterParentView(page, baseURL)
    await page.goto('/profile')

    await page.getByRole('combobox', { name: 'Hääl' }).tap()
    await page.getByRole('option', { name: 'Kert' }).tap()
    await page.getByRole('combobox', { name: 'Kõnekiirus' }).tap()
    await page.getByRole('option', { name: 'Aeglane' }).tap()
    await page.getByRole('button', { name: 'Kuula' }).tap()
    await expect
      .poll(() => spoken)
      .toContainEqual({ text: 'Tere! Mina tahan mängida.', speaker: 'et-EE-KertNeural', rate: 'slow' })
    await page.getByRole('button', { name: 'Salvesta hääl' }).tap()
    await expect(page.getByText('Hääl salvestatud.')).toBeVisible()

    // A board speaks in that voice, at that rate.
    const boardId = await createOwnBoard(page.request, `Hääl ${Date.now()}`, [{ title: 'kass' }])
    await page.goto(`/boards/${boardId}`)
    await page.getByRole('button', { name: 'kass', exact: true }).tap()
    await expect.poll(() => spoken).toContainEqual({ text: 'kass.', speaker: 'et-EE-KertNeural', rate: 'slow' })

    // The other tests speak in the site's voice.
    const { user } = await (await page.request.get('/api/users/me')).json()
    const reset = await page.request.patch(`/api/users/${user.id}`, { data: { speechVoice: null, speechRate: 'normal' } })
    expect(reset.status(), await reset.text()).toBe(200)
  })

  test('the profile sets how the cards write their words', async ({ page, member, baseURL }) => {
    await enterParentView(page, baseURL)
    await page.goto('/profile')
    await page.getByRole('combobox', { name: 'Kaartide tekst' }).tap()
    await page.getByRole('option', { name: 'väiketähed' }).tap()
    await page.getByRole('button', { name: 'Salvesta', exact: true }).tap()
    await expect(page.getByText('Kaartide tekst salvestatud.')).toBeVisible()

    await page.goto(`/boards/${member.boardId}`)
    const label = page.locator('.board-cell-label-text').first()
    await expect.poll(() => label.evaluate((element) => getComputedStyle(element).textTransform)).toBe('lowercase')

    // The other tests see the cards in capitals.
    const { user } = await (await page.request.get('/api/users/me')).json()
    const reset = await page.request.patch(`/api/users/${user.id}`, { data: { labelCase: 'upper' } })
    expect(reset.status(), await reset.text()).toBe(200)
  })

  test('a board prints in its own layout, without the page around it', async ({ page, member, baseURL }) => {
    await enterParentView(page, baseURL)
    await page.goto(`/boards/${member.boardId}`)
    await page.getByRole('link', { name: 'Prindi' }).tap()
    await expect(page).toHaveURL(new RegExp(`/boards/${member.boardId}/print$`))
    await expect(page.getByRole('heading', { level: 1, name: member.boardName })).toBeVisible()
    await expect(page.getByTestId('print-card')).toHaveCount(BOARD.words.length)
    await expectTouchFriendly(page, 'print view')

    // On paper the buttons and the site's bars stay off.
    const print = page.getByRole('button', { name: 'Prindi' })
    await expect(print).toBeVisible()
    await page.emulateMedia({ media: 'print' })
    await expect(print).toBeHidden()
    await expect(page.getByRole('link', { name: 'Kodu', exact: true })).toBeHidden()
    await expect(page.getByTestId('print-card').first()).toBeVisible()
  })

  test('Koduhaldus makes a copy of a board and opens it in the editor', async ({ page, member, baseURL }) => {
    await enterParentView(page, baseURL)
    await page.goto('/koduhaldus')
    await page.getByRole('button', { name: `Tee koopia: ${member.boardName}` }).tap()
    await expect(page).toHaveURL(/\/boards\/\d+\/edit/)
    await expect(page.getByText('Tahvlist tehti sulle koopia. Nüüd saad seda muuta.')).toBeVisible()

    const copyId = Number(new URL(page.url()).pathname.split('/')[2])
    expect(copyId).not.toBe(member.boardId)
    const response = await page.request.get(`/api/boards/${copyId}?depth=0`)
    const copy = (await response.json()) as { name: string; pinned: boolean; grid: { cells: Array<{ title: string }> } }
    expect(copy.name).toBe(`${member.boardName} (koopia)`)
    expect(copy.pinned).toBe(false)
    expect(copy.grid.cells.map((cell) => cell.title)).toEqual(BOARD.words)
    // The other tests count the member's boards.
    expect((await page.request.delete(`/api/boards/${copyId}`)).status()).toBe(200)
  })

  test('a card is set to open another board', async ({ page, member, baseURL }) => {
    await page.route('**/next/image-search**', (route) => route.fulfill({ json: { banks: [], library: [], mine: [] } }))
    const food = `Söögitahvel ${member.boardName}`
    const foodId = await createOwnBoard(page.request, food, [{ title: 'õun' }])
    const boardId = await createOwnBoard(page.request, `Lingiga ${member.boardName}`, [
      { title: 'mina' },
      { title: 'söök' },
    ])
    await enterParentView(page, baseURL)
    await page.goto(`/boards/${boardId}/edit`)

    const card = (word: string) => page.locator('.board-editor-grid > .react-grid-item').filter({ hasText: word })
    await card('söök').getByRole('button', { name: 'Muuda kaarti' }).tap()
    const dialog = page.getByRole('dialog', { name: 'Muuda' })
    const opens = dialog.getByRole('combobox', { name: 'Avab tahvli' })
    await expect(opens).toHaveText('Ei ava, ütleb sõna')
    await opens.tap()
    // The member's own boards are listed, this one not.
    await expect(page.getByRole('option', { name: `Lingiga ${member.boardName}` })).toHaveCount(0)
    await page.getByRole('option', { name: food }).tap()
    await expect(opens).toHaveText(food)
    await dialog.getByRole('button', { name: 'Salvesta' }).tap()
    await expect(dialog).toBeHidden()
    // The card shows that it opens a board.
    await expect(card('söök').getByRole('img', { name: `Avab tahvli: ${food}` })).toBeVisible()
    await page.getByRole('button', { name: 'Salvesta', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Salvestatud' })).toBeVisible()

    const saved = await (await page.request.get(`/api/boards/${boardId}?depth=0`)).json()
    const cells = saved.grid.cells as Array<{ title: string; linkBoard: number | null }>
    expect(cells.map(({ title, linkBoard }) => ({ title, linkBoard }))).toEqual([
      { title: 'mina', linkBoard: null },
      { title: 'söök', linkBoard: foodId },
    ])
  })

  test('compounds are made by tapping cards', async ({ page, member, baseURL, viewport }) => {
    await enterParentView(page, baseURL)
    await page.goto(`/boards/${member.boardId}/compounds`)
    const start = page.getByRole('button', { name: 'Lisa esimene sõnaühend' })
    await expect(start).toBeVisible()
    await expectTouchFriendlyBothWays(page, viewport, 'compounds')

    await start.tap()
    const picker = page.getByRole('dialog', { name: 'Uus sõnaühend' })
    await expectOnScreen(page, picker, 'card picker')
    await expectTouchFriendly(page, 'card picker')
    await picker.getByRole('button', { name: 'mina', exact: true }).tap()
    await picker.getByRole('button', { name: 'tahan', exact: true }).tap()
    await picker.getByRole('button', { name: 'Lisa sõnaühend' }).tap()
    await expect(picker).toBeHidden()

    await expect(page.getByLabel('Sõna', { exact: true })).toHaveCount(2)
    await expectTouchFriendly(page, 'compound')
    // The save bar sits on the bottom edge. The compound isn't saved: saving makes its speech.
    await expectOnScreen(page, page.getByRole('button', { name: 'Salvesta', exact: true }), 'Salvesta')
  })
})

test.describe('game editor', () => {
  test('a new game page fits the screen', async ({ page, baseURL, viewport }) => {
    await enterParentView(page, baseURL)
    await page.goto('/connect-dots/manage/new')
    await expect(page.getByLabel('Pealkiri')).toBeVisible()
    await expectTouchFriendlyBothWays(page, viewport, 'new game')
  })

  test('a tap on the picture adds a dot', async ({ page, member, baseURL, viewport }) => {
    await enterParentView(page, baseURL)
    await page.goto(`/connect-dots/manage/${member.puzzleId}`)
    const dots = page.locator('[data-dot-handle="true"]')
    await expect(dots).toHaveCount(DOTS.length)
    // The server already draws the dots; a tap before React takes over adds none (CI's WebKit).
    await pageReady(page)
    await expectTouchFriendlyBothWays(page, viewport, 'game editor')

    // A free spot in the lower left of the picture (the dots' layer covers it).
    const picture = page.locator('svg:has([data-dot-handle="true"])')
    await picture.scrollIntoViewIfNeeded()
    const box = (await picture.boundingBox())!
    await page.touchscreen.tap(box.x + box.width * 0.15, box.y + box.height * 0.85)
    await expect(dots).toHaveCount(DOTS.length + 1)
    await expect(page.getByRole('button', { name: 'Salvesta muudatused' }).first()).toBeEnabled()
  })
})
