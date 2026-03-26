// src/app/(frontend)/profile/ProfilePageClient.tsx
'use client'

import { useActionState, useState } from 'react'
import { updatePinAction, clearPinAction } from './actions'
import { Button } from '@/components/ui/button'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { cn } from '@/utilities/ui'
import { Loader2, ShieldCheck, CircleSlash } from 'lucide-react'

const initialState = {
  success: false,
  error: undefined as string | undefined,
}

type StripeRedirectResponse = {
  url?: string
  error?: string
  details?: {
    message?: string | null
  }
}

const STRIPE_REQUEST_TIMEOUT_MS = 20_000

type Props = {
  hasPin: boolean
  membershipStatus?: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | null
  trialEndsAt?: string | null
  currentPeriodEndsAt?: string | null
  membershipCancelAtPeriodEnd?: boolean | null
}

const MEMBERSHIP_LABELS: Record<NonNullable<Props['membershipStatus']>, string> = {
  none: 'Puudub',
  trialing: 'Trial',
  active: 'Aktiivne',
  past_due: 'Makseraskus',
  canceled: 'Lõpetatud',
}

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDate = (value?: string | null): string | null => {
  const date = parseDate(value)
  if (!date) return null

  return new Intl.DateTimeFormat('et-EE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function ProfilePageClient({
  hasPin: initialHasPin,
  membershipStatus,
  trialEndsAt,
  currentPeriodEndsAt,
  membershipCancelAtPeriodEnd,
}: Props) {
  const [pin, setPin] = useState('')
  const [state, formAction] = useActionState(updatePinAction, initialState)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // derived staatus: kui server action õnnestus, eelda et PIN on nüüd olemas
  const effectiveHasPin =
    initialHasPin || (state.success && !state.error)

  const membership = membershipStatus ?? 'none'
  const isMembershipActive = membership === 'active' || membership === 'trialing'
  const periodEndsAtDate = parseDate(currentPeriodEndsAt)
  const isPendingCancellation =
    Boolean(membershipCancelAtPeriodEnd) &&
    Boolean(periodEndsAtDate && periodEndsAtDate.getTime() > Date.now())
  const hasMembershipAccess = isMembershipActive || isPendingCancellation
  const canManageMembership = membership !== 'none'
  const trialEndsLabel = formatDate(trialEndsAt)
  const periodEndsLabel = formatDate(currentPeriodEndsAt)

  const startMembershipCheckout = async () => {
    if (checkoutLoading || hasMembershipAccess) return

    setCheckoutLoading(true)
    setCheckoutError(null)

    try {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), STRIPE_REQUEST_TIMEOUT_MS)
      const res = await fetch('/next/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      window.clearTimeout(timeoutId)

      const json = (await res.json().catch(() => ({}))) as StripeRedirectResponse
      if (!res.ok || !json?.url) {
        throw new Error(json?.details?.message || json?.error || 'Checkout session creation failed')
      }

      window.location.href = json.url as string
    } catch (err) {
      console.error('Stripe checkout failed', err)
      const isAbortError = err instanceof DOMException && err.name === 'AbortError'
      setCheckoutError(
        isAbortError
          ? 'Checkout ei vastanud piisavalt kiiresti. Proovi uuesti.'
          : 'Checkouti avamine ebaõnnestus. Proovi uuesti.',
      )
      setCheckoutLoading(false)
    }
  }

  const openMembershipPortal = async () => {
    if (portalLoading || !canManageMembership) return

    setPortalLoading(true)
    setCheckoutError(null)

    try {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), STRIPE_REQUEST_TIMEOUT_MS)
      const res = await fetch('/next/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      window.clearTimeout(timeoutId)

      const json = (await res.json().catch(() => ({}))) as StripeRedirectResponse
      if (!res.ok || !json?.url) {
        throw new Error(json?.details?.message || json?.error || 'Billing portal creation failed')
      }

      window.location.href = json.url as string
    } catch (err) {
      console.error('Stripe billing portal failed', err)
      const isAbortError = err instanceof DOMException && err.name === 'AbortError'
      setCheckoutError(
        isAbortError
          ? 'Liikmelisuse haldus ei vastanud piisavalt kiiresti. Proovi uuesti.'
          : 'Liikmelisuse haldus ei avanenud. Proovi uuesti.',
      )
      setPortalLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Liikmelisus</h2>
            <p className="text-sm text-muted-foreground">
              Alusta liikmelisust Stripe Checkoutiga. Esimesed 14 päeva on tasuta.
            </p>
            <p className="mt-2 text-sm">
              Staatus:{' '}
              <span
                className={cn(
                  'font-medium',
                  isPendingCancellation
                    ? 'text-amber-600'
                    : isMembershipActive
                      ? 'text-emerald-600'
                      : 'text-muted-foreground',
                )}
              >
                {isPendingCancellation ? 'Lõpeb perioodi lõpus' : MEMBERSHIP_LABELS[membership]}
              </span>
            </p>
            {isPendingCancellation && (
              <p className="text-xs text-amber-700">
                Liikmelisus on tühistatud ja kehtib kuni perioodi lõpuni.
              </p>
            )}
            {trialEndsLabel && (
              <p className="text-xs text-muted-foreground">
                Trial lõpeb: {trialEndsLabel}
              </p>
            )}
            {periodEndsLabel && (
              <p className="text-xs text-muted-foreground">
                Periood lõpeb: {periodEndsLabel}
              </p>
            )}
          </div>
        </div>

        {checkoutError && (
          <p className="text-sm text-red-500">{checkoutError}</p>
        )}
        <Button
          type="button"
          onClick={startMembershipCheckout}
          disabled={checkoutLoading || hasMembershipAccess}
          className="gap-2"
        >
          {checkoutLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Suunan checkouti...
            </>
          ) : isPendingCancellation ? (
            <>
              <CircleSlash className="h-4 w-4" />
              Tühistatud perioodi lõpus
            </>
          ) : hasMembershipAccess ? (
            <>
              <ShieldCheck className="h-4 w-4" />
              Liikmelisus aktiivne
            </>
          ) : (
            'Alusta liikmelisust (14 päeva tasuta)'
          )}
        </Button>
        {canManageMembership && (
          <Button
            type="button"
            variant="outline"
            onClick={openMembershipPortal}
            disabled={portalLoading}
            className="ms-2"
          >
            {portalLoading ? 'Avan halduse...' : 'Halda liikmelisust'}
          </Button>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium">Vanema PIN</h2>
            <p className="text-sm text-muted-foreground">
              PIN-i kasutatakse vanema vaate avamiseks koduvaates.
            </p>
            <p className="mt-2 text-sm">
              Staatus:{' '}
              <span
                className={cn(
                  'font-medium',
                  effectiveHasPin ? 'text-emerald-600' : 'text-muted-foreground',
                )}
              >
                {effectiveHasPin
                  ? 'PIN on seadistatud'
                  : 'PIN ei ole seadistatud'}
              </span>
            </p>
          </div>
        </div>

        {/* PIN seadmine / uuendamine – üks form */}
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label>Uus PIN (4 numbrit)</Label>
            <InputOTP
              maxLength={4}
              value={pin}
              onChange={setPin}
              containerClassName="justify-start"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>

            {/* saadame PIN-i FormData-s kaasa */}
            <input type="hidden" name="pin" value={pin} />
          </div>

          {state.error && (
            <p className="text-sm text-red-500">{state.error}</p>
          )}
          {state.success && !state.error && (
            <p className="text-sm text-emerald-600">PIN salvestatud.</p>
          )}

          <Button type="submit" disabled={pin.length !== 4}>
            {effectiveHasPin ? 'Uuenda PIN' : 'Sea PIN'}
          </Button>
        </form>

        {/* PIN eemaldamine – eraldi form, mitte form-i sees, ja EI mingit inline "use server" */}
        {effectiveHasPin && (
          <form action={clearPinAction}>
            <Button type="submit" variant="outline">
              Eemalda PIN
            </Button>
          </form>
        )}
      </section>
    </div>
  )
}
