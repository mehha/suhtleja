---
title: UI Components Rules
description: Prefer shared shadcn/ui components before building new primitives
tags: [suhtleja, ui, shadcn]
---

# UI Components

## Primary Rule
- Prefer existing shadcn/ui components from `@/components/ui/*` whenever possible.

## Before Creating a New UI Primitive
- Check whether the component already exists under `src/components/ui`.
- Check the shadcn component catalog: `https://ui.shadcn.com/docs/components`.
- If it does not exist locally but exists in shadcn, install/add that component first.

## Avoid
- Duplicating primitives already covered by shadcn/ui (buttons, dialogs, tabs, selects, etc.).
- Creating one-off variants that should be shared under `src/components/ui`.

## Viewport-Sized Overlays
- For shared sheets, drawers, and mobile menus, prefer stable viewport height units (`svh`) over dynamic viewport height (`dvh`) so Safari on iPad/iOS does not jump when browser chrome changes.
- For mobile menu widths, keep a normal `vw` fallback and use `dvw` only as a supported enhancement.

## Brand Look (public pages)
- Shared brand pieces live in `src/components/Brand`: `ButtonLink`, `toneAt` (logo colours in logo order: orange, red, blue, then green), `LogoTile` (a small copy of a logo tile, with the same gradient and tilt, for icons and step numbers), `Eyebrow` and `SectionIntro`.
- Headings on public pages use `font-display` (Nunito, loaded in `src/app/(frontend)/layout.tsx`); body text stays Geist. Rich text gets the same through the typography settings in `tailwind.config.mjs` (navy headings in the display face, brand-blue links).
- Section labels are short sentence-case text, not tracked capitals; buttons and links don't get arrow icons.
- Use cards for real objects only (a price, a quote, a device). Lists of features or reasons sit open on the section background, with the same padding as any highlighted item so edges line up.
- The footer uses the logo's navy (`#22314c`), not black.
- Brand motion lives in `tailwind.config.mjs` (`tile-drop`, `pop-in`, `chip-in`, `tile-hint`, `sound-bar`, `draw-x`, `fade-up`): springy, short, and always behind `motion-safe:`. The keyframes use the `translate`/`scale` properties so they don't override a tile's `rotate-*`. For a one-time entrance below the fold, wrap content in `Reveal` and style children with `group-data-[reveal=pending]/reveal:` and `group-data-[reveal=in]/reveal:`.
- After changing `tailwind.config.mjs`, restart the dev server; a running server keeps the old config.

## Page Speed
- The theme is always light and is set as `data-theme` on `<html>` in `src/app/(frontend)/layout.tsx`. Don't hide the page until a script runs: the old `html { opacity: 0 }` guard waited for Next.js's JavaScript, so a slow phone saw nothing for 4.2s although the HTML had arrived after 1.6s.
- Only Geist Sans and Nunito's `latin` subset are preloaded. Nunito's other subsets (`latin-ext` for š and ž) load when a page uses them. `font-mono` is the system monospace font.
- An image in the first screen gets `priority` (`MediaFrame` passes it on), so it loads at once with a preload link. Other images stay lazy.
- `public/_headers` gives `/_next/static/*` a one-year `immutable` cache; those file names change with every build.
- Public pages are rendered on every request (`cache-control: private, no-store`), because the root layout reads the login and the `uiMode` cookie. The R2 incremental cache only holds data cached with `unstable_cache`, such as the header and footer globals.

## Error Page
- `src/app/(frontend)/error.tsx` catches errors from pages and their Server Actions, so a failure shows a message instead of a blank page; the header stays.
- A Server Action sent from a page loaded before a deploy fails with `UnrecognizedActionError` (action ids change every build). The error page reloads once by itself (guarded in `sessionStorage` against loops) and otherwise offers a reload button.
