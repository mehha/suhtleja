---
title: Boards Feature Rules
description: Rules for board management, pinning, ownership, and ordering
tags: [suhtleja, frontend, boards, payload]
---

# Boards (`/boards` and `/home`)

## Scope
- Route UI: `src/app/(frontend)/boards/*`
- Home pinned listing and ordering: `src/app/(frontend)/home/*`
- Collection: `src/collections/Boards/index.ts`

## Behavior Rules
- Access model:
  - Auth required for boards routes.
  - Parent mode is required for `/boards` management route.
  - Owner/admin boundaries must be preserved.
  - Server actions that modify a board must enforce document-level permissions.
- Board fields:
  - `name` is required.
  - `owner` is relationship to `users` and should default to current user on create.
  - `pinned` controls visibility on `/home`.
  - `order` controls pinned ordering.
- Board cell editor rules:
  - In image selection flow, `Sümbolid` is the default first tab when opening the cell modal.
  - Choosing an image source (`Sümbolid`, upload, media) must not clear the current `Tekst` input before the user presses save.
  - In `/boards/[id]/edit`, if there are unsaved changes, leaving the page must require explicit confirmation.
  - The unsaved-changes guard must apply to both anchor navigation and forms marked with `data-navigation-form` (e.g. parent/child mode switch flows).
- Home page rules:
  - Show only pinned boards.
  - Sort by `order`.
  - Reordering is parent-mode only.
  - Parent mode must expose both actions on `/home`: `Lisa uus tahvel` and `Halda tahvleid`.

## Change Checklist
- When changing board schema in `src/collections/Boards/index.ts`:
  - Verify board create, edit, pin, unpin, reorder still work.
  - Run `pnpm generate:types`.
- When changing board server actions:
  - Re-check auth and ownership constraints.
  - Re-check Local API access enforcement when acting on behalf of user.
  - Re-check redirects for unauthenticated users.
- When changing card UI on `/home`:
  - Keep keyboard navigation and drag behavior usable.
  - Validate image fallback behavior for missing board visuals.
