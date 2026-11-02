import type Stripe from 'stripe'

import type { User } from '@/payload-types'

// A Stripe subscription as the user's membership fields: the webhook keeps them in sync, and the
// trial route sets them as soon as it has made the subscription.

type MembershipStatus = NonNullable<User['membershipStatus']>

export const toMembershipStatus = (status: Stripe.Subscription.Status): MembershipStatus => {
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

const hasScheduledCancellation = (subscription: Stripe.Subscription): boolean => {
  if (subscription.cancel_at_period_end) return true

  return typeof subscription.cancel_at === 'number' && subscription.cancel_at * 1000 > Date.now()
}

const getCurrentPeriodEnd = (subscription: Stripe.Subscription): number | null => {
  const periodEnds = subscription.items?.data
    ?.map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === 'number')

  if (!periodEnds || periodEnds.length === 0) return null
  return Math.max(...periodEnds)
}

export const getStripeCustomerId = (subscription: Stripe.Subscription): string =>
  typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id

/** The user's membership fields for a subscription. */
export const membershipFromSubscription = (subscription: Stripe.Subscription) => ({
  stripeCustomerId: getStripeCustomerId(subscription),
  stripeSubscriptionId: subscription.id,
  membershipStatus: toMembershipStatus(subscription.status),
  trialEndsAt: toISO(subscription.trial_end),
  currentPeriodEndsAt: toISO(getCurrentPeriodEnd(subscription)),
  membershipCancelAtPeriodEnd: hasScheduledCancellation(subscription),
})
