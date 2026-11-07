import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

import type { User } from '@/payload-types'

export type UnlockState = {
  success: boolean
  error?: string
}

// The right PIN opens the parent view for an hour: the `uiMode` cookie (parent-child-mode.md).
// `POST /next/parent-unlock` calls it, not a Server Action: a page loaded before a deploy holds the
// old build's action ids, which the server no longer knows, and the child's tablet keeps its page
// open for days.
export async function unlockParentMode(user: User, pin: string): Promise<UnlockState> {
  if (!user.parentPinHash) {
    return { success: false, error: 'PIN ei ole seadistatud. Sea PIN profiilis.' }
  }
  if (!/^\d{4}$/.test(pin)) {
    return { success: false, error: 'PIN peab olema 4 numbrit.' }
  }
  if (!(await bcrypt.compare(pin, user.parentPinHash))) {
    return { success: false, error: 'Vale PIN.' }
  }

  const cookieStore = await cookies()
  cookieStore.set('uiMode', 'parent', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  })
  return { success: true }
}

// A request from the site's own pages: the browser sends `Origin` with every POST, and a page
// elsewhere can't set the host headers without the browser asking first. Server Actions check the
// same.
export function isSameOriginRequest(headers: Headers) {
  const origin = headers.get('origin')
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
