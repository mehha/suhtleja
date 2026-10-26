---
title: Feedback Toasts
description: When user actions show a Sonner toast, and the two ways to show one
tags: [suhtleja, frontend, ui, sonner]
---

# Feedback Toasts

## Scope
- Toaster: `src/components/ui/sonner.tsx`, mounted once in `src/app/(frontend)/layout.tsx` (light theme, bottom center, rich colors).
- Toasts after a redirect: `src/utilities/flashToast.ts` (`FLASH_TOASTS`, `withToast`, `ActionResult`) and `src/components/FlashToast.tsx`.
- Don't mount another `<Toaster />` on frontend pages: every mounted Toaster shows every toast, so a second one shows each toast twice. The Payload admin field `src/components/ConnectDots/ConnectDotsEditorField.tsx` keeps its own, because the frontend layout isn't there.

## When to Toast
- Success: only when the result isn't visible where the user is looking, or the page navigates: deleted, added to or removed from home, shared, saved, PIN removed, back from Stripe Checkout.
- No success toast when the change is visible anyway: drag reorder, rename, parent/child switch, the inline "Nimi salvestatud." / "PIN salvestatud.".
- Errors: a failed user action always toasts, with a retry hint. It must not fall through to the error page or fail silently.
- Messages that belong to a field (wrong PIN, missing name, login and registration errors) stay inline next to the field.
- Child view (`/kodu` in child mode, the board player, the game): no success toasts. The only toast is the speech error in `Runner.tsx` ("Heli ei õnnestunud. Puuduta uuesti.", id `tts`), so a tap that made no sound isn't silent.
- Copy is Estonian and short. Users see "tahvel" and "mäng", never "puzzle" or "Connect Dots".

## How
- Server action that redirects (pattern A): redirect to `withToast(path, key)` with a key from `FLASH_TOASTS`. Keep auth and membership redirects outside the try block, put the Payload calls in try/catch, and call `redirect()` after it so `NEXT_REDIRECT` isn't caught. On failure redirect with the `error` key.
- Server action that stays on the page (pattern B): return `ActionResult` (`{ ok: true }` or `{ ok: false, error }`); the client form handler calls `toast.success` or `toast.error`. Use this when a redirect would lose what the user entered (the game editor keeps its dots).
- Client-only work (fetches, uploads, a server action in `startTransition`): call `toast.*` directly. Catch errors inside the transition, because an error thrown there reaches the error page.
- `FlashToast` also turns Stripe's `?membership=success` / `?membership=cancel` into a toast. It removes the params it handled; `membership=required` stays for the profile page.
- Give a toast an `id` when the same event can repeat quickly (repeated taps, the dev-mode double effect).
