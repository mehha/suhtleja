'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import { FLASH_TOAST_PARAM, FLASH_TOASTS, isFlashToastKey } from '@/utilities/flashToast'

// Stripe Checkout returns to /profile?membership=success or =cancel (next/stripe/checkout).
// `membership=required` is read by the profile page itself, so it stays in the URL.
const MEMBERSHIP_TOASTS = {
  success: { type: 'success', message: 'Makse õnnestus. Liikmelisus aktiveerub kohe.' },
  cancel: { type: 'info', message: 'Makse katkestati. Midagi ei muutunud.' },
} as const

// Shows the toast a server action asked for with `withToast()`, then removes the param so a
// reload or a shared link doesn't show it again.
export function FlashToast() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const key = searchParams.get(FLASH_TOAST_PARAM)
    const membership = searchParams.get('membership')
    const membershipToast =
      membership === 'success' || membership === 'cancel' ? MEMBERSHIP_TOASTS[membership] : null

    if (!key && !membershipToast) return

    if (isFlashToastKey(key)) {
      const { type, message } = FLASH_TOASTS[key]
      // The id keeps a second effect run (dev Strict Mode) from showing it twice.
      toast[type](message, { id: `flash-${key}` })
    }
    if (membershipToast) {
      toast[membershipToast.type](membershipToast.message, { id: `membership-${membership}` })
    }

    const rest = new URLSearchParams(searchParams.toString())
    rest.delete(FLASH_TOAST_PARAM)
    if (membershipToast) rest.delete('membership')
    const query = rest.toString()
    router.replace(`${pathname}${query ? `?${query}` : ''}${window.location.hash}`, { scroll: false })
  }, [pathname, router, searchParams])

  return null
}
