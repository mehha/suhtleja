import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { DEFAULT_TTS_VOICE, getTTSAudioMetadata, synthesizeAzureSpeech } from '@/utilities/azureTTS'
import { getTTSObjectKey } from '@/utilities/boardTTSCache'
import { getPayloadCloudflareContext } from '@/utilities/getCloudflareContext'
import { findHomepageSpeechText } from '@/utilities/homepageSpeech'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{
    hash: string
  }>
}

// Public: anonymous visitors hear the homepage "Kuula ise" tiles. Only words shown on a
// published homepage are spoken, and each is synthesized once and then served from R2.
export async function GET(_req: Request, { params }: RouteContext) {
  const { hash } = await params

  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const payload = await getPayload({ config: configPromise })
  const pages = await payload.find({
    collection: 'pages',
    depth: 0,
    draft: false,
    overrideAccess: false,
    pagination: false,
    select: { layout: true },
    where: { 'layout.blockType': { equals: 'suhtlejaHomepage' } },
  })

  const text = findHomepageSpeechText(pages.docs, hash)
  if (!text) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const cloudflare = await getPayloadCloudflareContext()
  const bucket = cloudflare.env.R2
  const { contentType, extension } = getTTSAudioMetadata()
  const objectKey = getTTSObjectKey(DEFAULT_TTS_VOICE, hash, extension)
  const cached = await bucket.get(objectKey)

  if (cached?.body) {
    return new NextResponse(cached.body, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': cached.httpMetadata?.contentType || contentType,
      },
    })
  }

  try {
    const synthesized = await synthesizeAzureSpeech({ text, speaker: DEFAULT_TTS_VOICE })
    const audio = synthesized.audio.buffer.slice(
      synthesized.audio.byteOffset,
      synthesized.audio.byteOffset + synthesized.audio.byteLength,
    ) as ArrayBuffer

    await bucket.put(getTTSObjectKey(DEFAULT_TTS_VOICE, hash, synthesized.extension), audio, {
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
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': synthesized.contentType,
      },
    })
  } catch (err) {
    payload.logger.error({ err, msg: 'Homepage speech synthesis failed' })
    return NextResponse.json({ error: 'tts_failed' }, { status: 502 })
  }
}
