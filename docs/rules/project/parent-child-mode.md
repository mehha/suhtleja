---
title: Parent Child Mode Rules
description: Rules for PIN unlock, uiMode cookie, and parent-only route gating
tags: [suhtleja, auth, mode, home, boards]
---

# Parent/Child Mode

## Scope
- Dialog UI: `src/app/(frontend)/kodu/ParentUnlockDialog.tsx`
- Actions: `src/app/(frontend)/kodu/modeActions.ts`
- Utilities: `src/utilities/uiMode.ts`
- Protected route example: `src/app/(frontend)/koduhaldus/page.tsx`
- User PIN fields: `src/collections/Users/index.ts`

## Core Rules
- Modes:
  - `child` is default safe mode.
  - `parent` unlock requires valid 4-digit PIN.
- Cookie contract:
  - Name: `uiMode`
  - Values: `child` or `parent`
  - Path: `/`
  - `sameSite: 'lax'`
  - `secure: true`
- Guards:
  - Use `requireParentMode()` for parent-only routes/actions.
  - Route should redirect to `/kodu` if mode is not `parent`.

## PIN Rules
- PIN validation: exactly 4 digits.
- PIN is stored hashed in `users.parentPinHash`.
- Default hash at user creation comes from `DEFAULT_PARENT_PIN` (fallback `0000`).
- The PIN is the lock, so changing it is a parent action (`pinChangeNeedsPassword` in `src/utilities/parentPin.ts`, checked in `updatePinAction`):
  - In parent mode, or when no PIN is set, the new PIN is enough.
  - In child mode the account password is required too (a parent who forgot the PIN); it is checked with `payload.login`, so wrong passwords count toward the login lockout. Changing the PIN this way does not open parent mode.
- Removing the PIN (`clearPinAction`) and opening the Stripe Billing Portal require parent mode: without a PIN the parent view opens for anyone, and the portal can cancel the membership.
- Changing the account name on `/profile` (`updateNameAction`) requires parent mode, like the other account settings.
- Never rely on hiding a page or link in child mode: the server action or route must check the mode itself (`/profile` is reachable in child mode by typing the address).

## UX Rules
- Keep OTP auto-submit after 4 digits.
- Parent unlock should submit through the controlled client handler, not programmatic native form submission, so mobile Safari stays on the client navigation path.
- On invalid PIN:
  - Clear fields.
  - Return focus to first OTP slot.
- Keep explicit error message for invalid/missing PIN.
- The PIN dialog sits near the top of the screen (`top-[8%]`), not in the middle. The on-screen keyboard covers the bottom of the screen without making the page shorter (iPad Safari): on a 13" iPad turned sideways it takes about 420-480 of 1032 points, and a centred dialog had its PIN boxes at the keyboard's edge and the `Vale PIN.` message and the button under it. The device test checks that the dialog, with the error message, stays in the top half of a tablet upright and sideways and of an upright phone.
- The logged-in header is the app's header, not the site's (`src/Header/Component.client.tsx`, links in `src/Header/Nav/links.ts`):
  - The logo leads to `/kodu`. The main menu (`AppNav`) has labelled links with the current page marked: `Kodu`, plus `Koduhaldus` in the parent view. `/home` is a redirect alias for `/kodu`.
  - The parent/child switch is one labelled button for the view you can switch to (`ParentModeToggle`): `Lapse vaade` (filled navy, the parent's main action) in the parent view, and `Vanema vaade` (opens the PIN dialog) in the child view. Phones under 380px wide show the short labels `Laps` and `Vanem`.
  - The account menu has `Profiil ja liikmelisus` (parent view), the CMS header links except homepage sections such as `/#hind` (`infoLinks`), and `Logi välja`.
  - Under the `md` breakpoint the main menu and account menu move into the menu sheet (`NavMobile` with `account`), so the bar holds only the logo, the switch and the menu button.
  - Logged-out visitors keep the site menu (`Kuidas see töötab`, `Hind`, `Kontakt`), `Proovi tasuta` and the login button.
  - The server passes the header only the user's name, email and id (`HeaderUser`) and whether a PIN is set (`hasPin`), never the user document: it has the PIN hash (a 4-digit PIN is quickly found from it) and Stripe ids, and the header is on every page. In the browser `/api/users/me` fills it in; it has the PIN hash only for admins.
- In child mode, `/kodu`, `/boards/[id]` and `/connect-dots` render as fullscreen child surfaces without the global header/footer/admin bar (`isChildFullscreenPath` in `src/app/(frontend)/FrontendShell.tsx`). Any page a child can open from `/kodu` belongs on that list: the global header has the account menu (`Logi välja`) and links out of the child view.
- Child fullscreen surfaces must provide their own navigation and unlock controls when global chrome is hidden. Use `ChildModeBar` (`src/app/(frontend)/kodu/ChildModeBar.tsx`) as the first element under the page shell (outside `<main>`):
  - Left: the Kodu button, like a board cell: the logo's blue house tile (`LogoHouse` in a `LogoTile`) and the word, 56px tall. It sits in the same place on every child page; on `/kodu` it is the page's `<h1>`, marked as the current page (`current`).
  - Middle: the board's name (`title`), from the `sm` breakpoint.
  - Right: the same `Vanema vaade` button as the header (`ParentModeToggle`).
  - The bar is `sticky` with the page's opaque background, so pages don't leave top padding for it and a long board scrolls under the bar, not under floating buttons.
- Switching from parent mode to child mode may preserve safe child routes such as `/kodu`, `/boards/[id]` and `/connect-dots`, but must fall back to `/kodu` from parent-only or management routes.

## Change Checklist
- If cookie options change:
  - Re-test mode switching on desktop and mobile.
  - Re-test parent-only route redirect behavior.
- If PIN model changes:
  - Update user collection fields and profile flows consistently.
