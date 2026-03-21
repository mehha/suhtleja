---
title: Parent Child Mode Rules
description: Rules for PIN unlock, uiMode cookie, and parent-only route gating
tags: [suhtleja, auth, mode, home, boards]
---

# Parent/Child Mode

## Scope
- Dialog UI: `src/app/(frontend)/home/ParentUnlockDialog.tsx`
- Actions: `src/app/(frontend)/home/modeActions.ts`
- Utilities: `src/utilities/uiMode.ts`
- Protected route example: `src/app/(frontend)/tegevused/page.tsx`
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
  - Route should redirect to `/home` if mode is not `parent`.

## PIN Rules
- PIN validation: exactly 4 digits.
- PIN is stored hashed in `users.parentPinHash`.
- Default hash at user creation comes from `DEFAULT_PARENT_PIN` (fallback `0000`).

## UX Rules
- Keep OTP auto-submit after 4 digits.
- On invalid PIN:
  - Clear fields.
  - Return focus to first OTP slot.
- Keep explicit error message for invalid/missing PIN.

## Change Checklist
- If cookie options change:
  - Re-test mode switching on desktop and mobile.
  - Re-test parent-only route redirect behavior.
- If PIN model changes:
  - Update user collection fields and profile flows consistently.
