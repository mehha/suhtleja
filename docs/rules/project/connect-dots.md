---
title: Connect Dots Feature Rules
description: Rules for puzzle authoring and play behavior in connect-dots
tags: [suhtleja, frontend, game, connect-dots, payload]
---

# Connect Dots (`/connect-dots`)

## Scope
- Frontend route: `src/app/(frontend)/connect-dots/page.tsx`
- Frontend editor routes:
  - `src/app/(frontend)/connect-dots/manage/new/page.tsx`
  - `src/app/(frontend)/connect-dots/manage/[id]/page.tsx`
- Frontend management listing: `src/app/(frontend)/koduhaldus/page.tsx`
- Shared gameplay UI: `src/components/ConnectDots/ConnectDotsGame.tsx`
- Frontend editor UI:
  - `src/components/ConnectDots/ConnectDotsFrontendEditor.tsx`
- Payload collection: `src/collections/ConnectDotsPuzzles/index.ts`
- Admin editor + preview: `src/components/ConnectDots/ConnectDotsEditorField.tsx`
- Shared rules / serialization: `src/utilities/connectDots.ts`
- Shared frontend form parsing: `src/utilities/connectDotsPuzzleForm.ts`

## Behavior Rules
- Auth and active membership are required for `/connect-dots`.
- Parent mode is required for all frontend create/edit/delete puzzle flows.
- Frontend shows only puzzles with `enabled = true`.
- Non-admin users should see:
  - their own enabled puzzles
  - enabled puzzles where `visibleToAllUsers = true`
- Admin users may see all enabled puzzles regardless of owner or share state.
- Frontend management list should show:
  - admins: all puzzles
  - non-admin users: their own puzzles plus puzzles where `visibleToAllUsers = true`
- Frontend management listing lives under `/koduhaldus`, not its own dedicated list route.
- Non-admin users may create puzzles for themselves and edit/delete only their own puzzles.
- Only admins may mark a puzzle `visibleToAllUsers = true`.
- In frontend create/edit routes, the save action must stay disabled until the form differs from its initial state.
- In frontend create/edit routes, leaving with unsaved changes must require explicit confirmation.
- A puzzle is playable only when it has:
  - an uploaded image
  - at least 2 valid dots
- Wrong dot selections must be ignored.
- Supported play styles:
  - click the next dot
  - trace/drag from the current dot to the next dot
- Supported label modes:
  - `Count by 1's`
  - `Count by 2's`
  - `Count by 3's`
  - `Count by 4's`
  - `Count by 5's`
  - `ABC's`
- The image must become more visible as progress increases and be fully visible when the puzzle is complete.
- Frontend uses `/soft-dots-journey.mp3` as the default looping background music.
- A puzzle may optionally override that default with its own Payload media background track.
- Frontend music must start only after a real child interaction on the game area, not on page load.
- Frontend music must have a visible icon-only mute/unmute control overlaid on the game image in the top-right corner.
- When a puzzle is completed, the looping background music must stop and `/great-success-borat.mp3` must play once for the celebration.

## Data Rules
- Dots are stored as normalized coordinates (`0..1`) relative to the image.
- Dot order is defined by array position only.
- Puzzle images can come from either:
  - uploaded Payload media
  - external symbol URLs from the shared symbols endpoint
- Background music is stored as optional Payload media on the puzzle document.
- Each puzzle has an `owner` relationship to `users`.
- Owned puzzles use document-level `/kodu` visibility via `pinned` plus ordering via `order`.
- Shared puzzles (`visibleToAllUsers`) use per-user hide/show and per-user order on `/kodu`.
- `visibleToAllUsers` controls whether an enabled puzzle is shared beyond its owner.
- Frontend create/update parsing must reject submissions without:
  - a title
  - a valid image source
  - at least 2 valid dots
- If no puzzle-specific track is set, serialization must fall back to `/soft-dots-journey.mp3`.
- Dot validation must reject:
  - non-array values
  - fewer than 2 dots
  - invalid or out-of-bounds coordinates
- Admin editing happens inline in Payload; the stored `dots` field remains hidden and is controlled by the visual editor.

## Change Checklist
- When changing the admin editor:
  - keep add, drag, reorder, delete, and preview flows working
  - keep unsaved form state reflected in the preview
- When changing the player:
  - keep click and trace interactions working on desktop and touch
  - keep label-mode switching independent from the underlying path
  - keep the image reveal tied to progress, not just final completion
  - keep music playback user-gesture-gated and stoppable via mute
- When changing data access:
  - keep frontend queries filtered to enabled puzzles
  - keep owner/private-vs-shared visibility rules intact
  - keep frontend route gating unchanged unless intentionally redesigned
- When changing frontend authoring:
  - keep parent-mode enforcement on list/create/edit/delete routes
  - keep non-admin users from changing global visibility
  - keep owner assignment server-side on create
