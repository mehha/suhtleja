// src/app/(frontend)/next/tts-tartu/route.ts
import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'

const TTS_URL = process.env.TTS_URL ?? 'http://localhost:8000/v2'
const TTS_TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS ?? 20000)

export const runtime = 'nodejs'

type TTSRequestBody = {
  text?: string
  speaker?: string
  speed?: number
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

  const text = (body.text ?? '').trim()
  if (!text) {
    return NextResponse.json({ error: 'missing text' }, { status: 400 })
  }

  const speaker =
    (body.speaker ?? process.env.TTS_DEFAULT_SPEAKER ?? 'mari').toString()

  let speed = body.speed ?? 1
  if (!Number.isFinite(speed)) speed = 1
  if (speed < 0.5) speed = 0.5
  if (speed > 2) speed = 2

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS)

  try {
    const upstream = await fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker, speed }),
      signal: controller.signal,
    })

    if (!upstream.ok) {
      const err = await upstream.text().catch(() => '')
      console.error('TTS upstream error', upstream.status, err)
      return NextResponse.json(
        {
          error: 'tts_failed',
          status: upstream.status,
          detail: err || upstream.statusText,
        },
        { status: 502 },
      )
    }

    const audioBuf = await upstream.arrayBuffer()

    return new NextResponse(audioBuf, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(audioBuf.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    clearTimeout(timeoutId)

    if (err?.name === 'AbortError') {
      console.error('TTS timeout', err)
      return NextResponse.json({ error: 'tts_timeout' }, { status: 504 })
    }

    console.error('TTS route error', err)
    return NextResponse.json({ error: 'tts_internal' }, { status: 500 })
  } finally {
    clearTimeout(timeoutId)
  }
}
