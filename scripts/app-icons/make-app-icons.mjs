// Draws the app icons in public/icons from the favicon's tile (public/favicon.svg): the red gradient
// and the white heart. Rerun it after changing the favicon, and commit the PNG files.
//
// Usage: node scripts/app-icons/make-app-icons.mjs
//
// It renders with the Chromium that the e2e tests use (`pnpm exec playwright install chromium`).

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = path.join(root, 'public/icons')

// The same shapes as public/favicon.svg, in its 64 x 64 space.
const GRADIENT = `
  <linearGradient id="bg" x1="8" x2="56" y1="8" y2="56" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#ff7668" />
    <stop offset="0.55" stop-color="#ef4035" />
    <stop offset="1" stop-color="#bf1f2b" />
  </linearGradient>`
const HEART =
  '<path d="M32.001 17.409c4.698-4.217 11.96-4.077 16.485 0.458 4.525 4.534 4.68 11.759 0.471 16.471L32 51.32 15.043 34.338c-4.209-4.712-4.051-11.947 0.472-16.471 4.528-4.528 11.775-4.68 16.486-0.458Z" fill="#ffffff" />'
const GLINT = '<circle cx="17" cy="17" r="4" fill="#ffffff" fill-opacity="0.28" />'

// The favicon's rounded tile on a transparent ground, for browsers that show the icon as it is.
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRADIENT}</defs>
  <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#bg)" />
  ${GLINT}
  ${HEART}
</svg>`

// The gradient fills the whole square: iOS rounds the corners itself and turns transparency black.
const fullBleed = (viewBox, glint) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <defs>${GRADIENT}</defs>
  <rect x="-10" y="-10" width="84" height="84" fill="url(#bg)" />
  ${glint ? GLINT : ''}
  ${HEART}
</svg>`

const ICONS = [
  // The heart takes about 60% of the width, a little less than on the favicon's tile.
  { file: 'apple-touch-icon.png', size: 180, svg: fullBleed('2 3 60 60', true), transparent: false },
  { file: 'icon-192.png', size: 192, svg: tile, transparent: true },
  { file: 'icon-512.png', size: 512, svg: tile, transparent: true },
  // Android cuts a maskable icon to a circle or another shape: the heart stays inside the middle 80%.
  { file: 'icon-maskable-512.png', size: 512, svg: fullBleed('0 1.2 64 64', false), transparent: false },
]

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const icon of ICONS) {
    await page.setViewportSize({ width: icon.size, height: icon.size })
    const svg = icon.svg.replace('<svg ', `<svg width="${icon.size}" height="${icon.size}" `)
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`)
    await page.screenshot({
      path: path.join(outDir, icon.file),
      omitBackground: icon.transparent,
      clip: { x: 0, y: 0, width: icon.size, height: icon.size },
    })
    console.log(`public/icons/${icon.file} (${icon.size} x ${icon.size})`)
  }
} finally {
  await browser.close()
}
