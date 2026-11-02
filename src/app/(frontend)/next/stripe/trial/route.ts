import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Stripe from 'stripe'

import { getMembershipTrialParams } from '@/utilities/membershipCheckout'
import { membershipFromSubscription } from '@/utilities/membershipSubscription'
import { createStripeClient } from '@/utilities/stripe'
import { hasAnySubscription, resolveStripeCustomer } from '@/utilities/stripeCustomer'

export const runtime = 'nodejs'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_PRICE_ID_MEMBERSHIP = process.env.STRIPE_PRICE_ID_MEMBERSHIP

// A first-time member's trial, without the Stripe page (membership.md): the register form calls this
// right after the login, and the profile's trial offer for an account that has none. A customer who
// had a subscription gets `trial_used`, and the profile sends them to Checkout, which takes a card.
export async function POST(req: Request) {
  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID_MEMBERSHIP) {
    return NextResponse.json({ error: 'missing_stripe_env' }, { status: 500 })
  }

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!user.email) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 })
  }

  // Only an account that never had a membership (a canceled one is `canceled`).
  if ((user.membershipStatus ?? 'none') !== 'none') {
    return NextResponse.json({ error: 'membership_exists' }, { status: 409 })
  }

  const stripe = createStripeClient(STRIPE_SECRET_KEY)

  try {
    const resolved = await resolveStripeCustomer(payload, stripe, {
      id: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
    })

    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 409 })
    }

    const { customerId, isNewCustomer } = resolved

    if (!isNewCustomer && (await hasAnySubscription(stripe, customerId))) {
      return NextResponse.json({ error: 'trial_used' }, { status: 409 })
    }

    // The key makes a repeated call (a second tap, the register form and the profile) return the
    // same subscription instead of making another.
    const subscription = await stripe.subscriptions.create(
      getMembershipTrialParams({ customerId, priceId: STRIPE_PRICE_ID_MEMBERSHIP, userId: String(user.id) }),
      { idempotencyKey: `membership-trial-${user.id}-${customerId}` },
    )

    // The webhook brings the same; the new member needn't wait for it.
    const membership = membershipFromSubscription(subscription)
    await payload.update({ collection: 'users', id: user.id, data: membership })

    return NextResponse.json({ ok: true, trialEndsAt: membership.trialEndsAt })
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError
    const details = {
      type: stripeErr?.type ?? null,
      code: stripeErr?.code ?? null,
      message: stripeErr?.message ?? null,
      requestId: stripeErr?.requestId ?? null,
    }

    console.error('Stripe trial creation failed', details)

    return NextResponse.json({ error: 'trial_failed', details }, { status: 500 })
  }
}
