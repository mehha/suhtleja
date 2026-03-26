import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Stripe from 'stripe'
import { createStripeClient } from '@/utilities/stripe'

export const runtime = 'nodejs'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_PRICE_ID_MEMBERSHIP = process.env.STRIPE_PRICE_ID_MEMBERSHIP

const getBaseURL = (req: Request): string => {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL
  return new URL(req.url).origin
}

export async function POST(req: Request) {
  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID_MEMBERSHIP) {
    return NextResponse.json(
      { error: 'missing_stripe_env' },
      { status: 500 },
    )
  }

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: req.headers })

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!user.email) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 })
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
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          payloadUserId: String(user.id),
        },
      })
      customerId = customer.id
    }

    const baseURL = getBaseURL(req)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: STRIPE_PRICE_ID_MEMBERSHIP,
          quantity: 1,
        },
      ],
      client_reference_id: String(user.id),
      metadata: {
        payloadUserId: String(user.id),
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          payloadUserId: String(user.id),
        },
      },
      success_url: `${baseURL}/profile?membership=success`,
      cancel_url: `${baseURL}/profile?membership=cancel`,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'missing_checkout_url' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError
    const details = {
      type: stripeErr?.type ?? null,
      code: stripeErr?.code ?? null,
      message: stripeErr?.message ?? null,
      requestId: stripeErr?.requestId ?? null,
    }

    console.error('Stripe checkout creation failed', details)

    return NextResponse.json(
      { error: 'checkout_failed', details },
      { status: 500 },
    )
  }
}
