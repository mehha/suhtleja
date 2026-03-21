import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { getBoardTTSCacheManifest } from '@/utilities/boardTTSCacheManifest'
import { getPayloadCloudflareContext } from '@/utilities/getCloudflareContext'
import { hasActiveMembership } from '@/utilities/membershipStatus'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{
    boardId: string
    hash: string
  }>
}

export async function GET(req: Request, { params }: RouteContext) {
  const { boardId, hash } = await params
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!hasActiveMembership(user as User)) {
    return NextResponse.json({ error: 'membership_required' }, { status: 402 })
  }

  const board = await payload
    .findByID({
      collection: 'boards',
      id: boardId,
      depth: 0,
    })
    .catch(() => null)

  if (!board) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const manifest = getBoardTTSCacheManifest(board)
  const entry = manifest.entries.find((item) => item.hash === hash)

  if (!entry) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const cloudflare = await getPayloadCloudflareContext()
  const object = await cloudflare.env.R2.get(entry.key)

  if (!object?.body) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const headers = new Headers({
    'Cache-Control': object.httpMetadata?.cacheControl || 'private, max-age=31536000, immutable',
    'Content-Type': object.httpMetadata?.contentType || entry.contentType,
  })

  if (object.httpEtag) {
    headers.set('ETag', object.httpEtag)
  }

  return new NextResponse(object.body, {
    status: 200,
    headers,
  })
}
