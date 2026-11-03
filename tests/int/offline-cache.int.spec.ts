import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { OFFLINE_CACHES, cardPicture, findPictures, findStaticURLs, pictureKey } from '@/utilities/offlineCache'

// What the device keeps from a page (src/utilities/offlineCache.ts), and that the service worker
// (public/sw.js) looks it up the same way.

const ORIGIN = 'https://suhtleja.ee'
const worker = readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8')

describe('the build files a page names', () => {
  it('finds scripts, styles and fonts in the markup and in the inline React data', () => {
    const html = `
      <link rel="stylesheet" href="/_next/static/css/app.css?dpl=1">
      <link rel="preload" href="/_next/static/media/font-s.p.woff2" as="font">
      <script src="/_next/static/chunks/webpack-abc.js" async></script>
      <script src="/_next/static/chunks/app/(frontend)/layout-x1.js" async></script>
      <script>self.__next_f.push([1,"2:I[\\"/_next/static/chunks/app/(frontend)/boards/%5Bid%5D/page-def.js\\"]\\n3:I[\\"static/chunks/4889-9fdc.js\\"]"])</script>
      <a href="/_next/static/chunks/">not a file</a>`
    expect(findStaticURLs(html, ORIGIN).sort()).toEqual(
      [
        `${ORIGIN}/_next/static/chunks/app/(frontend)/boards/%5Bid%5D/page-def.js`,
        `${ORIGIN}/_next/static/chunks/app/(frontend)/layout-x1.js`,
        `${ORIGIN}/_next/static/chunks/4889-9fdc.js`,
        `${ORIGIN}/_next/static/chunks/webpack-abc.js`,
        `${ORIGIN}/_next/static/css/app.css?dpl=1`,
        `${ORIGIN}/_next/static/media/font-s.p.woff2`,
      ].sort(),
    )
  })

  it('finds the fonts a stylesheet names relative to itself', () => {
    const css = `@font-face{src:url(../media/nunito.woff2) format("woff2")}@font-face{src:url(/_next/static/media/geist-s.p.woff2)}body{background:url("/x.png")}`
    expect(findStaticURLs(css, `${ORIGIN}/_next/static/css/app.css`).sort()).toEqual(
      [`${ORIGIN}/_next/static/media/geist-s.p.woff2`, `${ORIGIN}/_next/static/media/nunito.woff2`].sort(),
    )
  })
})

describe('the pictures a page shows', () => {
  it('keeps an optimized picture once, at about 640px, under a key for every size', () => {
    const src = `/api/media/file/kass.webp?2026`
    const srcset = [256, 640, 1080]
      .map((width) => `/_next/image?url=${encodeURIComponent(src)}&amp;w=${width}&amp;q=75 ${width}w`)
      .join(', ')
    const [picture] = findPictures(`<img srcset="${srcset}" src="/_next/image?url=x&amp;w=3840&amp;q=75">`, ORIGIN)
    expect(picture).toEqual({
      url: `${ORIGIN}/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`,
      key: pictureKey(ORIGIN, src),
      sameOrigin: true,
    })
  })

  it('keeps other pictures as they are, a picture from another site too', () => {
    const pictures = findPictures('<img src="/og-image.jpg"><img src="https://static.arasaac.org/kass.svg"><img src="data:image/png;base64,AA">', ORIGIN)
    expect(pictures).toEqual([
      { url: `${ORIGIN}/og-image.jpg`, key: `${ORIGIN}/og-image.jpg`, sameOrigin: true },
      { url: 'https://static.arasaac.org/kass.svg', key: 'https://static.arasaac.org/kass.svg', sameOrigin: false },
    ])
  })
})

describe("a board card's picture", () => {
  // A board's cards render in the browser only, so their pictures come from the offline list.
  it('is asked for the way the board shows it: optimized, at about 640px, under the shared key', () => {
    const src = '/next/dev-media/pildipank-kass.png'
    expect(cardPicture(src, ORIGIN)).toEqual({
      url: `${ORIGIN}/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`,
      key: pictureKey(ORIGIN, src),
      sameOrigin: true,
    })
  })

  it('keeps an SVG symbol as it is, since the board shows those unoptimized', () => {
    const src = '/next/symbol-image/openmoji-1F436.svg'
    expect(cardPicture(src, ORIGIN)).toEqual({ url: `${ORIGIN}${src}`, key: `${ORIGIN}${src}`, sameOrigin: true })
  })
})

describe('the service worker', () => {
  it('reads the caches the pages fill', () => {
    for (const name of Object.values(OFFLINE_CACHES)) expect(worker).toContain(`'${name}'`)
  })

  it('looks a picture up by the same key', () => {
    expect(pictureKey(ORIGIN, '/a b.png')).toBe(`${ORIGIN}/_next/image?url=%2Fa%20b.png`)
    expect(worker).toContain('`${url.origin}/_next/image?url=${encodeURIComponent(src)}`')
  })
})
