import type Stripe from 'stripe'

export const MEMBERSHIP_TRIAL_DAYS = 14

type MembershipCheckoutOptions = Pick<
  Stripe.Checkout.SessionCreateParams,
  'payment_method_collection' | 'subscription_data'
>

// First-time members get a free trial without entering a card; Stripe cancels the
// subscription if no payment method is added before the trial ends. Customers who
// already had a subscription used their trial, so Checkout collects a card up front.
export const getMembershipCheckoutOptions = ({
  hadSubscription,
  userId,
}: {
  hadSubscription: boolean
  userId: string
}): MembershipCheckoutOptions => {
  const metadata = { payloadUserId: userId }

  if (hadSubscription) {
    return { subscription_data: { metadata } }
  }

  return {
    payment_method_collection: 'if_required',
    subscription_data: {
      metadata,
      trial_period_days: MEMBERSHIP_TRIAL_DAYS,
      trial_settings: {
        end_behavior: { missing_payment_method: 'cancel' },
      },
    },
  }
}
