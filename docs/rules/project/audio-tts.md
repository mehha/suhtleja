---
title: Audio TTS Rules
description: Shared text-to-speech route and frontend playback conventions
tags: [suhtleja, tts, audio, frontend, nextjs]
---

# TTS and Audio Playback

## Scope
- Main route: `src/app/(frontend)/next/tts-ms/route.ts`
- Cached playback route: `src/app/(frontend)/next/tts-cache/[boardId]/[hash]/route.ts`
- Public homepage speech route: `src/app/(frontend)/next/homepage-tts/[hash]/route.ts`
- Shared utilities:
  - `src/utilities/azureTTS.ts`
  - `src/utilities/boardTTSCache.ts`
  - `src/utilities/homepageSpeech.ts`
- Feature consumers:
  - `src/app/(frontend)/boards/[id]/Runner.tsx`
  - Homepage "Kuula ise" tiles: `src/blocks/SuhtlejaHomepage/sections/ListenTiles.tsx`

## API Contract
- Endpoint: `POST /next/tts-ms`
- Request JSON:
  - `text: string` (required)
  - `speaker?: string`: one of `TTS_VOICES` (`src/utilities/speechSettings.ts`: Anu, Kert) or the default; anything else is the default (`speechVoice`), so a request can't put its own text into the SSML.
  - `rate?: 'slow' | 'normal' | 'fast'`: SSML prosody (`-25%`, none, `+20%`); anything else is `normal`.
- Expected response:
  - Audio binary (`audio/mpeg` or `audio/wav`)

## Environment Requirements
- `SPEECH_KEY` and `SPEECH_REGION` are required for Azure TTS.
- Optional:
  - `SPEECH_VOICE`
  - `SPEECH_OUTPUT_FORMAT`

## The Member's Voice and Rate
- A member picks the voice and the rate on the profile page (`Kõne`, `users.speechVoice` and `speechRate`, parent view only; `Kuula` plays a sample through `/next/tts-ms` before saving). Empty is the site's voice (`SPEECH_VOICE`) at the normal rate.
- A board's saved speech is in the site's voice at the normal rate. For another voice or rate the board page passes them to the runner, which adds `?voice=&rate=` to the saved speech's URLs and sends them with `/next/tts-ms`. `/next/tts-cache` then makes the manifest word in that voice under its own key (`getTTSCacheHash(text, voice, rate)`, the same R2 keys for every board) on the first request, and serves it from R2 after that. It still only speaks the board's own words.
- `getTTSCacheHash` adds the rate to the hashed text only for `slow` and `fast`, so the normal rate's hash, and the speech already in R2, stay as they were.

## Frontend Playback Rules
- Normalize text before sending:
  - Trim whitespace.
  - Add terminal punctuation if missing.
- For boards, prefer saved cached audio from the board manifest before falling back to live `POST /next/tts-ms`.
- When a board word's saved speech didn't preload, the runner tries its URL once more (the route makes missing audio), then synthesizes it live like unsaved speech, so the child still hears the word.
- Board runner may preload cached audio URLs on page load to reduce first-click latency.
- Board runner fetches the sentence's speech while the child builds it (`Runner.tsx`, 300ms after the last tap, sentences up to 10 words), so "Esita kogu fraas" starts at once (measured locally: 10-20ms, was 0.4-1.4s). Unsaved speech (sentences, AI-corrected words) is kept in the page's memory, the last 12, so a replay or an undo doesn't synthesize again. It is never stored in R2: the bucket is served publicly, and a child's sentences can be personal.
- A tap while speech is still loading wins: the older speech stays silent when it arrives.
- Keep a single audio element reference per feature board.
- Use busy state to prevent overlapping playback requests.
- Surface failures as user-visible, retryable errors.

## Robustness Rules
- Escape text for SSML.
- Live `POST /next/tts-ms` responses remain uncached (`Cache-Control: no-store`).
- Cached board speech is stored in R2 under deterministic keys derived from normalized text plus voice. Build keys with `getTTSObjectKey`; the homepage route uses the same keys, so a word is synthesized once for boards and the homepage.
- Cached playback URLs are same-origin paths (`/next/tts-cache/<boardId>/<hash>`) derived from board id and hash when the manifest is read. Never rely on a stored absolute origin: databases are cloned between environments.
- Board cache generation should happen when saved grid text or saved compounds change.
- `ensureBoardTTSManifest` checks R2 and synthesizes missing words 6 at a time (`CACHE_CONCURRENCY` in `boardTTSCache.ts`), not one by one: a save with 24 new words took 10.7s, now 1.9s (measured locally). It stays low so a board full of new words doesn't hit Azure's rate limit. Every word is in R2 before the save returns, so the runner can play it at once.
- A save never fails on speech. A word Azure or R2 fails on stays in the manifest without its audio (logged with the board id and hash, never the word: a child's board can be personal), and `/next/tts-cache` makes it on the first request. Tested in `tests/int/board-speech-store.int.spec.ts`.
- `GET /next/tts-cache/<boardId>/<hash>` reads only the board's manifest (`select: { ttsCache: true }`), with the user's read access (`overrideAccess: false`), since the runner preloads every word of a board at once. Another user's private board is a 404.
- When R2 lacks a manifest word's audio (the save couldn't store it, or the database came from another environment), `/next/tts-cache` synthesizes the manifest's text, stores it under the entry's key and serves it; Azure failing too is a 502. It only ever speaks the board's own words, never free text.
- Revoke `URL.createObjectURL` URLs when they're no longer kept (after playback, or when the runner drops them from its memory or unmounts) to avoid leaks.
- Azure synthesis sends `SPEECH_KEY` with the request itself (`Ocp-Apim-Subscription-Key`). Don't go back to exchanging it for a token first: that was a second round trip to Azure (0.1-0.5s) on every request.

## Homepage Speech
- `GET /next/homepage-tts/<hash>` needs no login, because visitors try the tiles before they register.
- The hash is `getTTSCacheHash(prepareTextForTTS(label), DEFAULT_TTS_VOICE)`. The route answers only when the hash matches a word shown by a published homepage block (`findHomepageSpeechText`); anything else is a 404. Never widen it to accept free text.
- The first request for a word synthesizes and stores it in R2; later requests are served from R2 with `public, max-age=31536000, immutable`.

## Change Checklist
- If route payload format changes:
  - Update all active feature consumers in same PR.
- If changing output format:
  - Verify content-type mapping and playback compatibility in browser.
