'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import type { User } from '@/payload-types'

export type UnlockState = {
  success: boolean
  error?: string
}

export async function unlockParentModeAction(
  _prevState: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const pin = formData.get('pin')?.toString() ?? ''

  const { user } = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'Pole sisse logitud.' }
  }

  const u = user as User

  if (!u.parentPinHash) {
    return {
      success: false,
      error: 'PIN ei ole seadistatud. Sea PIN profiilis.',
    }
  }

  if (!/^\d{4}$/.test(pin)) {
    return { success: false, error: 'PIN peab olema 4 numbrit.' }
  }

  const isValid = await bcrypt.compare(pin, u.parentPinHash)
  if (!isValid) {
    return { success: false, error: 'Vale PIN.' }
  }

  const cookieStore = await cookies()

  // 1h parent mode
  cookieStore.set('uiMode', 'parent', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  })

  return { success: true }
}

export async function switchToChildModeAction() {
  const cookieStore = await cookies()

  cookieStore.set('uiMode', 'child', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  redirect('/kodu')
}
