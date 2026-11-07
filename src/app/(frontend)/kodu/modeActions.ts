'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const getSafeChildReturnPath = (value: FormDataEntryValue | null): string => {
  const fallback = '/kodu'

  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback

  const [pathname] = value.split(/[?#]/)
  if (!pathname) return fallback

  const canStayOnPath =
    pathname === '/kodu' || pathname === '/connect-dots' || /^\/boards\/[^/]+$/.test(pathname)
  return canStayOnPath ? value : fallback
}

export async function switchToChildModeAction(formData: FormData) {
  const cookieStore = await cookies()

  cookieStore.set('uiMode', 'child', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  redirect(getSafeChildReturnPath(formData.get('returnTo')))
}
