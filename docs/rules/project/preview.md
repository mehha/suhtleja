---
title: Draft Preview Rules
description: Draft mode enable/disable routes for Payload admin preview and live preview
tags: [suhtleja, frontend, preview, draft-mode, payload]
---

# Draft Preview (`/next/preview`, `/next/exit-preview`)

## Scope
- Routes:
  - `src/app/(frontend)/next/preview/route.ts`
  - `src/app/(frontend)/next/exit-preview/route.ts`
- Link builder: `src/utilities/generatePreviewPath.ts`
- Producers: `admin.preview` and `admin.livePreview` in `src/collections/Pages/index.ts` and `src/collections/Posts/index.ts`
- Consumer: `src/components/AdminBar/index.tsx` (`onPreviewExit`)

## Data Source and Auth Gate
- No data is read. The routes only toggle Next.js `draftMode()` cookies, then redirect to the page.
- `GET /next/preview` requires all of:
  - `previewSecret` query param equal to `PREVIEW_SECRET` (otherwise `403`).
  - `path`, `collection`, `slug` params present (otherwise `404`), and `path` must start with `/` (relative redirects only).
  - A Payload-authenticated user from the request cookies/headers (otherwise draft mode is disabled and `403`).
- `GET /next/exit-preview` is unauthenticated; it only disables draft mode for the caller's own cookie.

## Behavior Rules
- Supported collections in `generatePreviewPath`: `posts` (`/posts/<slug>`) and `pages` (`/<slug>`). Add new previewable collections to `collectionPrefixMap` and the collection's `admin.preview`.
- `PREVIEW_SECRET` must be set in every environment that uses preview. When unset, preview links are rejected.
- Any authenticated user who has the secret can enable draft mode; the secret is only handed out via admin preview links. Do not expose `PREVIEW_SECRET` to frontend users, and add a role check in the route if non-admin accounts ever receive preview links.
- Keep these routes outside caching; they depend on cookies and must stay dynamic.

## Side Effects
- Sets or clears the Next.js draft mode cookie. No database writes.

## Change Checklist
- If changing the preview URL shape, update `generatePreviewPath`, the route, and any collection `admin.preview` / `livePreview` configs together.
- Re-test: open preview from the admin, confirm unpublished changes render, then exit preview via the admin bar and confirm published content returns.
