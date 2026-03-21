---
title: Boards Feature Rules
description: Rules for board management, pinning, ownership, and ordering
tags: [suhtleja, frontend, boards, payload]
---

# Boards (`/tegevused`, `/boards/[id]`, and `/home`)

## Scope
- Route UI: `src/app/(frontend)/tegevused/page.tsx`, shared management UI in `src/app/(frontend)/boards/*`
- Home pinned listing and ordering: `src/app/(frontend)/home/*`
- Collection: `src/collections/Boards/index.ts`
- Related managed game collection: `src/collections/ConnectDotsPuzzles/index.ts`

## Behavior Rules
- Access model:
  - Auth required for boards routes.
  - Parent mode is required for `/tegevused` management route.
  - Owner/admin boundaries must be preserved.
  - Server actions that modify a board must enforce document-level permissions.
  - `/tegevused` is also the parent-mode management surface for connect-dots puzzles.
- Board fields:
  - `name` is required.
  - `owner` is relationship to `users` and should default to current user on create.
  - `pinned` controls visibility on `/home`.
  - `visibleToAllUsers` allows admins to expose a board to every authenticated user without transferring ownership.
  - `order` controls pinned ordering.
  - `ttsCache` stores pregenerated speech metadata for saved cell labels and saved compound speech forms.
- Board cell editor rules:
  - In image selection flow, `Sümbolid` is the default first tab when opening the cell modal.
  - Choosing an image source (`Sümbolid`, upload, media) must not clear the current `Tekst` input before the user presses save.
  - In `/boards/[id]/edit`, if there are unsaved changes, leaving the page must require explicit confirmation.
  - The unsaved-changes guard must apply to both anchor navigation and forms marked with `data-navigation-form` (e.g. parent/child mode switch flows).
  - Saving board grid changes must regenerate missing cached TTS audio for current cell labels.
  - Saving compounds must regenerate missing cached TTS audio for compound speech forms.
- Home page rules:
  - Show board content and connect-dots content in separate top-level sections.
  - Within each top-level section, owned items and shared items may render as separate subsections.
  - Owned items use document-level `pinned` and `order`.
  - Shared items (`visibleToAllUsers`) are shown on `/home` by default for every user unless that user hides them.
  - Shared item hide/show and order are stored per user, not on the shared document itself.
  - Reordering is parent-mode only within each rendered subsection.
  - Parent mode must expose both actions on `/home`: `Lisa uus tahvel` and `Halda tegevusi`.
- Boards management rules:
  - `/tegevused` must include a separate connect-dots puzzles table.
  - Non-admin users must see their own rows plus rows shared via `visibleToAllUsers`.
  - The puzzles table must indicate that rows are connect-dots games.
  - Shared rows in `/tegevused` must expose personal `Koduvaade` hide/show controls without granting edit/delete rights.
  - Owned rows in `/tegevused` must keep document-level home pin/unpin controls.

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
