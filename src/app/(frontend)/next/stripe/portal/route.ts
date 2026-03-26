import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Stripe from 'stripe'
import { createStripeClient } from '@/utilities/stripe'

export const runtime = 'nodejs'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_BILLING_PORTAL_CONFIGURATION_ID = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID

const getBaseURL = (req: Request): string => {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL
  return new URL(req.url).origin
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

  const membershipStatus = (user as { membershipStatus?: string | null }).membershipStatus
  if (!membershipStatus || membershipStatus === 'none') {
    return NextResponse.json({ error: 'membership_required' }, { status: 403 })
  }

  const stripe = createStripeClient(STRIPE_SECRET_KEY)

  try {
    let customerId = (user as { stripeCustomerId?: string | null }).stripeCustomerId || undefined

    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId)
      } catch (err) {
        const stripeErr = err as Stripe.errors.StripeError
        const isMissingCustomer =
          stripeErr?.type === 'StripeInvalidRequestError' &&
          stripeErr?.code === 'resource_missing'

        if (isMissingCustomer) {
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
