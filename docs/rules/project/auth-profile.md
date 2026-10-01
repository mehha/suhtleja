---
title: Auth and Profile Rules
description: Login, register, and profile routes plus their auth gates
tags: [suhtleja, frontend, auth, profile, users]
---

# Auth and Profile (`/login`, `/register`, `/profile`)

## Scope
- Routes:
  - `src/app/(frontend)/login/page.tsx`
  - `src/app/(frontend)/register/page.tsx`
  - `src/app/(frontend)/profile/page.tsx`
  - `src/app/(frontend)/profile/actions.ts`
  - `src/app/(frontend)/profile/ProfilePageClient.tsx`
- Forms: `src/components/Auth/login-form.tsx`, `src/components/Auth/register-form.tsx`
- Collection: `src/collections/Users/index.ts`
- Helper: `src/utilities/getCurrentUser.ts`

## Data Source and Auth Gate
- Data source: Payload `users` collection (cookie-based Payload auth, token expires after 1 day).
- `/login` and `/register` are public, client-side forms and are `noindex, nofollow`.
  - Login posts to Payload `POST /api/users/login`, then `router.push('/kodu')`.
  - Register posts to `POST /api/users`, then logs in via `/api/users/login`, then goes to `/kodu`.
  - If account creation succeeds but the follow-up login fails, show a message asking the user to log in manually.
- `/profile` requires a logged-in user. Unauthenticated requests redirect to `/admin`.
- `/profile` keeps `dynamic = 'force-dynamic'` because it depends on cookies.

## Behavior Rules
- Profile shows user name, email, parent PIN controls, and membership state (see `membership.md` for Stripe flow).
- `?membership=required` on `/profile` shows a "membership required" notice; premium routes and APIs redirect or respond here when `hasActiveMembership` fails.
- Parent PIN:
  - Must be exactly 4 digits (`updatePinAction`), stored only as a bcrypt hash in `users.parentPinHash`.
  - New users get a hash of `DEFAULT_PARENT_PIN` (fallback `0000`) from the `Users` `beforeChange` hook.
  - `clearPinAction` removes the hash and resets the `uiMode` cookie to `child`.
  - Full unlock/lock behavior lives in `parent-child-mode.md`.

## Side Effects
- `updatePinAction` / `clearPinAction` call `payload.update` on the current user and write `pinUpdatedAt`.
- `clearPinAction` sets the `uiMode` cookie (httpOnly, `sameSite: lax`, 1 day, `secure` in production).

## Change Checklist
- Server actions must resolve the user via `getCurrentUser()` and update only that user's document.
- Keep user-facing copy in Estonian.
- If user fields change, run `pnpm generate:types` and note required D1 migrations for the owner.
