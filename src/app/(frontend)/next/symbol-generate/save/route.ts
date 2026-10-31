import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'
import { hasActiveMembership } from '@/utilities/membershipStatus'
import { saveGeneratedPicture } from '@/utilities/symbolGeneration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /next/symbol-generate/save { generationId, image }
 * Saves the AI picture the member chose (a data URL from POST /next/symbol-generate) as their media.
 * Unless the label was personal, it also joins the shared library.
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!hasActiveMembership(user as User)) {
    return NextResponse.json({ error: 'membership_required' }, { status: 402 })
  }

  const body = (await req.json().catch(() => ({}))) as { generationId?: unknown; image?: unknown }
  const generationId = Number(body.generationId)
  if (!Number.isInteger(generationId) || typeof body.image !== 'string') {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const result = await saveGeneratedPicture(payload, {
    dataURL: body.image,
    generationId,
    userId: (user as User).id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ media: result.media, shared: result.shared })
}
