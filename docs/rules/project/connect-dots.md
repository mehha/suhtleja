---
title: Connect Dots Feature Rules
description: Rules for puzzle data and interaction behavior in connect-dots
tags: [verba, frontend, game, connect-dots]
---

# Connect Dots (`/connect-dots`)

## Scope
- Route: `src/app/(frontend)/connect-dots/page.tsx`
- Board rendering: `src/app/(frontend)/connect-dots/ConnectDotsBoard.tsx`
- Puzzle selector: `src/app/(frontend)/connect-dots/ConnectDotsPlayground.tsx`
- Data: `src/app/(frontend)/connect-dots/puzzles.ts`

## Behavior Rules
- Auth is required for route access.
- Puzzle points are selected in strict order only.
- Wrong point taps/clicks must be ignored (no progress, no error modal).
- Available controls:
  - Reset (`Alusta uuesti`)
  - Undo last segment (`Samm tagasi`)
- Completion criteria:
  - Puzzle is complete only when visited points length equals total points length.

## Data Rules
- Every puzzle must define:
  - `id`, `name`, `width`, `height`, `points[]`
- Point IDs must be sequential in intended play order.
- Keep coordinates inside puzzle bounds (`0..width`, `0..height`) for predictable scaling.

## Change Checklist
- When adding a puzzle:
  - Validate tap order from first to last point.
  - Validate resize behavior on mobile and desktop.
- When changing board rendering:
  - Keep both pointer and touch interactions working.
  - Keep visual distinction for visited vs next vs remaining points.
