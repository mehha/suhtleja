import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const runtime = 'nodejs'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

type MembershipStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled'

const toMembershipStatus = (status: Stripe.Subscription.Status): MembershipStatus => {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
    case 'incomplete':
    case 'incomplete_expired':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'paused':
      return 'canceled'
    default:
      return 'none'
  }
}

const toISO = (unixTime?: number | null): string | null => {
  if (!unixTime) return null
  return new Date(unixTime * 1000).toISOString()
}

const getCurrentPeriodEnd = (subscription: Stripe.Subscription): number | null => {
  const periodEnds = subscription.items?.data
    ?.map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === 'number')

  if (!periodEnds || periodEnds.length === 0) return null
  return Math.max(...periodEnds)
}

const findUserIdByCustomer = async (customerId: string): Promise<string | null> => {
  const payload = await getPayload({ config: configPromise })
  const found = await payload.find({
    collection: 'users',
    where: {
      stripeCustomerId: {
        equals: customerId,
      },
    },
    limit: 1,
    depth: 0,
  })

  const userId = found.docs?.[0]?.id
  return userId ? String(userId) : null
}

const updateMembershipFromSubscription = async (subscription: Stripe.Subscription) => {
  const payload = await getPayload({ config: configPromise })
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  let userId = await findUserIdByCustomer(customerId)
  const metadataUserId = subscription.metadata?.payloadUserId
  if (!userId && metadataUserId) userId = metadataUserId

  if (!userId) {
    console.warn('Stripe webhook: no matching user for subscription', subscription.id)
    return
  }

  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      membershipStatus: toMembershipStatus(subscription.status),
      trialEndsAt: toISO(subscription.trial_end),
      currentPeriodEndsAt: toISO(getCurrentPeriodEnd(subscription)),
    },
  })
}

export async function POST(req: Request) {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'missing_stripe_env' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 })
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)
  const body = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const payload = await getPayload({ config: configPromise })
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id
        const userId = session.client_reference_id || session.metadata?.payloadUserId
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id

        if (userId && customerId) {
          await payload.update({
            collection: 'users',
            id: userId,
            data: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId || null,
            },
          })
        }

        // Fallback: derive and persist membership state right after checkout completion.
        // This keeps status in sync even if subscription.* webhook events are delayed/misconfigured.
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await updateMembershipFromSubscription(subscription)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await updateMembershipFromSubscription(subscription)
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('Stripe webhook handling failed', err)
    return NextResponse.json({ error: 'webhook_handler_failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
