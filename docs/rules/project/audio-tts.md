---
title: Audio TTS Rules
description: Shared text-to-speech route and frontend playback conventions
tags: [suhtleja, tts, audio, frontend, nextjs]
---

# TTS and Audio Playback

## Scope
- Main route: `src/app/(frontend)/next/tts-ms/route.ts`
- Cached playback route: `src/app/(frontend)/next/tts-cache/[boardId]/[hash]/route.ts`
- Shared utilities:
  - `src/utilities/azureTTS.ts`
  - `src/utilities/boardTTSCache.ts`
- Feature consumers:
  - `src/app/(frontend)/boards/[id]/Runner.tsx`

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

## Estonian TTS Proxy (`/next/tts-tartu`)
- Route: `src/app/(frontend)/next/tts-tartu/route.ts`
- Endpoint: `POST /next/tts-tartu` with JSON `{ text, speaker?, speed? }`.
- Auth: logged-in user with active membership (`401 unauthorized`, `402 membership_required`).
- Proxies to an external Estonian TTS server and returns `audio/wav` with `Cache-Control: no-store`.
- Env: `TTS_URL` (default `http://localhost:8000/v2`), `TTS_TIMEOUT_MS` (default `20000`), `TTS_DEFAULT_SPEAKER` (default `mari`).
- `speed` is clamped to `0.5`–`2`. Upstream failure returns `502 tts_failed`, timeout returns `504 tts_timeout`.
- Currently no frontend consumer; `tts-ms` is the active path. Confirm a consumer exists before changing its payload.

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
- Cached board speech is stored in R2 under deterministic keys derived from normalized text plus voice.
- Board cache generation should happen when saved grid text or saved compounds change.
- Revoke `URL.createObjectURL` URLs after playback to avoid leaks.

## Change Checklist
- If route payload format changes:
  - Update all active feature consumers in same PR.
- If changing output format:
  - Verify content-type mapping and playback compatibility in browser.
