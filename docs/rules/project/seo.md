---
title: Frontend SEO Rules
description: Baseline metadata and indexing rules for frontend routes
tags: [suhtleja, frontend, seo, metadata]
---

# Frontend SEO

## Scope
- Shared metadata defaults:
  - `src/app/(frontend)/layout.tsx`
  - `src/utilities/mergeOpenGraph.ts`
  - `src/utilities/generateMeta.ts`
  - `src/utilities/seo.ts`
- Public routes with explicit metadata:
  - `src/app/(frontend)/[slug]/page.tsx`
  - `src/app/(frontend)/posts/page.tsx`
  - `src/app/(frontend)/posts/page/[pageNumber]/page.tsx`
  - `src/app/(frontend)/posts/[slug]/page.tsx`
  - `src/app/(frontend)/search/page.tsx`
- Utility routes with noindex metadata:
  - `src/app/(frontend)/login/page.tsx`
  - `src/app/(frontend)/register/page.tsx`
  - `src/app/(frontend)/not-found.tsx`

## Rules
- Keep site identity consistent in metadata:
  - site name: `Suhtleja`
  - language: `et`
- Public content routes should define:
  - meaningful title
  - concise meta description
  - canonical URL
  - Open Graph title/description/url
- The home page title is `HOME_TITLE` from `src/utilities/seo.ts` unless the page's SEO meta title is set in Payload. Never fall back to the CMS page title ("Home").
- The default Open Graph image is `public/og-image.jpg` (1200×630, `DEFAULT_OG_IMAGE_PATH`). It's used when a page has no SEO meta image. It shows the logo, the home title and the real iPad screenshot (`suhtleja-ipad.webp`); regenerate it if branding, the home title or the trial offer changes.
- Page and post slugs use `slugifyField` from `src/utilities/slugify.ts`, which turns Estonian letters into ASCII (`töötab` → `tootab`). Payload's default slugify drops them.
- When a public slug changes, add a permanent redirect from the old path in `redirects.js`. CMS redirects are cached until a rebuild.
- Internal utility routes (`/search`, auth pages, 404) should stay `noindex`.
- Dynamic page/post metadata generation must pass route path so canonical and Open Graph URL are correct.
- Every CMS page has exactly one h1. `getPageTitleMode` (`src/utilities/pageTitle.ts`) decides how, in `src/app/(frontend)/[slug]/page.tsx`:
  - a hero other than `none`, or the homepage block, already renders the h1, so nothing is added;
  - when the first block opens with a heading that repeats the page title (the first node of a content block's first column, or a features block title; compared ignoring case and a trailing colon), that heading is rendered as the h1;
  - otherwise the page title is shown as an h1 above the content.
  Editors don't need to add a title heading; if they do add one that matches the page title, it becomes the h1 instead of a duplicate.

## Change Checklist
- If changing route structure, re-check canonical path generation in `generateMeta`.
- If changing site branding or messaging, update shared constants in `src/utilities/seo.ts`.
- If adding a public frontend route, add route-level metadata and verify Open Graph output.
