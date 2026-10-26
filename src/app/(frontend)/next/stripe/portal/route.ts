import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Stripe from 'stripe'
import { createStripeClient } from '@/utilities/stripe'
import { isParentModeUtil } from '@/utilities/uiMode'

export const runtime = 'nodejs'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_BILLING_PORTAL_CONFIGURATION_ID = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID

const getBaseURL = (req: Request): string => {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL
  return new URL(req.url).origin
}

const isMissingStripeResource = (err: unknown): boolean => {
  const stripeErr = err as Stripe.errors.StripeError

  return (
    stripeErr?.type === 'StripeInvalidRequestError' &&
    (stripeErr?.code === 'resource_missing' ||
      stripeErr?.message?.toLowerCase().includes('no such customer'))
  )
}

const clearLocalMembership = async (payload: Awaited<ReturnType<typeof getPayload>>, userId: string | number) => {
  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      membershipStatus: 'none',
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      membershipCancelAtPeriodEnd: false,
    },
  })
}

export async function POST(req: Request) {
  if (!STRIPE_SECRET_KEY) {
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

  // The portal can cancel the membership, so the child view can't open it.
  if (!(await isParentModeUtil())) {
    return NextResponse.json({ error: 'parent_mode_required' }, { status: 403 })
  }

  const membershipStatus = (user as { membershipStatus?: string | null }).membershipStatus
  if (!membershipStatus || membershipStatus === 'none') {
    return NextResponse.json({ error: 'membership_required' }, { status: 403 })
  }

  const stripe = createStripeClient(STRIPE_SECRET_KEY)

  try {
    let customerId = (user as { stripeCustomerId?: string | null }).stripeCustomerId || undefined

    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId)

        if ('deleted' in customer && customer.deleted) {
          customerId = undefined
        }
      } catch (err) {
        if (isMissingStripeResource(err)) {
          customerId = undefined
        } else {
          throw err
        }
      }
    }

    if (!customerId) {
      const existing = await stripe.customers.list({
        email: user.email,
        limit: 1,
      })
      customerId = existing.data[0]?.id
    }

    if (!customerId) {
      await clearLocalMembership(payload, user.id)

      return NextResponse.json({ error: 'missing_stripe_customer' }, { status: 400 })
    }

    if (customerId !== (user as { stripeCustomerId?: string | null }).stripeCustomerId) {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          stripeCustomerId: customerId,
        },
      })
    }

    const baseURL = getBaseURL(req)

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseURL}/profile`,
      ...(STRIPE_BILLING_PORTAL_CONFIGURATION_ID
        ? { configuration: STRIPE_BILLING_PORTAL_CONFIGURATION_ID }
        : {}),
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError
    const details = {
      type: stripeErr?.type ?? null,
      code: stripeErr?.code ?? null,
      message: stripeErr?.message ?? null,
      requestId: stripeErr?.requestId ?? null,
    }

    console.error('Stripe billing portal session failed', details)
    return NextResponse.json({ error: 'portal_failed', details }, { status: 500 })
  }
}
