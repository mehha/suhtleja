---
title: Media Access Rules
description: Rules for uploaded media ownership, visibility, and destructive access
tags: [suhtleja, media, payload, access-control]
---

# Media (`media`)

## Scope
- Collection: `src/collections/Media.ts`
- Public REST/API route: `src/app/(payload)/api/[...slug]/route.ts`
- Used by boards, connect-dots puzzles, pages, and uploaded image/audio fields.
- File storage: R2 through `r2Storage` in `src/plugins/index.ts`; file URLs come from `src/utilities/mediaURL.ts`.

## File URLs
- Production: files are served by R2 on the public media domain (`NEXT_PUBLIC_MEDIA_BASE_URL`, default `https://media.suhtleja.ee`), not through the Worker. Payload's own `/api/media/file` route is off (`disablePayloadAccessControl: true`).
- Outside production, uploads go to the local R2 bucket in `.wrangler/state`, which the public domain doesn't have. Media URLs point to `/next/dev-media/<key>` (`src/app/(frontend)/next/dev-media/[...path]/route.ts`), which serves the local file, or fetches it from the public domain when only production has it (media copied from production). The route answers 404 in production.
- Media file URLs skip Next's image optimizer in `ImageMedia` (`isMediaFileURL`).

## Behavior Rules
- Uploaded media remains publicly readable because page, board, and puzzle surfaces need to render images and audio without document-specific media auth checks.
- Auth is required to upload media.
- Each new authenticated upload must get an `owner` relationship to the current user.
- Non-admin users may update/delete only media they own.
- Admin users may update/delete all media, including legacy media rows where `owner` is still empty.
- Non-admin users must not be able to transfer media ownership to another user.
- Non-admin users must not be able to put media in a folder or take it out of one: folders make the shared library (see `access-control.md`).
- Picture bank (`Pildipank`): a top-level library folder with one subfolder per category, filled by `scripts/pildipank/import.ts` from the reviewed lists in `scripts/pildipank/` (see its README). Each picture's alt text is its word; the file name `pildipank-<word>-<source>` lets a rerun update instead of duplicating, and the import never deletes. Fluent Emoji pictures are PNGs, AI pictures (`scripts/pildipank/generate-ai.ts`, Workers AI in the card editor's pictogram style) are 512 px JPEGs; Mulberry symbols, text tiles and shapes are SVGs, and third-party SVGs are sanitised (`sanitizeSvg`) before upload, because media is served from the site's origin. Each Fluent and Mulberry picture's caption carries its licence notice. Run it locally with `pnpm payload run scripts/pildipank/import.ts` (dry run: `PILDIPANK_DRY_RUN=1`); importing to production needs remote bindings and explicit permission. `PILDIPANK_REMOVE_DUPLICATES=1` retires bank pictures a list change replaced (same word, new picture) and copies stored twice (two imports at once: `<name>-1.<ext>`), after re-pointing board cards and puzzles at the current picture. Run one import at a time.
- Saved AI pictures belong to the member who made them and are filed into the `AI-pildid` folder by server code (`symbol-generations` hooks, `context.fileIntoLibrary`), unless the label was personal (see `symbols-ai.md`).
- Legacy media with no owner should be treated as admin-managed until a deliberate backfill or reassignment is performed.

## Change Checklist
- When changing media access:
  - verify Payload REST access does not allow authenticated users to update/delete another user's media
  - keep frontend board and connect-dots uploads assigning the current user as owner
  - keep public read behavior unless image serving is redesigned across all consumers
  - decide explicitly how legacy ownerless media should be handled before running a backfill
