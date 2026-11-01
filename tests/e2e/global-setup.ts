import type { FullConfig } from '@playwright/test'

// Before the tests, the dev server compiles the API routes they use. It compiles each on its first
// request, and a route compiled while a test ran (/next/word-class) made it reload every page open
// in the browsers: the tests on them lost what they had tapped and failed. The requests carry no
// login, so the routes answer 401: compiled all the same.
//
// Pages are left to the browser. A page with a server action, compiled for a plain request, got
// another action id when the browser compiled it: the action failed and the page reloaded.

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
  ['POST', '/next/tts-ms'],
  ['POST', '/next/groq'],
  ['POST', '/next/symbol-generate/save'],
  ['POST', '/next/stripe/webhook'],
]

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000'
  const started = Date.now()

  for (const [method, path] of ROUTES) {
    await fetch(new URL(path, baseURL), {
      method,
      redirect: 'manual',
      ...(method === 'POST' ? { body: '{}', headers: { 'Content-Type': 'application/json' } } : {}),
      // The first compile can take a while on a CI runner.
      signal: AbortSignal.timeout(120_000),
    }).catch(() => undefined)
  }

  console.log(`Dev server warmed up: ${ROUTES.length} routes in ${Math.round((Date.now() - started) / 1000)}s`)
}
