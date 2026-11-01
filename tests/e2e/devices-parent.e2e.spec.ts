import { type Page } from '@playwright/test'

import { DEFAULT_PIN } from './member'
import { pageReady } from './ready'
import { testAccountEmail } from './testAccounts'
import {
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

  test('a sign-up filled before the page is ready still goes through', async ({ page }) => {
    const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const password = `e2e-${run}-Passw0rd`
    const ready = await holdScripts(page)
    await page.goto('/register', { waitUntil: 'commit' })
    await page.getByLabel('Nimi').fill('Testija')
    await page.getByLabel('E-post').fill(testAccountEmail(run))
    await page.getByLabel('Parool', { exact: true }).fill(password)
    await page.getByLabel('Korda parooli').fill(password)
    await ready()

    await page.getByRole('button', { name: 'Loo konto' }).tap()
    await expect(page).toHaveURL(/\/profile\?membership=required$/, { timeout: 60_000 })
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
    await expect(forms).toHaveText('Lauses: mina jooksen · tema jookseb · ei jookse')
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
