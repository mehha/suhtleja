# Project Rules Index

Use these files for Suhtleja-specific behavior and implementation rules.

Infrastructure baseline:
- Payload data runs on Cloudflare D1.
- Uploaded media/object storage runs on Cloudflare R2.

- `docs/rules/project/boards.md`
  - Board ownership, pinning, ordering, and home integration.
- `docs/rules/project/connect-dots.md`
  - Puzzle structure and connect-in-order interaction rules.
- `docs/rules/project/parent-child-mode.md`
  - PIN unlock flow, `uiMode` cookie, and parent-route guards.
- `docs/rules/project/audio-tts.md`
  - Shared TTS endpoint and playback expectations.
- `docs/rules/project/ui-components.md`
  - Prefer `@/components/ui` (shadcn/ui) components and install missing ones from the shadcn catalog.
- `docs/rules/project/membership.md`
  - Stripe checkout + webhook-based membership flow.
- `docs/rules/project/seo.md`
  - Frontend metadata, canonical URLs, Open Graph defaults, and noindex rules.
- `docs/rules/project/homepage.md`
  - Editable `suhtlejaHomepage` block, section toggles, and video/media slots.
- `docs/rules/project/media.md`
  - Media ownership, public read, and owner/admin update/delete rules.
- `docs/rules/project/auth-profile.md`
  - `/login`, `/register`, `/profile`, and parent PIN management.
- `docs/rules/project/search.md`
  - `/search` route and Payload search plugin sync.
- `docs/rules/project/symbols-ai.md`
  - `/next/symbols`, `/next/symbol-image`, `/next/groq`, `/next/pexels` helper endpoints.

When adding a new route under `src/app/(frontend)`, add a matching rule file here.
