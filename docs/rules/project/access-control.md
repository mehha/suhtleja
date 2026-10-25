---
title: Access Control Rules
description: Who may read and write each collection and global through the Payload API
tags: [suhtleja, security, access, payload]
---

# Access Control

## Why this matters
- Anyone can register (`users.create` is public), so every customer is a logged-in Payload user.
- The Payload website template assumed every user is an editor and used `authenticated` for writes. Here that would let any customer edit pages, read other users or make themselves admin.
- Never use `authenticated` (or rely on Payload's default access, which is "logged in") for content writes or for reading other users' data.

## Helpers (`src/access`)
- `isAdmin`: collection/global access, true only for `role: 'admin'`.
- `isAdminFieldLevel`: field-level version of `isAdmin`.
- `isAdminOrSelf`: users collection; admins see everyone, others get a `where` limited to their own id.
- `isAdminOrPublished`: admins read drafts; everyone else only `_status: published`.
- `isAdminOrOwner`: owner-based collections that also require an active membership.

## Rules
- Users: `create` public, `read`/`update` via `isAdminOrSelf`, `delete` admin only, admin panel admin only.
- User fields `role`, `parentPinHash`, `pinUpdatedAt`, `stripeCustomerId`, `stripeSubscriptionId`, `membershipStatus`, `trialEndsAt`, `currentPeriodEndsAt` and `membershipCancelAtPeriodEnd` are admin-only for create and update. Sign-up therefore always creates `role: 'user'` with `membershipStatus: 'none'`.
- Server code writes these fields with the Local API, which skips access checks by default (`overrideAccess: true`): the Stripe checkout and webhook routes, profile PIN actions and home preference actions. Only pass a `user` with `overrideAccess: false` when you deliberately want access rules applied.
- Pages, Posts, Categories: writes admin only. Pages and Posts drafts are admin only (`isAdminOrPublished`).
- Header and Footer globals: `update` admin only.
- Plugin collections set in `src/plugins/index.ts`: redirects, forms and search writes are admin only; form submissions stay publicly creatable but only admins can read or delete them.
- Payload jobs (`jobs.access.run`): admins or the `CRON_SECRET` bearer token.
- Owner-based collections (boards, connect-dots puzzles, media) keep their owner checks.
- Boards and connect-dots puzzles: the `owner` and `visibleToAllUsers` fields are admin-only for create and update (`isAdminFieldLevel`). A customer's value is dropped, so new documents always belong to the customer and stay private. Media blocks owner changes with field access and forces the owner on create in a hook.

## Tests
- `tests/int/access-control.int.spec.ts` checks these rules through the Local API with `overrideAccess: false`, as a visitor, a customer with and without a membership, and an admin. It creates its own users and documents and deletes them afterwards. Add a case whenever a rule here changes.

## Change Checklist
- New collection or global: set every access operation explicitly; don't rely on defaults.
- New plugin that adds collections: override its write access with `isAdmin`.
- After access changes, run `pnpm test:int` and extend `tests/int/access-control.int.spec.ts` for the new rule.
