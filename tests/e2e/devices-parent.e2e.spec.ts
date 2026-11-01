import { type Page } from '@playwright/test'

import { DEFAULT_PIN } from './member'
import { testAccountEmail } from './testAccounts'
import {
  DOTS,
  enterParentView,
  expect,
  expectOnScreen,
  expectTouchFriendly,
  orientations,
  test,
  type Viewport,
} from './touch'

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
    await page.waitForFunction(() => {
      const form = document.querySelector('form')
      return !!form && Object.keys(form).some((key) => key.startsWith('__reactFiber'))
    })
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
