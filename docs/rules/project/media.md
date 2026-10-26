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
- Legacy media with no owner should be treated as admin-managed until a deliberate backfill or reassignment is performed.

## Change Checklist
- When changing media access:
  - verify Payload REST access does not allow authenticated users to update/delete another user's media
  - keep frontend board and connect-dots uploads assigning the current user as owner
  - keep public read behavior unless image serving is redesigned across all consumers
  - decide explicitly how legacy ownerless media should be handled before running a backfill
