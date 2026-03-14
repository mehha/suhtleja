---
title: Audio TTS Rules
description: Shared text-to-speech route and frontend playback conventions
tags: [suhtleja, tts, audio, frontend, nextjs]
---

# TTS and Audio Playback

## Scope
- Main route: `src/app/(frontend)/next/tts-ms/route.ts`
- Feature consumers:
  - `src/app/(frontend)/quick-chat/QuickChatBoard.tsx`
  - `src/app/(frontend)/feelings/FeelingsBoard.tsx`

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
- Keep a single audio element reference per feature board.
- Use busy state to prevent overlapping playback requests.
- Surface failures as user-visible, retryable errors.

## Robustness Rules
- Escape text for SSML.
- Do not cache generated speech (`Cache-Control: no-store`).
- Revoke `URL.createObjectURL` URLs after playback to avoid leaks.

## Change Checklist
- If route payload format changes:
  - Update all feature consumers in same PR.
- If changing output format:
  - Verify content-type mapping and playback compatibility in browser.
