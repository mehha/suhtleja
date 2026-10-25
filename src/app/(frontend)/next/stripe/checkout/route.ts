import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Stripe from 'stripe'
import { createStripeClient } from '@/utilities/stripe'
import {
  getMembershipCheckoutOptions,
  getSavedCardBillingDetailsUpdate,
} from '@/utilities/membershipCheckout'

export const runtime = 'nodejs'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_PRICE_ID_MEMBERSHIP = process.env.STRIPE_PRICE_ID_MEMBERSHIP

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

const hasAnySubscription = async (stripe: Stripe, customerId: string): Promise<boolean> => {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 1,
  })

  return subscriptions.data.length > 0
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
    let customerId = (user as { stripeCustomerId?: string | null }).stripeCustomerId || undefined
    let isNewCustomer = false

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
        limit: 10,
      })

      const customersWithSameEmail = existing.data.filter((customer) => customer.email === user.email)
      const metadataMatchedCustomer = customersWithSameEmail.find(
        (customer) => customer.metadata?.payloadUserId === String(user.id),
      )

      if (metadataMatchedCustomer) {
        customerId = metadataMatchedCustomer.id
      } else if (customersWithSameEmail.length === 1) {
        customerId = customersWithSameEmail[0]?.id
      } else if (customersWithSameEmail.length > 1) {
        console.warn('Stripe checkout blocked due to duplicate customers for email', {
          email: user.email,
          userId: String(user.id),
          customerIds: customersWithSameEmail.map((customer) => customer.id),
        })

        return NextResponse.json(
          { error: 'multiple_matching_customers' },
          { status: 409 },
        )
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
      isNewCustomer = true
    }

    if (customerId !== (user as { stripeCustomerId?: string | null }).stripeCustomerId) {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: null,
          membershipStatus: 'none',
          trialEndsAt: null,
          currentPeriodEndsAt: null,
          membershipCancelAtPeriodEnd: false,
        },
      })
    }

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
