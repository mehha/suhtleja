// src/app/(frontend)/next/tts-ms/route.ts
import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'
import {
  DEFAULT_TTS_VOICE,
  synthesizeAzureSpeech,
} from '@/utilities/azureTTS'

export const runtime = 'nodejs'

// sama shape, mis sul praegu: { text, speaker? }
type TTSRequestBody = {
  text?: string
  speaker?: string
}

export async function POST(req: Request) {
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

  const voiceName = (body.speaker ?? DEFAULT_TTS_VOICE).toString()

  try {
    const synthesized = await synthesizeAzureSpeech({
      text: rawText,
      speaker: voiceName,
    })

    return new NextResponse(synthesized.audio, {
      status: 200,
      headers: {
        'Content-Type': synthesized.contentType,
        'Content-Length': String(synthesized.audio.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Azure TTS route error', err)
    return NextResponse.json({ error: 'tts_internal' }, { status: 500 })
  }
}
