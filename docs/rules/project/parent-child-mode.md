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
- Never rely on hiding a page or link in child mode: the server action or route must check the mode itself (`/profile` is reachable in child mode by typing the address).

## UX Rules
- Keep OTP auto-submit after 4 digits.
- Parent unlock should submit through the controlled client handler, not programmatic native form submission, so mobile Safari stays on the client navigation path.
- On invalid PIN:
  - Clear fields.
  - Return focus to first OTP slot.
- Keep explicit error message for invalid/missing PIN.
- Header parent/child switcher should stay icon-only visually, with accessible names preserved for assistive tech.
- Logged-in header controls should include an icon-only home link before the parent/child switcher; `/home` is a redirect alias for `/kodu`.
- In child mode, `/kodu`, `/boards/[id]` and `/connect-dots` render as fullscreen child surfaces without the global header/footer/admin bar (`isChildFullscreenPath` in `src/app/(frontend)/FrontendShell.tsx`). Any page a child can open from `/kodu` belongs on that list: the global header has the account menu (`Logi välja`) and links out of the child view.
- Child fullscreen surfaces must provide their own minimal navigation or unlock controls when global chrome is hidden. Use `ChildModeBar` (`src/app/(frontend)/kodu/ChildModeBar.tsx`: home + parent PIN dialog) and leave top padding for it.
- Switching from parent mode to child mode may preserve safe child routes such as `/kodu`, `/boards/[id]` and `/connect-dots`, but must fall back to `/kodu` from parent-only or management routes.

## Change Checklist
- If cookie options change:
  - Re-test mode switching on desktop and mobile.
  - Re-test parent-only route redirect behavior.
- If PIN model changes:
  - Update user collection fields and profile flows consistently.
