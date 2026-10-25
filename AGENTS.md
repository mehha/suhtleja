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
- `membership`: Stripe routes `src/app/(frontend)/next/stripe`, helper `src/utilities/membershipStatus.ts`, rule `docs/rules/project/membership.md`.
- `auth/profile`: `src/app/(frontend)/login`, `register`, `profile`, rule `docs/rules/project/auth-profile.md`.
- `symbols/AI helpers`: `src/app/(frontend)/next/{symbols,symbol-image,groq}`, rule `docs/rules/project/symbols-ai.md`.
- `search`: `src/app/(frontend)/search`, `src/search`, rule `docs/rules/project/search.md`.
- `homepage`: block `src/blocks/SuhtlejaHomepage`, rule `docs/rules/project/homepage.md`.
- `content pages`: page route `src/app/(frontend)/[slug]`, blocks `src/blocks/HowItWorks`, `src/blocks/Contact`, rule `docs/rules/project/content-pages.md`.
- `media`: collection `src/collections/Media.ts`, rule `docs/rules/project/media.md`.
- `preview`: `src/app/(frontend)/next/preview`, `exit-preview`, `src/utilities/generatePreviewPath.ts`, rule `docs/rules/project/preview.md`.
- `seo`: metadata utilities `src/utilities/seo.ts`, `generateMeta.ts`, rule `docs/rules/project/seo.md`.
- `analytics`: Cloudflare Web Analytics (injected by Cloudflare, no repo code), sign-up funnel panel `src/components/MembershipFunnel` (admin dashboard), rule `docs/rules/project/analytics.md`.
- Route naming is Estonian: `kodu` = child home, `koduhaldus` = parent management, `tegevused` = legacy redirect to `koduhaldus`.

## Common Extension Flows
- New block:
  - Add block config/component in `src/blocks/<BlockName>`.
  - Register in `src/collections/Pages/index.ts` and `src/blocks/RenderBlocks.tsx`.
  - Run `pnpm generate:types`, then `pnpm payload migrate:create <name>` and `pnpm migrate`.
- New collection:
  - Add `src/collections/<Name>/index.ts`.
  - Register in `src/payload.config.ts`.
  - Run `pnpm generate:types`, then `pnpm payload migrate:create <name>` and `pnpm migrate`.
- New frontend feature route:
  - Add route under `src/app/(frontend)/<feature>`.
  - Add/update project rule doc under `docs/rules/project/`.
  - Document data source (collection/global/static), auth gate, and side effects.

## Security and Data Integrity Baseline
- For Local API operations acting on behalf of a user, enforce access control explicitly (see `docs/rules/payload-official/security-critical.mdc`).
- Customers can register, so every customer is a logged-in Payload user. Never use `authenticated` or default access for content writes or for reading other users; see `docs/rules/project/access-control.md`.
- In hooks, pass `req` to nested Payload operations to preserve transaction context.
- Keep `dynamic = 'force-dynamic'` on auth/cookie-dependent routes unless you intentionally redesign caching.
- Production D1 migrations run in deploy: `pnpm deploy` (and the GitHub Actions deploy on push to `master`) runs `deploy:database` (`payload migrate` + `PRAGMA optimize`) before deploying the app. `push: false` stays, so every schema change needs a committed Payload migration.
- Local migrations: after a schema change (collection, field or block config), agents run `pnpm payload migrate:create <name>` and then `pnpm migrate` themselves, without asking. Review the generated migration before committing it; it must contain only the intended changes. These commands use the local D1. Agents must not run `migrate:remote`, `deploy:database`, `pnpm deploy` or any command with `NODE_ENV=production` unless explicitly authorized.
- Before applying a generated migration, look for table rebuilds: a `__new_<table>` that is filled from the old table, which is then dropped and renamed. Drizzle does this for changes SQLite can't make in place, such as a new column default or dropping a column with a foreign key. On D1, `PRAGMA foreign_keys=OFF` has no effect, so dropping the old table cascade-deletes rows in its child tables (arrays, blocks and their versions), and the copy fills columns new in that migration with their own names as text. Write those migrations by hand with `ALTER TABLE ... ADD` and `CREATE TABLE` instead (example: `src/migrations/20261025_094741_homepage_sections.ts`).
- The deploy workflow runs `tsc --noEmit`, `pnpm test:int` and the member flow test before any migration. `tests/int/migrations.int.spec.ts` fails when a migration's `up()` rebuilds a table, so a generated rebuild can't reach production unnoticed.
- `payload` is patched (`patches/payload@3.92.0.patch`, password hashing on Workers). When upgrading Payload, follow the README's Payload 3.90.0 upgrade notes to drop or recreate the patch.

## Build and Test Commands
- `pnpm install` (Node 22.23.4+ or 24.22.1+, pnpm 9 or 10).
- `pnpm dev` for local development.
- `pnpm lint` / `pnpm lint:fix`.
- `pnpm test:int`, `pnpm test:e2e`, `pnpm test`.
- `pnpm test:e2e` runs against `pnpm dev` by default:
  - Smoke tests (`tests/e2e/smoke.e2e.spec.ts`) only read public pages. `SMOKE_BASE_URL=https://suhtleja.ee pnpm test:e2e` runs them against a deployed site. CI runs them against production after every deploy.
  - The member flow test (`tests/e2e/member-flow.e2e.spec.ts`) registers an account, starts a trial with a signed Stripe webhook event, unlocks the parent view with a PIN, puts a board on the child home and checks that it speaks. It needs the server's `STRIPE_WEBHOOK_SECRET` (read from the same `.env*` files) and skips itself against a deployed site. The global teardown deletes the `e2e-*@suhtleja.test` accounts it creates. CI runs it before deploying, on a throwaway local D1.
- `pnpm generate:types`, `pnpm generate:importmap`.

## Coding and PR Conventions
- TypeScript-first. Use `PascalCase` for components, `camelCase` for utilities/hooks.
- Prefer shadcn/ui components from `@/components/ui` when possible.
- If a needed shadcn component is missing locally, install it instead of building a duplicate custom primitive. Reference: `https://ui.shadcn.com/docs/components`.
- Keep diffs scoped and avoid unrelated refactors.
- Follow Conventional Commits.
- PRs should include: what changed, why, test evidence, and any schema/env impact.
