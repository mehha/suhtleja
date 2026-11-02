// Keeps the child's pages, their speech, sounds and pictures on this device, so the child can use
// Suhtleja without the network. The child's pages fill the caches here (OfflineSync); the service
// worker (public/sw.js) serves from them. See docs/rules/project/offline.md.

import { loadGrammar } from '@/utilities/grammar/useGrammar'
import type { OfflineList } from '@/utilities/offlineList'

// The same names as in public/sw.js.
export const OFFLINE_CACHES = {
  pages: 'suhtleja-offline-pages-v1',
  static: 'suhtleja-offline-static-v1',
  media: 'suhtleja-offline-media-v1',
} as const

// FrontendShell marks a page in the child's view with it: only those are kept.
export const CHILD_VIEW_ATTRIBUTE = 'data-child-view'

const META_KEY = 'suhtleja:offline'
// `next dev` has no worker unless a test asks for one (its files change with every edit).
export const OFFLINE_DEV_KEY = 'suhtleja:offline-dev'
// Bump it when what is kept changes: every page is fetched again.
const FORMAT = 1
const PARALLEL = 4
// A picture is kept in one size; the worker serves it for any size of the same picture.
const PICTURE_WIDTH = 640
const PICTURE_ACCEPT = 'image/avif,image/webp,image/*,*/*;q=0.8'

type Meta = {
  format: number
  userId: number
  build: string
  // The version of each kept page.
  pages: Record<string, string>
  list: string
  complete: boolean
}

export type OfflineStatus = 'saving' | 'ready' | 'partial' | 'off'

type Picture = {
  // What to fetch, and the key the worker looks it up by.
  url: string
  key: string
  sameOrigin: boolean
}

function readMeta(): Meta | null {
  try {
    const raw = window.localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw) as Meta) : null
  } catch {
    return null
  }
}

function writeMeta(meta: Meta | null) {
  try {
    if (meta) window.localStorage.setItem(META_KEY, JSON.stringify(meta))
    else window.localStorage.removeItem(META_KEY)
  } catch {
    // Private browsing may refuse; the next visit fetches everything again.
  }
}

// For the tests and for a look in the browser's inspector.
function setStatus(status: OfflineStatus) {
  document.documentElement.dataset.offline = status
}

export function offlineSupported(): boolean {
  if (typeof window === 'undefined' || !window.isSecureContext) return false
  if (!('serviceWorker' in navigator) || !('caches' in window)) return false
  if (process.env.NODE_ENV === 'production') return true
  try {
    return window.localStorage.getItem(OFFLINE_DEV_KEY) === '1'
  } catch {
    return false
  }
}

export function registerOfflineWorker() {
  void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
}

/** Forgets the member's pages, speech and pictures (logging out, or another member on this device). */
export async function clearOfflineData() {
  writeMeta(null)
  if (typeof caches === 'undefined') return
  await Promise.all([caches.delete(OFFLINE_CACHES.pages), caches.delete(OFFLINE_CACHES.media)]).catch(() => undefined)
}

/** The key a picture is kept under: one per picture, whatever size the page asks for. */
export function pictureKey(origin: string, src: string): string {
  return `${origin}/_next/image?url=${encodeURIComponent(src)}`
}

/** The build's files (/_next/static/…) a page or a stylesheet names. */
export function findStaticURLs(text: string, base: string): string[] {
  const found = new Set<string>()
  // Up to a file's extension and its query; a route group's brackets, `app/(frontend)/…`, are part of it.
  for (const match of text.matchAll(/\/_next\/static\/[^"'\\\s<>]+?\.[a-z0-9]+(?=["'\\\s<>)?]|$)(?:\?[^"'\\\s<>)]*)?/gi)) {
    found.add(new URL(match[0], base).href)
  }
  // React's data names a page's parts without the prefix: "static/chunks/app/(frontend)/page-1a2b.js".
  for (const match of text.matchAll(/(?<=["'])static\/(?:chunks|css|media)\/[^"'\\\s<>]+?\.[a-z0-9]+(?=["'\\\s<>)?]|$)/gi)) {
    found.add(new URL(`/_next/${match[0]}`, base).href)
  }
  // A stylesheet may name its fonts relative to itself.
  for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    const url = new URL(match[1]!, base)
    if (url.pathname.startsWith('/_next/static/')) found.add(url.href)
  }
  return [...found]
}

