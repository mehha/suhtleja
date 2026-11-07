import { NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { User } from '@/payload-types'
import { isSameOriginRequest, unlockParentMode, type UnlockState } from '@/utilities/parentUnlock'

// The PIN dialog (ParentUnlockDialog.tsx) sends `{ pin }` here and gets `{ success, error }`. A route,
// not a Server Action, so a page loaded before a deploy still opens the parent view
// (parentUnlock.ts).
export const dynamic = 'force-dynamic'

const answer = (state: UnlockState, status = 200) => NextResponse.json(state, { status })

export async function POST(req: Request) {
  if (!isSameOriginRequest(req.headers)) {
    return answer({ success: false, error: 'Midagi läks valesti. Palun proovi uuesti.' }, 403)
  }

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return answer({ success: false, error: 'Pole sisse logitud.' }, 401)

  const body = (await req.json().catch(() => ({}))) as { pin?: unknown }
  const pin = typeof body.pin === 'string' ? body.pin : ''
  const state = await unlockParentMode(user as User, pin)
  return answer(state, state.success ? 200 : 400)
}
