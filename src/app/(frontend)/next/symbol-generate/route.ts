import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { getPictogramSubject } from '@/utilities/groq'
import { hasActiveMembership } from '@/utilities/membershipStatus'
import {
  SYMBOL_GENERATION_LABEL_MAX_LENGTH,
  SYMBOL_GENERATION_MODEL,
  SYMBOL_GENERATION_SIZE,
  SYMBOL_GENERATION_VARIANTS,
  SYMBOL_GENERATIONS_PER_MONTH,
  base64ImageToDataURL,
  buildPictogramPrompt,
  countSymbolGenerationsThisMonth,
  sha256Hex,
} from '@/utilities/symbolGeneration'
import { getWorkersAI, type WorkersAI } from '@/utilities/workersAI'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function authorize(req: Request) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  if (!hasActiveMembership(user as User)) {
    return { response: NextResponse.json({ error: 'membership_required' }, { status: 402 }) }
  }

  return { payload, user: user as User }
}

function remainingFor(user: User, used: number) {
  if (user.role === 'admin') return SYMBOL_GENERATIONS_PER_MONTH
  return Math.max(0, SYMBOL_GENERATIONS_PER_MONTH - used)
}

async function generateImage(ai: WorkersAI, prompt: string, seed: number): Promise<{ base64: string; hash: string }> {
  // FLUX.2 takes multipart form data even for a prompt alone. Passing the form through a Response
  // serialises it and gives the content type with its boundary.
  const form = new FormData()
  form.append('prompt', prompt)
  form.append('width', String(SYMBOL_GENERATION_SIZE))
  form.append('height', String(SYMBOL_GENERATION_SIZE))
  form.append('seed', String(seed))
  const formResponse = new Response(form)

  const result = (await ai.run(SYMBOL_GENERATION_MODEL, {
    multipart: {
      body: formResponse.body,
      contentType: formResponse.headers.get('content-type'),
    },
  })) as { image?: unknown }

  if (typeof result?.image !== 'string' || !result.image) {
    throw new Error('empty_image')
  }

  return { base64: result.image, hash: sha256Hex(Buffer.from(result.image, 'base64')) }
}

export async function GET(req: Request) {
  const auth = await authorize(req)
  if ('response' in auth) return auth.response

  const used = await countSymbolGenerationsThisMonth(auth.payload, auth.user.id)

  return NextResponse.json({
    limit: SYMBOL_GENERATIONS_PER_MONTH,
    remaining: remainingFor(auth.user, used),
  })
}

export async function POST(req: Request) {
  const auth = await authorize(req)
  if ('response' in auth) return auth.response
  const { payload, user } = auth

  const body = (await req.json().catch(() => ({}))) as { label?: unknown }
  const label = typeof body.label === 'string' ? body.label.trim() : ''

  if (!label) {
    return NextResponse.json({ error: 'missing_label' }, { status: 400 })
  }

  if (label.length > SYMBOL_GENERATION_LABEL_MAX_LENGTH) {
    return NextResponse.json({ error: 'label_too_long' }, { status: 400 })
  }

  const used = await countSymbolGenerationsThisMonth(payload, user.id)
  if (remainingFor(user, used) <= 0) {
    return NextResponse.json(
      { error: 'limit_reached', limit: SYMBOL_GENERATIONS_PER_MONTH, remaining: 0 },
      { status: 429 },
    )
  }

  const ai = await getWorkersAI()
  if (!ai) {
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 503 })
  }

  const { personal, subject } = await getPictogramSubject(label)
  const prompt = buildPictogramPrompt(subject)

  // Count the request before generating, so parallel requests can't run past the limit.
  const log = await payload.create({
    collection: 'symbol-generations',
    data: { label, personal, prompt, user: user.id },
    overrideAccess: true,
  })

  const seedBase = Math.floor(Math.random() * 1_000_000)
  const results = await Promise.allSettled(
    Array.from({ length: SYMBOL_GENERATION_VARIANTS }, (_, index) =>
      generateImage(ai, prompt, seedBase + index),
    ),
  )
  const images = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))

  if (!images.length) {
    const reason = results.find((result) => result.status === 'rejected')
    console.error('Symbol generation failed', reason?.status === 'rejected' ? reason.reason : null)
    await payload.delete({ collection: 'symbol-generations', id: log.id, overrideAccess: true })
    return NextResponse.json({ error: 'generation_failed' }, { status: 502 })
  }

  await payload.update({
    collection: 'symbol-generations',
    id: log.id,
    data: { imageHashes: images.map((image) => image.hash), images: images.length },
    overrideAccess: true,
  })

  return NextResponse.json({
    generationId: log.id,
    images: images.map((image) => base64ImageToDataURL(image.base64)),
    limit: SYMBOL_GENERATIONS_PER_MONTH,
    personal,
    remaining: remainingFor(user, used + 1),
  })
}