// The candidate of a srcset at PICTURE_WIDTH or just above it, else the largest.
function pickCandidate(srcset: string): string | null {
  const candidates = srcset
    .split(/,\s+/)
    .map((part) => part.trim().split(/\s+/))
    .filter(([url]) => url)
    .map(([url, descriptor]) => ({ url: url!, width: Number.parseInt(descriptor ?? '', 10) || 0 }))
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => a.width - b.width)
  return (sorted.find((candidate) => candidate.width >= PICTURE_WIDTH) ?? sorted.at(-1)!).url
}

/** The pictures a page shows, as the device fetches and keeps them. */
export function findPictures(html: string, origin: string): Picture[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const pictures: Picture[] = []
  for (const img of doc.querySelectorAll('img')) {
    const chosen = pickCandidate(img.getAttribute('srcset') ?? '') ?? img.getAttribute('src')
    if (!chosen || chosen.startsWith('data:')) continue
    const url = new URL(chosen, origin)
    const optimized = url.origin === origin && url.pathname === '/_next/image' && url.searchParams.get('url')
    pictures.push({
      url: url.href,
      key: optimized ? pictureKey(origin, optimized) : url.href,
      sameOrigin: url.origin === origin,
    })
  }
  return pictures
}

// Which build the page runs: kept pages are fetched again after a deploy.
function buildFingerprint(): string {
  const scripts = [...document.querySelectorAll<HTMLScriptElement>('script[src*="/_next/static/"]')].map(
    (script) => script.getAttribute('src') ?? '',
  )
  return scripts.find((src) => src.includes('/webpack')) ?? scripts.sort().join(' ')
}

function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

async function eachLimit<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await work(items[next++]!)
  })
  await Promise.all(runners)
}

// Fetches a file into the cache unless it is there already (the build's files, speech and
// pictures don't change under the same URL). False when it couldn't be fetched.
async function keep(cache: Cache, url: string, init: RequestInit, key = url): Promise<boolean> {
  if (await cache.match(key, { ignoreVary: true })) return true
  try {
    const response = await fetch(url, init)
    // A picture from another site is opaque: it can't be read, but it can be kept and shown.
    if (!response.ok && response.type !== 'opaque') return false
    await cache.put(key, response)
    return true
  } catch {
    return false
  }
}

// A page as the child sees it, or null when it isn't one (the parent switched views meanwhile, the
// login ran out) or couldn't be fetched.
async function fetchChildPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    })
    if (!response.ok || response.redirected) return null
    const html = await response.text()
    return html.includes(CHILD_VIEW_ATTRIBUTE) ? html : null
  } catch {
    return null
  }
}

async function prune(cache: Cache, keepURLs: Set<string>) {
  for (const request of await cache.keys()) {
    if (!keepURLs.has(request.url)) await cache.delete(request)
  }
}

