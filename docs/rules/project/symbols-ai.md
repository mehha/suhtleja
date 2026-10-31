---
title: Symbols and Grammar AI Rules
description: Helper endpoints under /next for pictograms and Groq
tags: [suhtleja, frontend, symbols, groq, api]
---

# Symbols and Groq (`/next/*`)

## Scope
- Routes in `src/app/(frontend)/next/`:
  - `symbols/route.ts` (`GET /next/symbols`)
  - `symbol-image/route.ts` (`GET /next/symbol-image`)
  - `symbol-generate/route.ts` (`GET`/`POST /next/symbol-generate`)
  - `groq/route.ts` (`POST /next/groq`)
- Helpers: `src/utilities/symbolProxy.ts`, `src/utilities/membershipStatus.ts`, `src/utilities/groq.ts` (Groq calls shared by the routes), `src/utilities/symbolGeneration.ts` (limits, prompt), `src/utilities/workersAI.ts` (Workers AI binding)
- Collection: `src/collections/SymbolGenerations.ts` (`symbol-generations`)
- Consumers:
  - `boards/[id]/edit/BoardEditor/Toolbar.tsx` (symbols, groq), `CellEditModal.tsx` (symbols with AI fallback, symbol-generate)
  - `boards/[id]/Runner.tsx` (groq surface-form correction)
  - `src/components/ConnectDots/ConnectDotsEditorField.tsx`, `ConnectDotsFrontendEditor.tsx` (symbols)

## Auth Gate
- All routes call `payload.auth({ headers })` and return `401 { error: 'unauthorized' }` without a user.
- `symbols`, `symbol-generate` and `groq` also require `hasActiveMembership(user)` and return `402 { error: 'membership_required' }` otherwise.
- `symbol-image` requires login only (no membership check), because already-saved board/puzzle images must keep rendering.

## `GET /next/symbols`
- Params: `q` (required, empty returns `{ items: [] }`), `source` (`arasaac` default, `mulberry`, `openmoji`), `limit` (max 100, default 40), `locale`, `preferLocal=true`, `aiFallback=true`.
- Sources:
  - ARASAAC (external API). Without `locale`, searches `et` and `en` and de-duplicates. With `locale`, falls back to `en` when empty.
  - Mulberry Symbols through the Global Symbols API (`globalsymbols.com/api/v1/labels/search`, `symbolset=mulberry`, `language=eng`, no API key). Labels are English only; Global Symbols has Estonian labels only for ARASAAC, so Estonian words reach Mulberry through `aiFallback`. Images are PNGs under `globalsymbols.com/uploads/production/image/`.
  - OpenMoji (fetched from unpkg, filtered by annotation/tags).
  - Local `media` collection when `preferLocal=true`: only media library files (in a folder), and only when `alt` or the file name without its extension is exactly `q` (`src/utilities/findLibraryMedia.ts`). Never match loosely or outside the library: that picked homepage screenshots for "mina" and "ema", and would show one customer's uploads on another customer's board.
- `aiFallback=true`: when the query itself finds nothing, the route asks Groq for English search terms (`getSymbolSearchTerms`), searches each term in the same source (ARASAAC in `en`), gives each term an equal share of `limit` (the sources match prefixes, so "break" would otherwise fill the list with "breakfast"), and returns `{ items, aiTerms }`. A Groq failure returns `{ items: [], aiError }`.
- Every item carries `license` and `attribution`. Keep them; attribution is a license requirement for all three sources.
- Licenses: ARASAAC is CC BY-NC-SA 4.0, and ARASAAC's terms exclude use in commercial products. Suhtleja is a paid membership, so ARASAAC needs written permission from ARASAAC (Gobierno de Aragón) or has to stop being the default. Mulberry (CC BY-SA 4.0, © Steve Lee) and OpenMoji (CC BY-SA 4.0) allow commercial use with attribution. Before adding a Global Symbols set, check its license in `/api/v1/symbolsets`: many are NC or ND.
- Upstream failures return `{ items: [] }`, never a 5xx.

