import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Stripe from 'stripe'
import { createStripeClient } from '@/utilities/stripe'
import {
  getMembershipCheckoutOptions,
  getSavedCardBillingDetailsUpdate,
} from '@/utilities/membershipCheckout'
import { hasAnySubscription, resolveStripeCustomer } from '@/utilities/stripeCustomer'

export const runtime = 'nodejs'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_PRICE_ID_MEMBERSHIP = process.env.STRIPE_PRICE_ID_MEMBERSHIP

const getBaseURL = (req: Request): string => {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL
  return new URL(req.url).origin
}

const completeSavedCardBillingDetails = async (
  stripe: Stripe,
  customerId: string,
  account: { email: string; name?: string | null },
): Promise<void> => {
  const paymentMethods = await stripe.customers.listPaymentMethods(customerId, {
    type: 'card',
    limit: 10,
  })

  for (const paymentMethod of paymentMethods.data) {
    const billingDetails = getSavedCardBillingDetailsUpdate({
      billingDetails: paymentMethod.billing_details,
      ...account,
    })

    if (billingDetails) {
      await stripe.paymentMethods.update(paymentMethod.id, { billing_details: billingDetails })
    }
  }
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
    const resolved = await resolveStripeCustomer(payload, stripe, {
      id: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
    })

    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 409 })
    }

    const { customerId, isNewCustomer } = resolved

    const baseURL = getBaseURL(req)
    const hadSubscription = isNewCustomer ? false : await hasAnySubscription(stripe, customerId)

    if (hadSubscription) {
      // A failure here only means the saved card isn't offered, so Checkout still opens.
      try {
        await completeSavedCardBillingDetails(stripe, customerId, {
          email: user.email,
          name: user.name,
        })
      } catch (err) {
        console.warn('Stripe saved card billing details update failed', {
          customerId,
          message: (err as Stripe.errors.StripeError)?.message ?? null,
        })
      }
    }

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
      ...getMembershipCheckoutOptions({ hadSubscription, userId: String(user.id) }),
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