async function run(): Promise<OfflineStatus> {
  let response: Response
  try {
    response = await fetch('/next/offline', { cache: 'no-store', credentials: 'same-origin' })
  } catch {
    return 'off'
  }
  if (!response.ok) return 'off'
  const list = (await response.json()) as OfflineList

  const origin = window.location.origin
  const absolute = (url: string) => new URL(url, origin).href
  const build = buildFingerprint()
  const listVersion = fingerprint(JSON.stringify(list))
  let meta = readMeta()

  // Another member's pages and speech never stay on the device.
  if (meta && meta.userId !== list.userId) {
    await clearOfflineData()
    meta = null
  }
  // Nothing changed, and the browser hasn't cleared the caches meanwhile.
  if (
    meta?.complete &&
    meta.format === FORMAT &&
    meta.build === build &&
    meta.list === listVersion &&
    (await caches.match(absolute('/kodu'), { cacheName: OFFLINE_CACHES.pages }))
  ) {
    return 'ready'
  }

  const [pagesCache, staticCache, mediaCache] = await Promise.all([
    caches.open(OFFLINE_CACHES.pages),
    caches.open(OFFLINE_CACHES.static),
    caches.open(OFFLINE_CACHES.media),
  ])
  const keptVersions = meta && meta.format === FORMAT && meta.build === build ? meta.pages : {}
  const pages: Record<string, string> = {}
  const staticURLs = new Set<string>()
  const pictures = new Map<string, Picture>()
  let pagesOk = true

  await eachLimit(list.pages, PARALLEL, async (page) => {
    const url = absolute(page.url)
    let html: string | null = null
    if (keptVersions[page.url] === page.version) {
      const kept = await pagesCache.match(url)
      if (kept) html = await kept.text()
    }
    if (html === null) {
      html = await fetchChildPage(url)
      if (html === null) {
        pagesOk = false
        return
      }
      await pagesCache.put(url, new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    }
    pages[page.url] = page.version
    for (const file of findStaticURLs(html, origin)) staticURLs.add(file)
    for (const picture of findPictures(html, origin)) pictures.set(picture.key, picture)
  })

  // The files this page loaded, with the word forms, which a board loads only once it shows.
  await loadGrammar().catch(() => undefined)
  for (const entry of performance.getEntriesByType('resource')) {
    if (entry.name.startsWith(`${origin}/_next/static/`)) staticURLs.add(entry.name)
  }

  const results: boolean[] = []
  const record = (ok: boolean) => void results.push(ok)
  await eachLimit([...staticURLs], PARALLEL, async (url) => record(await keep(staticCache, url, {})))
  // The fonts the stylesheets name.
  for (const url of [...staticURLs]) {
    if (!/\.css(\?|$)/.test(url)) continue
    const css = await staticCache.match(url, { ignoreVary: true })
    if (!css) continue
    for (const font of findStaticURLs(await css.text(), url)) {
      if (staticURLs.has(font)) continue
      staticURLs.add(font)
      record(await keep(staticCache, font, {}))
    }
  }

  await eachLimit([...pictures.values()], PARALLEL, async (picture) =>
    record(
      await keep(
        mediaCache,
        picture.url,
        picture.sameOrigin
          ? { credentials: 'same-origin', headers: { Accept: PICTURE_ACCEPT } }
          : { credentials: 'omit', mode: 'no-cors' },
        picture.key,
      ),
    ),
  )
  const media = list.media.map(absolute)
  await eachLimit(media, PARALLEL, async (url) =>
    record(
      await keep(
        mediaCache,
        url,
        url.startsWith(`${origin}/`) ? { credentials: 'same-origin' } : { credentials: 'omit', mode: 'no-cors' },
      ),
    ),
  )

  // Once every page is in, what no page needs any more goes: old builds, boards off the home.
  if (pagesOk) {
    await prune(pagesCache, new Set(list.pages.map((page) => absolute(page.url))))
    await prune(staticCache, staticURLs)
    await prune(mediaCache, new Set([...media, ...pictures.keys()]))
  }

  const complete = pagesOk && results.every(Boolean)
  writeMeta({ format: FORMAT, userId: list.userId, build, pages, list: listVersion, complete })
  // Ask the browser not to clear the caches when space runs low (granted at its discretion).
  void navigator.storage?.persist?.().catch(() => false)
  return complete ? 'ready' : 'partial'
}

let running: Promise<OfflineStatus> | null = null

/** Brings the device's copy up to date. One at a time; the child's pages call it as they open. */
export function syncOffline(): Promise<OfflineStatus> {
  running ??= (async () => {
    setStatus('saving')
    const status = await run().catch((error: unknown) => {
      console.error('Offline copy failed', error)
      return 'partial' as const
    })
    setStatus(status)
    return status
  })().finally(() => {
    running = null
  })
  return running
}
