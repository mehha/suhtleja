import type { Page } from '@playwright/test'

// Waits until React has taken over the page (hydration), so a click or typing reaches its handlers.
// A test is quicker than a person: on a slow runner WebKit runs the dev server's JavaScript for
// seconds after the page shows, and a button pressed before that does nothing, or sends the form
// the browser's own way. React marks an element as its own once it and everything in it is ready,
// so the body is the last.
export async function pageReady(page: Page) {
  await page.waitForFunction(() => Object.keys(document.body).some((key) => key.startsWith('__reactFiber')), undefined, {
    timeout: 60_000,
  })
}
