---
title: Feelings Feature Rules
description: Rules for feelings selection, playback, and persistence to user profile
tags: [suhtleja, frontend, feelings, users]
---

# Feelings (`/feelings`)

## Scope
- Route: `src/app/(frontend)/feelings/page.tsx`
- UI and playback: `src/app/(frontend)/feelings/FeelingsBoard.tsx`
- Server action: `src/app/(frontend)/feelings/actions.ts`
- Data options: `src/app/(frontend)/feelings/feelingsData.ts`
- User fields: `src/collections/Users/index.ts` (`lastFeeling`, `lastFeelingAt`)

## Behavior Rules
- Auth is required for route access.
- User flow for selecting a feeling:
  - Play TTS phrase.
  - Persist selected feeling and timestamp to current user.
  - Reflect new state in "last feeling" UI.
- Replay button should replay latest saved feeling phrase.

## Validation Rules
- Only values present in `FEELINGS` may be persisted.
- Server action must reject unknown values with a clear error.
- Save failures should return user-visible error state.

## Schema Rules
- Keep `Users` collection feeling options aligned with `FEELINGS` values.
- If adding/removing feelings:
  - Update `feelingsData.ts`
  - Update `Users` select options
  - Verify existing stored values still display gracefully

## Change Checklist
- When changing phrases or labels:
  - Validate spoken phrase and visible label still match intent.
- When changing server action:
  - Confirm user auth gate is preserved.
  - Confirm successful updates write both `lastFeeling` and `lastFeelingAt`.
