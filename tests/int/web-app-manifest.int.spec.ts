import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import manifest from '@/app/manifest'
import { shouldOfferInstall } from '@/app/(frontend)/koduhaldus/InstallAppHint'
import { APPLE_TOUCH_ICON } from '@/utilities/webAppManifest'

const publicFile = (src: string) => path.join(process.cwd(), 'public', src)

describe('web app manifest', () => {
  it('opens the child home full screen', () => {
    const app = manifest()
    expect(app.start_url).toBe('/kodu')
    expect(app.scope).toBe('/')
    expect(app.display).toBe('standalone')
    expect(app.name).toBe('Suhtleja')
    expect(app.lang).toBe('et')
  })

  it('has an icon for every use, and each file is in public/', () => {
    const icons = manifest().icons ?? []
    expect(icons.map((icon) => `${icon.sizes} ${icon.purpose ?? 'any'}`)).toEqual(
      expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']),
    )
    for (const icon of icons) expect(existsSync(publicFile(icon.src)), icon.src).toBe(true)
    expect(existsSync(publicFile(APPLE_TOUCH_ICON))).toBe(true)
  })
})

describe('install hint', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1'
  const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15'
  const ANDROID = 'Mozilla/5.0 (Linux; Android 16; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36'
  const nav = (userAgent: string, standalone: boolean | undefined, maxTouchPoints = 5) =>
    ({ userAgent, standalone, maxTouchPoints }) as Navigator & { standalone?: boolean }

  it('shows in an iPhone or iPad browser tab', () => {
    expect(shouldOfferInstall(nav(IPHONE, false), false)).toBe(true)
    // iPadOS Safari says it is a Mac; the touch screen gives it away.
    expect(shouldOfferInstall(nav(IPAD, false), false)).toBe(true)
  })

  it('stays away from the installed app, Macs and other systems', () => {
    expect(shouldOfferInstall(nav(IPHONE, true), false)).toBe(false)
    expect(shouldOfferInstall(nav(IPHONE, false), true)).toBe(false)
    expect(shouldOfferInstall(nav(IPAD, false, 0), false)).toBe(false)
    expect(shouldOfferInstall(nav(ANDROID, undefined), false)).toBe(false)
  })
})
