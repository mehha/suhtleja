# Project Rules Index

Use these files for Verba-specific behavior and implementation rules.

- `docs/rules/project/boards.md`
  - Board ownership, pinning, ordering, and home integration.
- `docs/rules/project/connect-dots.md`
  - Puzzle structure and connect-in-order interaction rules.
- `docs/rules/project/feelings.md`
  - Feeling selection, TTS flow, and user persistence contract.
- `docs/rules/project/quick-chat.md`
  - Global-driven quick chat buttons and fallback behavior.
- `docs/rules/project/parent-child-mode.md`
  - PIN unlock flow, `uiMode` cookie, and parent-route guards.
- `docs/rules/project/audio-tts.md`
  - Shared TTS endpoint and playback expectations.
- `docs/rules/project/ui-components.md`
  - Prefer `@/components/ui` (shadcn/ui) components and install missing ones from the shadcn catalog.
- `docs/rules/project/tools.md`
  - `/tools` hub visibility is managed via Payload global toggles.

When adding a new route under `src/app/(frontend)`, add a matching rule file here.
