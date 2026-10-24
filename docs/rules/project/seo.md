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
- Internal utility routes (`/search`, auth pages, 404) should stay `noindex`.
- Dynamic page/post metadata generation must pass route path so canonical and Open Graph URL are correct.

## Change Checklist
- If changing route structure, re-check canonical path generation in `generateMeta`.
- If changing site branding or messaging, update shared constants in `src/utilities/seo.ts`.
- If adding a public frontend route, add route-level metadata and verify Open Graph output.
