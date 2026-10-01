---
title: Boards Feature Rules
description: Rules for board management, pinning, ownership, and ordering
tags: [suhtleja, frontend, boards, payload]
---

# Boards (`/koduhaldus`, `/boards/[id]`, and `/kodu`)

## Scope
- Route UI: `src/app/(frontend)/koduhaldus/page.tsx`, shared management UI in `src/app/(frontend)/boards/*`
- Home pinned listing and ordering: `src/app/(frontend)/kodu/*`
- Collection: `src/collections/Boards/index.ts`
- Related managed game collection: `src/collections/ConnectDotsPuzzles/index.ts`

## Behavior Rules
- `/tegevused` is a legacy alias and only redirects to `/koduhaldus`. Keep it for existing links; do not add logic there.
- Access model:
  - Auth required for boards routes.
  - Parent mode is required for `/koduhaldus` management route.
  - Owner/admin boundaries must be preserved.
  - Board content editing (layout, cells, compounds) is owner-only.
  - Admin may view all boards but must not edit another user's board content.
  - Admin may still manage board-level shared visibility as a moderation/oversight action.
  - Server actions that modify a board must enforce document-level permissions.
  - `/koduhaldus` is also the parent-mode management surface for connect-dots puzzles.
- Board fields:
  - `name` is required.
  - `owner` is relationship to `users` and should default to current user on create.
  - `pinned` controls visibility on `/kodu`.
  - `visibleToAllUsers` allows admins to expose a board to every authenticated user without transferring ownership.
  - `order` controls pinned ordering.
  - `ttsCache` stores pregenerated speech metadata for saved cell labels and saved compound speech forms.
- Board cell editor rules:
  - In image selection flow, `Sümbolid` is the default first tab when opening the cell modal.
  - Choosing an image source (`Sümbolid`, upload, media) must not clear the current `Tekst` input before the user presses save.
  - The `Meedia` tab in the cell editor must show only image media that has been assigned to a Payload folder.
  - In `/boards/[id]/edit`, if there are unsaved changes, leaving the page must require explicit confirmation.
  - The unsaved-changes guard must apply to both anchor navigation and forms marked with `data-navigation-form` (e.g. parent/child mode switch flows).
  - `Lisa plokk` text-based bulk add must support both one-line-per-card input and sentence paste with an editable split preview.
  - In bulk add, if a matching image already exists in local `media`, prefer that image before falling back to ARASAAC.
  - In bulk add, if the direct local/ARASAAC lookup finds no image, use `/next/groq` to generate a small ordered set of English ARASAAC search terms and try each term until the first image is found.
  - When bulk add finds images through Groq-generated ARASAAC terms, show a Sonner info toast listing the original text and matched English search term.
  - The `Lisa plokk` dialog must stay within the viewport and scroll internally when the form or sentence preview is long.
  - Explicit board saves must show visible progress while the save request is in flight.
  - Saving board grid changes must regenerate missing cached TTS audio for current cell labels.
  - Saving compounds must regenerate missing cached TTS audio for compound speech forms.
  - In `/boards/[id]/edit`, editor grid row height should track the column width so 1x1 editable cells render as square tiles.
  - In `/boards/[id]/edit`, mobile layouts should start at 3 columns and increase at wider breakpoints.
- Home page rules:
  - Show board content and connect-dots content in separate top-level sections.
  - Within each top-level section, owned items and shared items may render as separate subsections.
  - Owned items use document-level `pinned` and `order`.
  - Shared items (`visibleToAllUsers`) are shown on `/kodu` by default for every user unless that user hides them.
  - Shared item hide/show and order are stored per user, not on the shared document itself.
  - Reordering is parent-mode only within each rendered subsection.
  - Parent mode must expose both actions on `/kodu`: `Lisa uus tahvel` and `Halda koduhaldust`.
- Board runner rules:
  - On `/boards/[id]`, `sm` and `xs` layouts must render 3 items per row when the board has at least 3 columns, then increase at wider breakpoints.
  - On `/boards/[id]`, board runner grid row height should track the active column width so 1x1 board items render as square tiles.
  - Board card labels should sit below the image without a background overlay, use black uppercase text, and leave enough card space so images and labels do not overlap.
  - AAC board runner tiles should have high-visibility hover/press affordances: clear border/ring contrast, obvious lift on pointer hover, and a readable pressed state without adding extra hover box shadow.
  - The board runner action bar should stay fixed at the bottom of the viewport, remain compact enough for child-mode play, and leave bottom padding so board tiles are not hidden behind it.
  - In child mode, `/boards/[id]` must include minimal in-page controls for returning to `/kodu` and opening the parent PIN dialog because global header navigation is hidden.
- Boards management rules:
  - `/koduhaldus` must include a separate connect-dots puzzles table.
  - Non-admin users must see their own rows plus rows shared via `visibleToAllUsers`.
  - The puzzles table must indicate that rows are connect-dots games.
  - Shared rows in `/koduhaldus` must expose personal `Koduvaade` hide/show controls without granting edit/delete rights.
  - Owned rows in `/koduhaldus` must keep document-level home pin/unpin controls.
  - On the boards table, edit/delete actions are owner-only.
  - Admin visibility moderation must be available separately from content editing.

## Change Checklist
- When changing board schema in `src/collections/Boards/index.ts`:
  - Verify board create, edit, pin, unpin, reorder still work.
  - Run `pnpm generate:types`.
- When changing board server actions:
  - Re-check auth and ownership constraints.
  - Re-check Local API access enforcement when acting on behalf of user.
  - Re-check redirects for unauthenticated users.
- When changing card UI on `/kodu`:
  - Keep keyboard navigation and drag behavior usable.
  - Validate image fallback behavior for missing board visuals.
  - Use responsive grid columns for the home card lists rather than fixed card widths so mobile can render one column and wider screens can expand naturally.
