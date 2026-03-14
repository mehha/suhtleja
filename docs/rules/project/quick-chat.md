---
title: Quick Chat Feature Rules
description: Rules for global-configured quick chat buttons and TTS playback
tags: [suhtleja, frontend, quick-chat, globals, tts]
---

# Quick Chat (`/quick-chat`)

## Scope
- Route: `src/app/(frontend)/quick-chat/page.tsx`
- UI and playback: `src/app/(frontend)/quick-chat/QuickChatBoard.tsx`
- Defaults: `src/app/(frontend)/quick-chat/quickChatData.ts`
- Global config: `src/QuickChat/config.ts`
- Payload registration: `src/payload.config.ts` (`globals`)

## Behavior Rules
- Auth is required for route access.
- Button source:
  - Prefer `quick-chat` global data from Payload.
  - Fallback to `DEFAULT_QUICK_CHAT_BUTTONS` if global read fails.
- Only `enabled !== false` buttons are shown.
- Clicking a button should:
  - Play the phrase through TTS endpoint.
  - Show busy state and block concurrent playback.
  - Show recoverable error state on failure.

## Content Rules
- Keep label and phrase simple and immediate.
- Keep color values within supported palette:
  - `emerald`, `rose`, `sky`, `amber`, `purple`, `indigo`, `slate`

## Change Checklist
- When changing global schema:
  - Keep frontend type (`QuickChatButton`) in sync.
  - Verify default fallback still renders valid buttons.
- When changing UI:
  - Preserve large touch targets and clear text hierarchy.