## `GET /next/symbol-image`
- Proxies a symbol image so the client does not hit third-party hosts directly.
- `src` must pass `isProxyableSymbolURL`: https only, `static.arasaac.org/pictograms/*`, `globalsymbols.com/uploads/production/image/*` (Mulberry) or `unpkg.com/**/openmoji@*`. Anything else returns `400 invalid_symbol_url`. Do not widen this allowlist without an SSRF review. The same hosts are in `next.config.js` `images.remotePatterns`, because board cards render saved symbol URLs with `next/image`. Next's optimizer refuses SVG, and OpenMoji and Mulberry symbols are SVG, so card images pass `unoptimized={isSvgImageURL(src)}` (editor, Runner, compound picker).
- Response is `private, max-age=86400, stale-while-revalidate=604800`.
- Saved symbol URLs should be stored as original URLs and wrapped with `getSymbolProxyURL()` at render time.

## `/next/symbol-generate` (AI pictograms)
- `GET` returns `{ limit, remaining }` for the current member.
- `POST { label }` (trimmed, 1-80 characters) generates `SYMBOL_GENERATION_VARIANTS` (4) images and returns `{ images: dataURL[], limit, remaining }`. The client keeps them in memory; only the one the user saves is uploaded to `media`.
- Limit: `SYMBOL_GENERATIONS_PER_MONTH` (30) requests per member per calendar month (UTC), counted from `symbol-generations` rows. Admins are not limited. Over the limit: `429 { error: 'limit_reached' }`. The row is created before generating so parallel requests can't run past the limit, deleted again if every image fails (`502 generation_failed`), and gets the image count afterwards. Admins can see the rows (label, prompt, user) in the admin panel.
- Prompt: Groq turns the label into a short English scene (`getPictogramSubject`, falls back to the label), and `buildPictogramPrompt` wraps it in one fixed style (flat colours, thick black outlines, white background, at most two figures, no text). Keep that style fixed so generated cards look alike on a board.
- Model: Workers AI `@cf/black-forest-labs/flux-2-klein-4b`, 768x768, a different seed per image. FLUX.2 takes multipart form data even for a prompt alone (see `generateImage`). Cost on 2026-10-31: $0.000287 per output 512x512 tile, about $0.001 per image and $0.005 per request.
- Binding: `ai` (`AI`) in `wrangler.jsonc`. Production reads it from the Worker env. Local dev can't use the app's platform proxy (remote bindings are off there so D1 and R2 stay local, and Workers AI only runs remotely), so `getWorkersAI()` opens a second proxy from `wrangler.ai-dev.jsonc`, which holds only the AI binding. It needs `wrangler login` and bills the account. Without the binding the route answers `503 ai_unavailable`.
- The label is a card text; don't add user data to the prompt.

## `POST /next/groq`
- Env: `GROQ_API_KEY` (missing returns 500), `GROQ_MODEL` (default `openai/gpt-oss-120b`, also set in `wrangler.jsonc` vars).
- Groq retires models. Both uses fail soft (the word stays as typed, no search terms), so a retired model turns the features off without an error in the UI; the route logs `Groq word form failed` / `Groq symbol search terms failed` with `model_not_found`. `qwen/qwen3-32b` was retired in 2026. On 2026-10-26, `openai/gpt-oss-120b` gave correct forms for test sentences ("koer joob vett", "ema loeb raamatut", "mina lähen kooli") at about 0.7 s per word; `qwen/qwen3.8-27b` left verbs unconjugated and `openai/gpt-oss-20b` often returned invalid JSON.
- Two modes, body `{ token, contextTail?, task? }`:
  - `task: 'symbol-search-terms'`: returns `{ terms: string[] }` (up to 8 lowercase English ARASAAC search terms).
  - Default: Estonian morphology fix for one token using the last 2 context words, returns `{ surface }`. Without context the token is returned unchanged and Groq is not called.
- Soft-fail rule: on Groq errors respond `200` with the original `surface` (or empty `terms`) plus an `error` string, so board playback is never blocked by the LLM.
- Do not send user PII to the prompt; only the card label and up to 2 preceding words.

## Change Checklist
- New external symbol source: add license/attribution to each item and extend `isProxyableSymbolURL` deliberately.
- Keep all three routes `runtime = 'nodejs'` where already set and never cache authenticated responses publicly.
- Keep user-facing errors Estonian in the UI layer; the routes return machine-readable `error` codes.
