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
  - `speaker?: string`
- Expected response:
  - Audio binary (`audio/mpeg` or `audio/wav`)

## Environment Requirements
- `SPEECH_KEY` and `SPEECH_REGION` are required for Azure TTS.
- Optional:
  - `SPEECH_VOICE`
  - `SPEECH_OUTPUT_FORMAT`

## Frontend Playback Rules
- Normalize text before sending:
  - Trim whitespace.
  - Add terminal punctuation if missing.
- For boards, prefer saved cached audio from the board manifest before falling back to live `POST /next/tts-ms`.
- Board runner may preload cached audio URLs on page load to reduce first-click latency.
- Keep a single audio element reference per feature board.
- Use busy state to prevent overlapping playback requests.
- Surface failures as user-visible, retryable errors.

## Robustness Rules
- Escape text for SSML.
- Live `POST /next/tts-ms` responses remain uncached (`Cache-Control: no-store`).
- Cached board speech is stored in R2 under deterministic keys derived from normalized text plus voice. Build keys with `getTTSObjectKey`; the homepage route uses the same keys, so a word is synthesized once for boards and the homepage.
- Cached playback URLs are same-origin paths (`/next/tts-cache/<boardId>/<hash>`) derived from board id and hash when the manifest is read. Never rely on a stored absolute origin: databases are cloned between environments.
- Board cache generation should happen when saved grid text or saved compounds change.
- Revoke `URL.createObjectURL` URLs after playback to avoid leaks.

## Homepage Speech
- `GET /next/homepage-tts/<hash>` needs no login, because visitors try the tiles before they register.
- The hash is `getTTSCacheHash(prepareTextForTTS(label), DEFAULT_TTS_VOICE)`. The route answers only when the hash matches a word shown by a published homepage block (`findHomepageSpeechText`); anything else is a 404. Never widen it to accept free text.
- The first request for a word synthesizes and stores it in R2; later requests are served from R2 with `public, max-age=31536000, immutable`.

## Change Checklist
- If route payload format changes:
  - Update all active feature consumers in same PR.
- If changing output format:
  - Verify content-type mapping and playback compatibility in browser.
