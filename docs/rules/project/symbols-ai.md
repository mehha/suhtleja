---
title: Symbols, Grammar AI, and Photo Search Rules
description: Membership-gated helper endpoints under /next for pictograms, Groq, and Pexels
tags: [suhtleja, frontend, symbols, groq, pexels, api]
---

# Symbols, Groq, and Pexels (`/next/*`)

## Scope
- Routes in `src/app/(frontend)/next/`:
  - `symbols/route.ts` (`GET /next/symbols`)
  - `symbol-image/route.ts` (`GET /next/symbol-image`)
  - `groq/route.ts` (`POST /next/groq`)
  - `pexels/route.ts` (`GET /next/pexels`)
- Helper: `src/utilities/symbolProxy.ts`, `src/utilities/membershipStatus.ts`
- Consumers:
  - `boards/[id]/edit/BoardEditor/Toolbar.tsx`, `CellEditModal.tsx` (symbols, groq)
  - `boards/[id]/Runner.tsx` (groq surface-form correction)
  - `src/components/ConnectDots/ConnectDotsEditorField.tsx`, `ConnectDotsFrontendEditor.tsx` (symbols)
  - `pexels` has no current frontend consumer.

## Auth Gate
- All routes call `payload.auth({ headers })` and return `401 { error: 'unauthorized' }` without a user.
- `symbols`, `groq`, and `pexels` also require `hasActiveMembership(user)` and return `402 { error: 'membership_required' }` otherwise.
- `symbol-image` requires login only (no membership check), because already-saved board/puzzle images must keep rendering.

## `GET /next/symbols`
- Params: `q` (required, empty returns `{ items: [] }`), `source` (`arasaac` default, `openmoji`), `limit` (max 100, default 40), `locale`, `preferLocal=true`.
- Sources:
  - ARASAAC (external API). Without `locale`, searches `et` and `en` and de-duplicates. With `locale`, falls back to `en` when empty.
  - OpenMoji (fetched from unpkg, filtered by annotation/tags).
  - Local `media` collection when `preferLocal=true` and an `alt`/filename matches.
- Every item carries `license` and `attribution`. Keep them; ARASAAC is CC BY-NC-SA and attribution is a license requirement.
- Upstream failures return `{ items: [] }`, never a 5xx.

## `GET /next/symbol-image`
- Proxies a symbol image so the client does not hit third-party hosts directly.
- `src` must pass `isProxyableSymbolURL`: https only, `static.arasaac.org/pictograms/*` or `unpkg.com/**/openmoji@*`. Anything else returns `400 invalid_symbol_url`. Do not widen this allowlist without an SSRF review.
- Response is `private, max-age=86400, stale-while-revalidate=604800`.
- Saved symbol URLs should be stored as original URLs and wrapped with `getSymbolProxyURL()` at render time.

## `POST /next/groq`
- Env: `GROQ_API_KEY` (missing returns 500), `GROQ_MODEL` (default `qwen/qwen3-32b`).
- Two modes, body `{ token, contextTail?, task? }`:
  - `task: 'symbol-search-terms'`: returns `{ terms: string[] }` (up to 8 lowercase English ARASAAC search terms).
  - Default: Estonian morphology fix for one token using the last 2 context words, returns `{ surface }`. Without context the token is returned unchanged and Groq is not called.
- Soft-fail rule: on Groq errors respond `200` with the original `surface` (or empty `terms`) plus an `error` string, so board playback is never blocked by the LLM.
- Do not send user PII to the prompt; only the card label and up to 2 preceding words.

## `GET /next/pexels`
- Env: `PEXELS_API_KEY`. Param `q` (default `cat`), returns the Pexels search JSON (20 results) or `{ photos: [] }` on upstream failure.
- Legacy/unused. Remove it or add a consumer and attribution handling before relying on it.

## Change Checklist
- New external symbol source: add license/attribution to each item and extend `isProxyableSymbolURL` deliberately.
- Keep all four routes `runtime = 'nodejs'` where already set and never cache authenticated responses publicly.
- Keep user-facing errors Estonian in the UI layer; the routes return machine-readable `error` codes.
