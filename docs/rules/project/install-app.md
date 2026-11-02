---
title: Home Screen App
description: Suhtleja on a tablet's or phone's home screen as an app of its own, and why there is no App Store app
tags: [suhtleja, frontend, pwa, ios, ipad]
---

# Home Screen App

## Scope
- Manifest: `src/app/manifest.ts` (served at `/manifest.webmanifest`, linked from every page by Next.js), built by `webAppManifest` in `src/utilities/webAppManifest.ts`.
- iOS settings: `metadata.appleWebApp`, `metadata.icons.apple` and `viewport.themeColor` in `src/app/(frontend)/layout.tsx`.
- Icons: `public/icons/*.png`, drawn from the favicon's tile by `scripts/app-icons/make-app-icons.mjs` (rerun it and commit the PNG files after changing `public/favicon.svg`).
- Hint for parents: `src/app/(frontend)/koduhaldus/InstallAppHint.tsx`, at the top of Koduhaldus.

## Rules
- The installed app opens on `/kodu` (`start_url`), full screen (`display: 'standalone'`), for the whole site (`scope: '/'`). A visitor who isn't logged in goes on to `/login`, which comes back to `/kodu`.
- The bar and splash colour is the page background (`WEB_APP_THEME_COLOR`, Tailwind's gray-50), so nothing flashes another colour. The iOS status bar style stays `default`, and `viewport-fit` stays as it is: the `env(safe-area-inset-*)` paddings (`ChildModeBar.tsx`, `Runner.tsx`, `NavMobile.tsx`) would change with `cover`.
- iPad and iPhone take the home screen icon from the `apple-touch-icon` link (180 x 180), not the manifest. It has no transparency and no rounded corners: iOS rounds the corners itself and turns transparent pixels black. The maskable icon keeps the heart inside the middle 80%, which Android may cut to a circle.
- iOS has no install prompt, so Koduhaldus shows the steps (share menu, „Lisa avakuvale“) and the tip on Guided Access („Juhendatud juurdepääs“, which keeps the child in Suhtleja). It shows only in an iPad or iPhone browser tab: `navigator.standalone === false` (only iOS has it; true in the installed app), not `display-mode: standalone`, and an iOS user agent or a "Mac" with a touch screen (iPadOS Safari says it is a Mac). Closing it is remembered in `localStorage` (`suhtleja:install-hint-dismissed`), in that browser only. It renders in the browser only (`useSyncExternalStore` with a `false` server snapshot), so the server's HTML has none of it.
- The installed app keeps its own cookies, apart from Safari: the parent logs in there once more, and the hint says so.
- There is no browser back button in the installed app: every page needs its own way on (the header's menu and logo, and on the child's pages the home and back links of `ChildModeBar`).
- Stripe Checkout and the Billing Portal are outside the app's scope; iOS opens them over the app and comes back to Suhtleja on the return URL.

## Why No App Store App (2026-11-02)
- The membership is sold through Stripe. An iOS app that unlocks paid features has to sell it with Apple's in-app purchase (15-30%) or use the EU external purchase link entitlement, which has Apple's fees too, and the membership would then have a second source next to the Stripe webhooks. A login-only app without a way to buy risks rejection, and so does an app that only wraps the website (guideline 4.2).
- What the tablet needs comes without it: full screen and an icon from the home screen, Guided Access, and offline use through a service worker (`offline.md`).
- Revisit it when parents or therapists ask for Suhtleja in the App Store, or when offline use or audio needs something iOS doesn't give a web app. The next step then would be a Capacitor wrapper with something of its own, after deciding between Apple's in-app purchase and the EU link.

## Without The Network
- The child's home, its boards and games and their speech work without the network: see `offline.md`.

## Tests
- `tests/int/web-app-manifest.int.spec.ts`: the manifest's start, display and icons (every file is in `public/`), and when the hint shows.
- `tests/e2e/smoke.e2e.spec.ts`, "pages link the web app manifest and the home screen icon": the links, the manifest and the icons as served (also against production).
- `tests/e2e/devices-parent.e2e.spec.ts`, "Koduhaldus, the home screen hint" (iPad and iPhone): the page gets `navigator.standalone = false`, as WebKit on Linux has none; the hint is touch friendly both ways and stays closed after a reload.
- On a real iPad after a deploy: add Suhtleja to the home screen from Safari; it has the heart icon and the name Suhtleja, opens on `/kodu` full screen, and logging in, the parent PIN, a board's speech, the Stripe portal and back, and Guided Access all work.
