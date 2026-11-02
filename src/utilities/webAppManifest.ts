import type { MetadataRoute } from 'next'

import { DEFAULT_META_DESCRIPTION, SITE_NAME } from '@/utilities/seo'

// The page background (Tailwind's gray-50, the body's `bg-gray-50`): the installed app's bar and
// splash screen take it, so they match the page instead of flashing another colour.
export const WEB_APP_THEME_COLOR = '#f9fafb'

// The installed app opens on the child's home; a visitor who isn't logged in goes to /login from
// there, and the login comes back to /kodu.
export const WEB_APP_START_URL = '/kodu'

// The files public/icons holds (drawn by scripts/app-icons/make-app-icons.mjs).
export const APPLE_TOUCH_ICON = '/icons/apple-touch-icon.png'

// The web app manifest at /manifest.webmanifest (src/app/manifest.ts). With it a browser can put
// Suhtleja on the home screen as an app of its own, which opens full screen without the browser's
// bars. iPad and iPhone Safari use `display`, `start_url` and `name` from here and the icon from
// the apple-touch-icon link (see docs/rules/project/install-app.md).
export function webAppManifest(): MetadataRoute.Manifest {
  return {
    id: WEB_APP_START_URL,
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DEFAULT_META_DESCRIPTION,
    lang: 'et',
    dir: 'ltr',
    start_url: WEB_APP_START_URL,
    scope: '/',
    display: 'standalone',
    background_color: WEB_APP_THEME_COLOR,
    theme_color: WEB_APP_THEME_COLOR,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: APPLE_TOUCH_ICON, sizes: '180x180', type: 'image/png' },
    ],
  }
}
