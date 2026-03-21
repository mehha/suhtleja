# Repository Guidelines

Use this file as the quick-start for contributors. Keep deeper guidance in `docs/rules`.

## Documentation Strategy
- Yes, putting rules under `docs/rules` is the right approach for this repo.
- `AGENTS.md` should stay concise and point to rule files, not duplicate all details.
- Rule sets:
  - `docs/rules/payload-official/*`: external Payload patterns and security notes.
  - `docs/rules/project/*`: Suhtleja-specific implementation rules (source of truth for app behavior).
- When changing behavior in `src/app/(frontend)`, update the matching file in `docs/rules/project/`.

## Project Structure
- Frontend app routes: `src/app/(frontend)`.
- Payload admin/API routes: `src/app/(payload)`.
- Domain config: `src/collections`, `src/blocks`, `src/fields`, `src/payload.config.ts`.
- Shared UI/logic: `src/components`, `src/hooks`, `src/providers`, `src/utilities`.
- Tests: `tests/int/*.int.spec.ts` (Vitest), `tests/e2e/*.e2e.spec.ts` (Playwright).
- Runtime data/storage: Cloudflare D1 for Payload data, Cloudflare R2 for media/object storage.

## Frontend Feature Map
- `boards`: management hub `src/app/(frontend)/koduhaldus`, board play/edit routes `src/app/(frontend)/boards`, collection `src/collections/Boards/index.ts`, rule `docs/rules/project/boards.md`.
- `connect-dots`: player route `src/app/(frontend)/connect-dots`, collection `src/collections/ConnectDotsPuzzles/index.ts`, management surface `src/app/(frontend)/koduhaldus`, rule `docs/rules/project/connect-dots.md`.
- Parent/child mode shared flow: `src/app/(frontend)/kodu/ParentUnlockDialog.tsx`, `src/app/(frontend)/kodu/modeActions.ts`, `src/utilities/uiMode.ts`, rule `docs/rules/project/parent-child-mode.md`.
- Shared speech pattern (`/next/tts-ms`): `src/app/(frontend)/next/tts-ms/route.ts`, rule `docs/rules/project/audio-tts.md`.

## Common Extension Flows
- New block:
  - Add block config/component in `src/blocks/<BlockName>`.
  - Register in `src/collections/Pages/index.ts` and `src/blocks/RenderBlocks.tsx`.
  - Run `pnpm generate:types`.
- New collection:
  - Add `src/collections/<Name>/index.ts`.
  - Register in `src/payload.config.ts`.
  - Run `pnpm generate:types`.
- New frontend feature route:
  - Add route under `src/app/(frontend)/<feature>`.
  - Add/update project rule doc under `docs/rules/project/`.
  - Document data source (collection/global/static), auth gate, and side effects.

## Security and Data Integrity Baseline
- For Local API operations acting on behalf of a user, enforce access control explicitly (see `docs/rules/payload-official/security-critical.mdc`).
- In hooks, pass `req` to nested Payload operations to preserve transaction context.
- Keep `dynamic = 'force-dynamic'` on auth/cookie-dependent routes unless you intentionally redesign caching.

## Build and Test Commands
- `pnpm install` (Node 18.20+ or 20+, pnpm 9+).
- `pnpm dev` for local development.
- `pnpm lint` / `pnpm lint:fix`.
- `pnpm test:int`, `pnpm test:e2e`, `pnpm test`.
- `pnpm generate:types`, `pnpm generate:importmap`.

## Coding and PR Conventions
- TypeScript-first. Use `PascalCase` for components, `camelCase` for utilities/hooks.
- Prefer shadcn/ui components from `@/components/ui` when possible.
- If a needed shadcn component is missing locally, install it instead of building a duplicate custom primitive. Reference: `https://ui.shadcn.com/docs/components`.
- Keep diffs scoped and avoid unrelated refactors.
- Follow Conventional Commits.
- PRs should include: what changed, why, test evidence, and any schema/env impact.
