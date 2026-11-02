---
title: Offline Use
description: The child's home, boards, games, speech and pictures kept on the device, and served by a service worker without the network
tags: [suhtleja, frontend, pwa, offline, service-worker, audio]
---

# Offline Use

A board is the child's voice, so it must speak without Wi-Fi: on the way, at the grandparents', on a school network that has no internet. The device keeps a copy of the child's view, and a service worker serves it when the network doesn't answer.

## Scope
- List of what to keep: `GET /next/offline` (`src/app/(frontend)/next/offline/route.ts`), built by `buildOfflineList` (`src/utilities/offlineList.ts`).
- Filling the caches: `syncOffline` and helpers in `src/utilities/offlineCache.ts`, started by `src/components/OfflineSync` on the child's pages.
- Serving them: the service worker `public/sw.js` (scope `/`, `Cache-Control: no-cache` in `public/_headers` so a fix reaches the devices at once), and `public/offline.html` for a child's page the device hasn't kept. Change a cache's name in `sw.js` and `OFFLINE_CACHES` together (the worker deletes the old ones as it starts).
- Marker: `FrontendShell` puts `data-child-view` on the content of a page in the child's view (`/kodu`, `/boards/<id>`, `/connect-dots` in child mode) and renders `OfflineSync` there.

## What Is Kept
- `buildOfflineList` (with the member's read access, `overrideAccess: false`):
  - `/kodu`, and the boards on it as `/kodu` lists them (own pinned, shared minus the hidden ones), then the boards their cards open, level by level, at most `OFFLINE_MAX_BOARDS` (40). A board the member can't read is left out.
  - Each board's page, and `/boards/<id>?from=<id>` for every card that opens a kept board (so the back button is there).
  - `/connect-dots?puzzle=<id>` for each game on the home, with the game sounds (`/connect-dots-success.mp3`, each listed game's music).
  - Every speech file in each board's manifest (cards, compounds and word forms), with the member's voice and rate (`boardSpeechQuery(memberBoardSpeech(user))`, the same query the runner adds).
  - Each page has a `version`: a fingerprint of what it shows (its board's and linked boards' `updatedAt`, the home's boards and games, the member's speech, letters, PIN and home order). A page is fetched again only when its version changes.
- `syncOffline` (in the browser, on every child page that loads with the network, 2 s after it shows):
  - Fetches each page whose version changed, as the child sees it: a page without `data-child-view` (the parent switched views meanwhile) or that redirected (login ran out) isn't kept, and the old files stay.
  - From each page's HTML: the build files (`/_next/static/…`, also named without the prefix in React's data, and the fonts the stylesheets name) and the pictures (`<img>`; for `/_next/image` the srcset candidate at 640 px, kept under `pictureKey`, one key per picture whatever size the page asks for).
  - Also keeps the build files the current page loaded (`performance` entries, buffer raised to 2000) after loading the word forms (`loadGrammar`), which a board loads only once it shows.
  - Then the speech and sounds of the list. Files already kept aren't fetched again (they don't change under the same URL).
  - Once every page is in, removes what no page needs any more (old builds, boards off the home, other pictures).
  - Remembers what it kept in `localStorage` (`suhtleja:offline`: member, build, page versions, the list's fingerprint). Nothing changed and `/kodu` still in the cache: it stops after the list request. The build is the webpack runtime's file name without its query (next dev gives its scripts a new `?v=` on every load; with it, every page load fetched all the kept pages again, and on 2026-11-02 CI's runner died at the end of the tests).
  - Another member on the device: everything of the last one goes first. Logging out (`handleSignOut` in the header) and logging in (`login-form.tsx`, for a login that ran out without a logout) call `clearOfflineData`, which removes the pages and media and keeps the build files.
  - Asks the browser to keep the storage (`navigator.storage.persist()`).
  - `document.documentElement.dataset.offline` says `saving`, `ready`, `partial` or `off` (the tests wait for `ready`).
- `next dev` has no worker unless `localStorage['suhtleja:offline-dev']` is `1` (the offline test sets it): its files change with every edit.

## How The Worker Answers
- A child's page (a navigation to `/kodu`, `/boards/<id>`, `/connect-dots`): the network, unless it doesn't answer in 4 s, fails, answers 5xx or the device is offline; then the kept page. `/kodu?toast=…` and a `?from=` board that wasn't kept that way fall back to the page without the query (no back button); `/connect-dots` never does (the query picks the game). A child's page the device hasn't kept shows `offline.html` (Ava kodu, Proovi uuesti). Other pages are left alone.
- Build files (`/_next/static/`): the kept copy first, under both forms of a route's brackets (`[id]` and `%5Bid%5D`); else the network, and the copy is kept (a lazily loaded part).
- Speech, sounds and pictures (`/next/tts-cache/`, `/_next/image`, any image or audio request): the network, and the kept copy when it fails or the device is offline; `/_next/image` of any size finds the kept size. Safari asks for sound in ranges, so a kept sound answers a `Range` request with a 206 slice.
- Posts (server actions, `/next/tts-ms`, `/next/groq`) and the router's RSC requests are never answered by the worker. Without the network an RSC request fails, and Next.js falls back to loading the whole page (`fetch-server-response.js`), which the worker serves: a card that opens a board, the back button and the home link all work.

## Without The Network On The Page
- A tap plays the word from the kept speech (the runner preloads it through the worker).
- "Esita kogu fraas" can't make the sentence (`/next/tts-ms`): `playWordByWord` in `Runner.tsx` says the words one after another from the saved speech, each in its form, else as the card writes it; a tap stops it. The same happens when the speech service fails online.
- The word forms (`loadGrammar`) that can't load leave the word as written, and the next call tries again.
- The AI's forms (`/next/groq`) fail at once and the sentence stays as the word forms give it.
- The parent PIN is checked on the server: without the network the dialog says „Võrguühendus puudub. Vanema vaatesse saab, kui võrk on tagasi.“
- Editing, Koduhaldus and the profile need the network.

## Tests
- `tests/int/offline-list.int.spec.ts`: what the list keeps and leaves out (unreadable, hidden, not on the home), the speech in the member's rate, the game sounds, and which versions a change touches.
- `tests/int/offline-cache.int.spec.ts`: the build files and pictures found in a page, and that `public/sw.js` uses the same cache names and picture key.
- `tests/e2e/devices.e2e.spec.ts`, "without the network" (the `android-tablet` project only: Playwright reaches a service worker's requests only in Chromium, and on the phone the member flow test ran right after it at the end of CI's 10-minute step, where the runner died twice): keeps the home, then fails every request (the dev server's socket stays: next dev sends React part of a page's data through it, `reactDebugChannel`, and a production build has no such channel), opens a board from the home, speaks words and the phrase word by word, opens a linked board with its back button, the game with its picture, and `offline.html`. In next dev a kept page is opened once offline (a second load waited for that socket data), and the route scripts are kept by loading a board and the game once online (next dev's page leaves them to webpack; a production page names them).
- On a real iPad after a deploy: open the home and a board with the network, turn on flight mode, then open the installed app: the home, its boards and their speech, a card that opens a board, the game.
