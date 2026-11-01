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
  - `image-search/route.ts` (`GET /next/image-search`)
  - `picture-bank/route.ts` (`GET /next/picture-bank`)
  - `word-class/route.ts` (`GET /next/word-class`)
  - `symbol-generate/route.ts` (`GET`/`POST /next/symbol-generate`), `symbol-generate/save/route.ts` (`POST /next/symbol-generate/save`)
  - `groq/route.ts` (`POST /next/groq`)
- Helpers: `src/utilities/symbolProxy.ts`, `src/utilities/membershipStatus.ts`, `src/utilities/groq.ts` (Groq calls shared by the routes), `src/utilities/symbolSources.ts` (ARASAAC, Mulberry, OpenMoji searches and the Groq-term fallback), `src/utilities/findLibraryMedia.ts` (own and library pictures, the `AI-pildid` folder, the `Pildipank` categories), `src/utilities/symbolGeneration.ts` (limits, prompt, saving AI pictures), `src/utilities/workersAI.ts` (Workers AI binding), `src/utilities/wordClass.ts` and `src/utilities/wordClassLookup.ts` (word classes)
- Collection: `src/collections/SymbolGenerations.ts` (`symbol-generations`)
- Consumers:
  - `boards/[id]/edit/BoardEditor/Toolbar.tsx` (symbols with `preferLocal`, groq, word-class), `CellEditModal.tsx` (image-search, picture-bank, symbol-generate, symbol-generate/save, word-class)
  - `boards/[id]/Runner.tsx` (groq surface-form correction, for words the board's word forms leave alone)
  - `src/components/ConnectDots/ConnectDotsEditorField.tsx`, `ConnectDotsFrontendEditor.tsx` (symbols)

## Auth Gate
- All routes call `payload.auth({ headers })` and return `401 { error: 'unauthorized' }` without a user.
- `symbols`, `image-search`, `picture-bank`, `word-class`, `symbol-generate` (and `save`) and `groq` also require `hasActiveMembership(user)` and return `402 { error: 'membership_required' }` otherwise.
- `symbol-image` requires login only (no membership check), because already-saved board/puzzle images must keep rendering.

## `GET /next/symbols`
- Params: `q` (required, empty returns `{ items: [] }`), `source` (`arasaac` default, `mulberry`, `openmoji`), `limit` (max 100, default 40), `locale`, `preferLocal=true`, `aiFallback=true`.
- Sources:
  - ARASAAC (external API). Without `locale`, searches `et` and `en` and de-duplicates. With `locale`, falls back to `en` when empty.
  - Mulberry Symbols through the Global Symbols API (`globalsymbols.com/api/v1/labels/search`, `symbolset=mulberry`, `language=eng`, no API key). Labels are English only; Global Symbols has Estonian labels only for ARASAAC, so Estonian words reach Mulberry through Groq's English terms (`aiFallback` here, always in `image-search`). Images are PNGs under `globalsymbols.com/uploads/production/image/`.
  - OpenMoji (fetched from unpkg, filtered by annotation/tags).
  - Local `media` collection when `preferLocal=true` (bulk add), only when `alt` or the file name without its extension is exactly `q` (`src/utilities/findLibraryMedia.ts`): first the member's own picture (`findOwnMedia`), then a media library file (in a folder; admin folders before `AI-pildid`, `findLibraryMedia`). Never match loosely or take another customer's files outside the library: that picked homepage screenshots for "mina" and "ema", and would show one customer's uploads on another customer's board.
- `aiFallback=true`: when the query itself finds nothing, the route asks Groq for English search terms (`getSymbolSearchTerms`), searches each term in the same source (ARASAAC in `en`), gives each term an equal share of `limit` (the sources match prefixes, so "break" would otherwise fill the list with "breakfast"), and returns `{ items, aiTerms }`. A Groq failure returns `{ items: [], aiError }`.
- Every item carries `license` and `attribution`. Keep them; attribution is a license requirement for all three sources.
- Licenses: ARASAAC is CC BY-NC-SA 4.0, and ARASAAC's terms exclude use in commercial products. Suhtleja is a paid membership, so ARASAAC needs written permission from ARASAAC (Gobierno de Aragón) or has to stop being the default. Mulberry (CC BY-SA 4.0, © Steve Lee) and OpenMoji (CC BY-SA 4.0) allow commercial use with attribution. Before adding a Global Symbols set, check its license in `/api/v1/symbolsets`: many are NC or ND.
- Upstream failures return `{ items: [] }`, never a 5xx.

## `GET /next/picture-bank` (card editor)
- The picture bank is the library folder `Pildipank` (top level) and its subfolders, one per category. `scripts/pildipank/import.ts` fills it (see `media.md`); admins can rename, add or remove pictures there like any library media.
- Without params returns `{ categories: [{ id, name, cover, count }] }`: the subfolders that hold images, in creation order (`sort: 'id'`), each with its oldest image as `cover`. The import creates the folders in the intended order and each category's cover picture first.
- `?folder=<id>` returns `{ folder: { id, name }, pictures }` (`PictureItem`s with `mediaId`, oldest first, up to 400). `400 invalid_folder` for a non-numeric id, `404 not_found` when the folder is not a direct subfolder of `Pildipank`.
- Bank pictures are ordinary library media, so the search (`library` group) and bulk add (`findLibraryMedia`, curated folders) find them by their alt text, which is the word.

## `GET /next/word-class` (card editor, bulk add)
- Params: `word`, repeated (`?word=koer&word=sööma`): trimmed, at most 80 characters each, duplicates dropped, at most 60 words.
- Returns `{ classes: { <word>: <class> | null } }`, keyed by the words as sent. Classes are `person`, `verb`, `adjective`, `noun`, `place`, `question`, `social` and `other` (`WORD_CLASSES` in `src/utilities/wordClass.ts`); null means nothing is known and the card stays without a colour.
- `guessWordClass` decides: pronouns in their cases, question words, imperatives and one-word ma-infinitives by rule (not `ema`, `tema` or the listed nouns in -ma), then the picture bank category of a bank picture whose alt text is exactly the word (`findPictureBankCategories`, one query for all words; a word in two categories keeps the first imported), then a few social words.
- The category map (`CATEGORY_CLASSES`) must name every category in `CATEGORY_ORDER` (`scripts/pildipank/lib.ts`); `tests/int/word-class.int.spec.ts` fails when the bank gets a category the map doesn't know. It gives a category's usual class; the word rules come first because the bank files some verbs and pronouns elsewhere ("laulma" under Inimesed, "mina" under Suhtlemine).

## `GET /next/image-search` (card editor)
- Params: `q` (trimmed, at most 80 characters; may be empty), `scope` (`all` default, `mine`, `library`, `arasaac`, `mulberry`, `openmoji`).
- Returns `{ mine, library, banks, aiError? }`. `mine` and `library` items carry `mediaId`; the editor sets those as the card's `image`, symbol items as `externalImageURL`.
  - `mine`: the member's own image media (`owner` = user), `alt` or file name containing `q`, newest first.
  - `library`: image media in any folder (the shared library), same match, without the member's own files (they are in `mine`).
  - `banks`: one `{ bank, items, aiTerms? }` per symbol bank, which the editor shows as its own group. `all` ("Kõik allikad") searches ARASAAC and Mulberry; a bank scope searches that bank. OpenMoji (emoji, not AAC symbols) is never part of `all`. Nothing without a query.
- `all` returns at most 12 per picture group and 24 per bank; a single scope up to 40. Without a query, `mine` and `library` list the newest files.
- Groq's English terms (`searchSymbolBanks` in `symbolSources.ts`): a bank that finds nothing for the word itself searches the terms when its labels are English only (Mulberry, OpenMoji: an Estonian word never matches there), or when no group found anything (ARASAAC). Groq is asked at most once per search; once asked, every empty bank uses the terms and carries `aiTerms`. A bank that found the word keeps its own result. Each term's exact match comes before the prefix matches. So most Estonian searches in `all` cost one Groq call (about 1–2 s more).
- The bank searches run alongside the media queries; only the Groq decision waits for them.
- Media is publicly readable, so the route's `where` (owner or folder) is what keeps other customers' files out. Keep it that way.

## `GET /next/symbol-image`
- Proxies a symbol image so the client does not hit third-party hosts directly.
- `src` must pass `isProxyableSymbolURL`: https only, `static.arasaac.org/pictograms/*`, `globalsymbols.com/uploads/production/image/*` (Mulberry) or `unpkg.com/**/openmoji@*`. Anything else returns `400 invalid_symbol_url`. Do not widen this allowlist without an SSRF review. The same hosts are in `next.config.js` `images.remotePatterns`, because board cards render saved symbol URLs with `next/image`. Next's optimizer refuses SVG, and OpenMoji and Mulberry symbols are SVG, so card images pass `unoptimized={isSvgImageURL(src)}` (editor, Runner, compound picker).
- Response is `private, max-age=86400, stale-while-revalidate=604800`.
- Saved symbol URLs should be stored as original URLs and wrapped with `getSymbolProxyURL()` at render time.

## `/next/symbol-generate` (AI pictograms)
- `GET` returns `{ limit, remaining }` for the current member.
- `POST { label }` (trimmed, 1-80 characters) generates `SYMBOL_GENERATION_VARIANTS` (4) images and returns `{ images: dataURL[], limit, remaining }`. The client keeps them in memory; only the one the user saves is uploaded to `media`.
- `POST` returns `{ generationId, images, personal, limit, remaining }`.
- Limit: `SYMBOL_GENERATIONS_PER_MONTH` (30) requests per member per calendar month (UTC), counted from `symbol-generations` rows. Admins are not limited. Over the limit: `429 { error: 'limit_reached' }`. The row is created before generating so parallel requests can't run past the limit, deleted again if every image fails (`502 generation_failed`), and gets the image count and each image's SHA-256 (`imageHashes`) afterwards.
- `POST /next/symbol-generate/save { generationId, image }` (`saveGeneratedPicture`) stores the chosen data URL as the member's media (`alt` = label, file `ai-<label>-<id>.<ext>`) and links it to the generation. It accepts only the member's own generation, once (`409 already_saved`), and only an image whose hash is on the generation (`400 unknown_image`): a saved picture joins the shared library, so arbitrary uploads must not get in that way. JPEG, PNG or WebP up to 3 MB.
- Sharing: a saved AI picture joins the shared library at once (`shared` = true), filed into the `AI-pildid` folder by the collection's `afterChange` hook, unless Groq marked the label personal (a name of a person, pet, school or place). If Groq fails, the label counts as personal, so nothing is shared by mistake. The modal tells the member before generating and in a toast after saving.
- Admins review them in the admin panel's `AI-pildid` list (`symbol-generations`, with the picture as a thumbnail). Unticking `Ühises kogus` (also as a bulk edit) or deleting the row takes the picture out of the folder; the media stays, so the boards it is on keep it. A picture an admin moved to another folder stays there.
- Prompt: Groq turns the label into a short English scene (`getPictogramSubject`, falls back to the label), and `buildPictogramPrompt` wraps it in one fixed style (flat colours, thick black outlines, white background, at most two figures, no text). Keep that style fixed so generated cards look alike on a board.
- Model: Workers AI `@cf/black-forest-labs/flux-2-klein-4b`, 768x768, a different seed per image. FLUX.2 takes multipart form data even for a prompt alone (see `generateImage`). Cost on 2026-10-31: $0.000287 per output 512x512 tile, about $0.001 per image and $0.005 per request.
- Binding: `ai` (`AI`) in `wrangler.jsonc`. Production reads it from the Worker env. Local dev can't use the app's platform proxy (remote bindings are off there so D1 and R2 stay local, and Workers AI only runs remotely), so `getWorkersAI()` opens a second proxy from `wrangler.ai-dev.jsonc`, which holds only the AI binding. It needs `wrangler login` and bills the account. Without the binding the route answers `503 ai_unavailable`.
- The label is a card text; don't add user data to the prompt. `getPictogramSubject` returns `{ subject, personal }`.

## `POST /next/groq`
- Env: `GROQ_API_KEY` (missing returns 500), `GROQ_MODEL` (default `openai/gpt-oss-120b`, also set in `wrangler.jsonc` vars).
- Groq retires models. Both uses fail soft (the word stays as typed, no search terms), so a retired model turns the features off without an error in the UI; the route logs `Groq word form failed` / `Groq symbol search terms failed` with `model_not_found`. `qwen/qwen3-32b` was retired in 2026. On 2026-10-26, `openai/gpt-oss-120b` gave correct forms for test sentences ("koer joob vett", "ema loeb raamatut", "mina lähen kooli") at about 0.7 s per word; `qwen/qwen3.8-27b` left verbs unconjugated and `openai/gpt-oss-20b` often returned invalid JSON.
- Two modes, body `{ token, contextTail?, task? }`:
  - `task: 'symbol-search-terms'`: returns `{ terms: string[] }` (up to 8 lowercase English ARASAAC search terms).
  - Default: Estonian morphology fix for one token using the last 2 context words, returns `{ surface }`. Without context the token is returned unchanged and Groq is not called. The runner sends the context as the sentence says it and doesn't ask for a word the board's word forms already change (see `boards.md`, "Word form rules").
- Soft-fail rule: on Groq errors respond `200` with the original `surface` (or empty `terms`) plus an `error` string, so board playback is never blocked by the LLM.
- Do not send user PII to the prompt; only the card label and up to 2 preceding words.

## Change Checklist
- New external symbol source: add license/attribution to each item and extend `isProxyableSymbolURL` deliberately.
- Keep all three routes `runtime = 'nodejs'` where already set and never cache authenticated responses publicly.
- Keep user-facing errors Estonian in the UI layer; the routes return machine-readable `error` codes.
