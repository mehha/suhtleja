---
title: Tools Hub Rules
description: Rules for /tools visibility and editor-managed tool toggles
tags: [verba, frontend, tools, globals]
---

# Tools Hub (`/tools`)

## Scope
- Route: `src/app/(frontend)/tools/page.tsx`
- Editor config global: `src/Tools/config.ts`
- Payload registration: `src/payload.config.ts` (`globals`)

## Behavior Rules
- Auth is required for route access.
- Tool cards on `/tools` are controlled by Payload global `tools`.
- If global read fails, fallback to built-in defaults so UI remains usable.

## Editor Rules
- Admins manage visibility via `tools` global array (`items`).
- `enabled=false` hides tool from `/tools`.
- Slug values in global must match frontend route slugs.

## Change Checklist
- When adding a new tool route:
  - Add card metadata in `src/app/(frontend)/tools/page.tsx`.
  - Add matching select option in `src/Tools/config.ts`.
  - Keep default visibility intentional (`enabled` true/false).
