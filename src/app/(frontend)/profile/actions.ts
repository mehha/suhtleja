// src/app/(frontend)/profile/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { pinChangeNeedsPassword } from '@/utilities/parentPin'
import { isParentModeUtil } from '@/utilities/uiMode'
import type { User } from '@/payload-types'

type PinState = {
  success: boolean
  error?: string
}

type NameState = PinState

// Checkout takes the name from the account to offer a returning member's saved card, so an
// account without one can add it here. Like the other account settings, it needs the parent view.
export async function updateNameAction(
  _prevState: NameState,
  formData: FormData,
): Promise<NameState> {
  const { user, payload } = await getCurrentUser()
  if (!user) {
    redirect('/admin')
  }

  if (!(await isParentModeUtil())) {
    return { success: false, error: 'Nime muutmiseks ava vanema vaade.' }
  }

  const name = formData.get('name')?.toString().trim() ?? ''
  if (!name) {
    return { success: false, error: 'Sisesta oma nimi.' }
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { name },
  })

  revalidatePath('/profile')
  return { success: true }
}

export async function updatePinAction(
  _prevState: PinState,
  formData: FormData,
): Promise<PinState> {
  const rawPin = formData.get('pin')?.toString() ?? ''

  const { user, payload } = await getCurrentUser()
  if (!user) {
    redirect('/admin')
  }

  if (!/^\d{4}$/.test(rawPin)) {
    return { success: false, error: 'PIN peab olema 4 numbrit.' }
  }

  // In the child view the account password stands in for the PIN, so a child can't set their own.
  const hasPin = Boolean((user as User).parentPinHash)
  if (pinChangeNeedsPassword({ hasPin, isParentMode: await isParentModeUtil() })) {
    const password = formData.get('password')?.toString() ?? ''
    if (!password) {
      return { success: false, error: 'Sisesta konto parool või ava vanema vaade.' }
    }

    try {
      await payload.login({ collection: 'users', data: { email: user.email, password } })
    } catch (error) {
      const locked = error instanceof Error && error.name === 'LockedAuth'
      return {
        success: false,
        error: locked ? 'Liiga palju valesid katseid. Proovi mõne minuti pärast uuesti.' : 'Vale parool.',
      }
    }
  }

  const hash = await bcrypt.hash(rawPin, 10)

  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      parentPinHash: hash,
      pinUpdatedAt: new Date().toISOString(),
    },
  })

  return { success: true }
}

// NB: vormi actionina kasutatav server action – EI mingit inline "use server"
export async function clearPinAction(_formData: FormData) {
  const { user, payload } = await getCurrentUser()
  if (!user) {
    redirect('/admin')
  }

  // Without a PIN the parent view opens for anyone, so only the parent view may remove it.
  if (!(await isParentModeUtil())) {
    redirect('/profile')
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      parentPinHash: null,
      pinUpdatedAt: null,
    },
  })

  // uiMode tagasi child'iks
  const cookieStore = await cookies()
  cookieStore.set('uiMode', 'child', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  // lihtne refresh profiilile
  redirect('/profile')
}
