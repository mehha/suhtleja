// Suhtleja's service worker: the child's pages, their speech, sounds and pictures without the
// network. The child's pages fill the caches (src/utilities/offlineCache.ts); this worker only serves
// from them. See docs/rules/project/offline.md.

// The same names as OFFLINE_CACHES in src/utilities/offlineCache.ts.
const PAGES = 'suhtleja-offline-pages-v1'
const STATIC = 'suhtleja-offline-static-v1'
const MEDIA = 'suhtleja-offline-media-v1'
const SHELL = 'suhtleja-offline-shell-v1'
const CURRENT = [PAGES, STATIC, MEDIA, SHELL]
const OFFLINE_PAGE = '/offline.html'
// A kept page shows when the network hasn't answered by then (a weak or captive Wi-Fi).
const NETWORK_TIMEOUT_MS = 4000

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL)
      await shell.add(new Request(OFFLINE_PAGE, { cache: 'reload' }))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('suhtleja-offline-') && !CURRENT.includes(name)) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

// The child's pages: the home, a board and the game (as FrontendShell's child view).
function isChildPage(url) {
  return url.pathname === '/kodu' || url.pathname === '/connect-dots' || /^\/boards\/\d+$/.test(url.pathname)
}

const offline = () => self.navigator.onLine === false

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  const ours = url.origin === self.location.origin

  if (request.mode === 'navigate') {
    if (ours && isChildPage(url)) event.respondWith(childPage(request, url))
    return
  }
  // The build's files never change under the same name: the kept copy answers at once.
  if (ours && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(buildFile(request))
    return
  }
  // Speech, sounds and pictures come from the network, and from the device without it.
  if (
    (ours && (url.pathname.startsWith('/next/tts-cache/') || url.pathname === '/_next/image')) ||
    request.destination === 'image' ||
    request.destination === 'audio'
  ) {
    event.respondWith(mediaFile(request, url))
  }
})

async function keptPage(url) {
  const cache = await caches.open(PAGES)
  const exact = await cache.match(url.href)
  if (exact || url.pathname === '/connect-dots') return exact
  // `/kodu?toast=…`, or a board opened with `?from=` that wasn't kept that way (no back button).
  return cache.match(url.origin + url.pathname)
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function childPage(request, url) {
  const kept = await keptPage(url)
  if (!kept) {
    try {
      return await fetch(request)
    } catch {
      return (await caches.match(OFFLINE_PAGE, { cacheName: SHELL })) || Response.error()
    }
  }
  if (offline()) return kept
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS)
    // The site down shows the kept page; anything else (a login, a redirect) is the site's answer.
    return response.status >= 500 ? kept : response
  } catch {
    return kept
  }
}

// A route's brackets come both ways: the page names `boards/%5Bid%5D/page.js`, the loader that
// fetches a part later may ask for `boards/[id]/page.js`.
function bracketForms(href) {
  const plain = href.replace(/%5B/gi, '[').replace(/%5D/gi, ']')
  return [plain, plain.replace(/\[/g, '%5B').replace(/\]/g, '%5D')].filter((form) => form !== href)
}

async function buildFile(request) {
  const cache = await caches.open(STATIC)
  for (const key of [request, ...bracketForms(request.url)]) {
    const kept = await cache.match(key, { ignoreVary: true })
    if (kept) return kept
  }
  const response = await fetch(request)
  // Lazily loaded parts (the word forms) are kept as the page loads them.
  if (response.ok) {
    const copy = response.clone()
    caches.open(STATIC).then((cache) => cache.put(request, copy)).catch(() => undefined)
  }
  return response
}

async function keptMedia(request, url) {
  const cache = await caches.open(MEDIA)
  const exact = await cache.match(request, { ignoreVary: true })
  if (exact) return exact
  // A picture is kept in one size; any size of it is shown with that one.
  const src = url.origin === self.location.origin && url.pathname === '/_next/image' && url.searchParams.get('url')
  return src ? cache.match(`${url.origin}/_next/image?url=${encodeURIComponent(src)}`, { ignoreVary: true }) : undefined
}

async function mediaFile(request, url) {
  if (offline()) {
    const kept = await keptMedia(request, url)
    if (kept) return ranged(request, kept)
  }
  try {
    return await fetch(request)
  } catch (error) {
    const kept = await keptMedia(request, url)
    if (kept) return ranged(request, kept)
    throw error
  }
}

// Safari asks for sound in ranges (`Range: bytes=0-1` first) and plays only a ranged answer.
async function ranged(request, response) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '')
  if (!range || response.type === 'opaque' || (!range[1] && !range[2])) return response
  const blob = await response.blob()
  const size = blob.size
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Type': response.headers.get('Content-Type') || blob.type || 'application/octet-stream',
    },
  })
}
