import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { synthesizeAzureSpeech } from '@/utilities/azureTTS'
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

  // The runner preloads every word of a board at once, so this stays light: only the speech
  // manifest, not the cards and compounds. The collection's read access decides, the same as on
  // the board page, so another user's private board is not found.
  const board = await payload
    .findByID({
      collection: 'boards',
      id: boardId,
      depth: 0,
      overrideAccess: false,
      select: { ttsCache: true },
      user,
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
  const bucket = cloudflare.env.R2
  const object = await bucket.get(entry.key)

  // The manifest has the word but R2 doesn't have its audio: the save couldn't store it (Azure or R2
  // failed), or the database came from another environment. Make it now and store it, so the next
  // request is served from R2. Only the board's own words are synthesized, never free text.
  if (!object?.body) {
    try {
      const synthesized = await synthesizeAzureSpeech({ text: entry.text, speaker: entry.voice })
      const audio = synthesized.audio.buffer.slice(
        synthesized.audio.byteOffset,
        synthesized.audio.byteOffset + synthesized.audio.byteLength,
      ) as ArrayBuffer

      await bucket.put(entry.key, audio, {
        httpMetadata: {
          contentType: synthesized.contentType,
          cacheControl: 'public, max-age=31536000, immutable',
        },
        customMetadata: {
          text: synthesized.text,
          voice: synthesized.voice,
        },
      })

      return new NextResponse(audio, {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=31536000, immutable',
          'Content-Type': synthesized.contentType,
        },
      })
    } catch (err) {
      payload.logger.error({ err, msg: 'Board speech synthesis failed', boardId, hash })
      return NextResponse.json({ error: 'tts_failed' }, { status: 502 })
    }
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
