---
title: Content Pages Rules
description: Blocks and conventions for the public CMS pages (Kuidas see töötab, Kontakt, Meist, legal pages)
tags: [suhtleja, pages, blocks, payload]
---

# Content Pages

## Scope
- Page route: `src/app/(frontend)/[slug]/page.tsx`
- Steps block (`howItWorks`): `src/blocks/HowItWorks/config.ts`, `src/blocks/HowItWorks/Component.tsx`
- Contact block (`contact`): `src/blocks/Contact/config.ts`, `src/blocks/Contact/Component.tsx`, `src/blocks/Contact/CopyButton.tsx`
- Page h1 logic: `src/utilities/pageTitle.ts` (see `docs/rules/project/seo.md`)
- Shared brand pieces: `src/components/Brand` (see `docs/rules/project/ui-components.md`)

## Caching
- Public pages (`/` and `[slug]`) are static (`export const dynamic = 'force-static'` in both page files). They are built at deploy, kept in the R2 incremental cache and served from it by OpenNext before the Next.js server loads (`enableCacheInterception` in `open-next.config.ts`).
- A cached page must not depend on the visitor. `force-static` makes `cookies()` and `headers()` empty, so the layout and header render logged out and in child mode. In the browser:
  - the header loads the user;
  - the admin bar appears only for admins;
  - the parent/child toggle reads the `uiMode` cookie.
  The header and the admin bar share one `/api/users/me` request per page (`src/utilities/fetchClientUser.ts`).
- Edits in the admin refresh pages at once:
  - pages through `revalidatePath`;
  - the header, footer and page sitemap through `revalidateTag(tag, { expire: 0 })`.
  There is no background revalidation queue, so don't use `'max'` (stale-while-revalidate) or time-based `revalidate` here; such entries are served stale and never refresh. `/posts` (time-based) shows this.
- Content changed outside the admin (Payload scripts run with `context: { disableRevalidate: true }`) shows after the next deploy, which rebuilds the cache.
- Draft previews still render per request: the draft mode cookie skips the cache.
- App pages (`/kodu`, boards, profile, login) read cookies and render per request.

## Main menu
- The header menu is content in the Header global. Intended items: "Kuidas see töötab", "Hind" (`/#hind`) and "Kontakt", plus the "Proovi tasuta" button for logged-out visitors (in code).
- The footer links "Meist" and "KKK" (`/#kkk`) as well as the legal pages.
- `/demo` redirects permanently to `/kuidas-see-tootab` (`redirects.js`). The board-making video belongs in the steps block there.

## Alignment
- The page title and the content, steps and contact blocks sit in `PageFrame` (`src/components/Brand`), so their left edge lines up with the header logo at every width. Use it for new content page blocks too; `max-w-7xl px-4` or `xl:container` start 16–48px away from the logo.

## Rich text pages
- Full-width content columns keep a readable line length (about 70 characters) and align left with the page title (`src/blocks/Content/Component.tsx`).
- "Meist" sticks to facts the team has confirmed: the mission, the team description, the company details and what the product does. Don't add a founder story, partners or numbers without the team's input.

## Steps block (`howItWorks`)
- Use it first on "Kuidas see töötab", with the page title as its title, so it becomes the page's h1.
- Each step has a title, a description and optionally a screenshot or a short video from the real app, with an aspect ratio (4:3 default). Videos show controls and don't autoplay.
- Steps without media show only the number and text; there is no placeholder frame (an outlined placeholder read as broken, empty boxes). Add real screenshots, not generated mockups.
- Screenshots and videos sit in a navy device frame (the same look as the "Kuula ise" board). Upload screenshots at the frame's aspect ratio (1:1, 4:3 or 16:9) so nothing is letterboxed.
- The current step screenshots (`suhtleja-samm-*.webp`) were taken from the app with a local test account and generic boards, never with real families' boards.
- Numbers sit in their own column with a dashed line between them; each step plays a one-time `Reveal` entrance.
- The optional closing panel (`cta`) renders only when the button text and link are set.
- New steps blocks start with six default steps in Estonian; keep claims factual (trial length comes from `MEMBERSHIP_TRIAL_DAYS`).

## Contact block (`contact`)
- Email (required) and phone are shown large; the email has a copy button for devices without a mail app.
- Topic buttons open a `mailto:` link with the topic's subject filled in. Default topics: parents, kindergartens/schools/therapy, feedback.
- `responseNote` renders only when set. Don't promise a response time the team can't keep.
- Company name, registry code and address render small at the bottom.
- The page title ("Kontakt") is rendered as the h1 automatically; the block itself has no title.
- There is no contact form: the form builder plugin exists, but no email adapter is configured, so submissions would only land in the admin. Add a form together with email notifications.
