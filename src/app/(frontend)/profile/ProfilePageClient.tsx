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
import { Loader2, ShieldCheck } from 'lucide-react'

const initialState = {
  success: false,
  error: undefined as string | undefined,
}

type Props = {
  hasPin: boolean
  membershipStatus?: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | null
  trialEndsAt?: string | null
  currentPeriodEndsAt?: string | null
}

const MEMBERSHIP_LABELS: Record<NonNullable<Props['membershipStatus']>, string> = {
  none: 'Puudub',
  trialing: 'Trial',
  active: 'Aktiivne',
  past_due: 'Makseraskus',
  canceled: 'Lõpetatud',
}

const formatDate = (value?: string | null): string | null => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

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
}: Props) {
  const [pin, setPin] = useState('')
  const [state, formAction] = useActionState(updatePinAction, initialState)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // derived staatus: kui server action õnnestus, eelda et PIN on nüüd olemas
  const effectiveHasPin =
    initialHasPin || (state.success && !state.error)

  const membership = membershipStatus ?? 'none'
  const isMembershipActive = membership === 'active' || membership === 'trialing'
  const trialEndsLabel = formatDate(trialEndsAt)
  const periodEndsLabel = formatDate(currentPeriodEndsAt)

  const startMembershipCheckout = async () => {
    if (checkoutLoading || isMembershipActive) return

    setCheckoutLoading(true)
    setCheckoutError(null)

    try {
      const res = await fetch('/next/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || 'Checkout session creation failed')
      }

      window.location.href = json.url as string
    } catch (err) {
      console.error('Stripe checkout failed', err)
      setCheckoutError('Checkouti avamine ebaõnnestus. Proovi uuesti.')
      setCheckoutLoading(false)
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
                  isMembershipActive ? 'text-emerald-600' : 'text-muted-foreground',
                )}
              >
                {MEMBERSHIP_LABELS[membership]}
              </span>
            </p>
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
          disabled={checkoutLoading || isMembershipActive}
          className="gap-2"
        >
          {checkoutLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Suunan checkouti...
            </>
          ) : isMembershipActive ? (
            <>
              <ShieldCheck className="h-4 w-4" />
              Liikmelisus aktiivne
            </>
          ) : (
            'Alusta liikmelisust (14 päeva tasuta)'
          )}
        </Button>
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
