---
title: Search Rules
description: Public site search route backed by the Payload search plugin
tags: [suhtleja, frontend, search, payload]
---

# Search (`/search`)

## Scope
- Route: `src/app/(frontend)/search/page.tsx` and `page.client.tsx`
- Search input: `src/search/Component.tsx`
- Sync config: `src/search/beforeSync.ts`, `src/search/fieldOverrides.ts`
- Plugin registration: `src/plugins/index.ts` (`searchPlugin`, currently `collections: ['posts']`)

## Data Source and Auth Gate
- Data source: Payload `search` collection (populated by `@payloadcms/plugin-search`), not the source collections directly.
- Public route, no auth required.
- Query param: `?q=`. Matches `title`, `slug`, `meta.title`, `meta.description` with `like`.
- Returns at most 12 results with `pagination: false`.

## Behavior Rules
- Only collections registered in `searchPlugin` are searchable. Pages and boards are not indexed.
- Search results are `noindex, follow` with canonical `/search` (see `seo.md`).
- Metadata title is `Otsing: <query>` when a query is present.

## Side Effects
- None on request. Search docs are created/updated by plugin hooks when source docs are saved.

## Change Checklist
- If adding a collection to `searchPlugin`, update `beforeSync.ts` so `slug`, `meta`, and `categories` map correctly, then run `pnpm generate:types`.
- Existing documents are not backfilled automatically; re-save them or reindex from the admin.
- The page heading and empty-state copy are still English; keep consistent with the rest of the Estonian UI if touched.
