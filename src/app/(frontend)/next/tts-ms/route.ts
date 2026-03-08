// src/app/(frontend)/next/tts-ms/route.ts
import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'

export const runtime = 'nodejs'

const SPEECH_KEY = process.env.SPEECH_KEY
const SPEECH_REGION = process.env.SPEECH_REGION
const DEFAULT_VOICE =
  process.env.SPEECH_VOICE ?? 'en-US-Ava:DragonHDLatestNeural'
const OUTPUT_FORMAT =
  process.env.SPEECH_OUTPUT_FORMAT ?? 'audio-24khz-48kbitrate-mono-mp3'

// sama shape, mis sul praegu: { text, speaker? }
type TTSRequestBody = {
  text?: string
  speaker?: string
}

function escapeForSSML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function POST(req: Request) {
  if (!SPEECH_KEY || !SPEECH_REGION) {
    return NextResponse.json(
      { error: 'missing_azure_config' },
      { status: 500 },
    )
  }

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!hasActiveMembership(user as User)) {
    return NextResponse.json({ error: 'membership_required' }, { status: 402 })
  }

  let body: TTSRequestBody
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const rawText = (body.text ?? '').trim()
  if (!rawText) {
    return NextResponse.json({ error: 'missing text' }, { status: 400 })
  }

  const voiceName = (body.speaker ?? DEFAULT_VOICE).toString()

  try {
    // 1) võta auth token
    const tokenRes = await fetch(
      `https://${SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': SPEECH_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => '')
      console.error('Azure TTS token error', tokenRes.status, text)
      return NextResponse.json(
        { error: 'token_failed', detail: text || tokenRes.statusText },
        { status: 502 },
      )
    }

    const accessToken = await tokenRes.text()

    // 2) SSML body
    const ssml = `
<speak version="1.0" xml:lang="en-US">
  <voice xml:lang="en-US" name="${voiceName}">
    ${escapeForSSML(rawText)}
  </voice>
</speak>
`.trim()

    // 3) TTS päring
    const ttsRes = await fetch(
      `https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
          'User-Agent': 'verba-aac-nextjs',
        },
        body: ssml,
      },
    )

    if (!ttsRes.ok) {
      const text = await ttsRes.text().catch(() => '')
      console.error('Azure TTS error', ttsRes.status, text)
      return NextResponse.json(
        { error: 'tts_failed', detail: text || ttsRes.statusText },
        { status: 502 },
      )
    }

    const audioBuf = await ttsRes.arrayBuffer()

    // OUTPUT_FORMAT-ist sõltuvalt vali õige content-type
    const contentType =
      OUTPUT_FORMAT.includes('mp3') || OUTPUT_FORMAT.includes('mpeg')
        ? 'audio/mpeg'
        : 'audio/wav'

    return new NextResponse(audioBuf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(audioBuf.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Azure TTS route error', err)
    return NextResponse.json({ error: 'tts_internal' }, { status: 500 })
  }
}
