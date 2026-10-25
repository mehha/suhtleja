import type Stripe from 'stripe'

export const MEMBERSHIP_TRIAL_DAYS = 14

type MembershipCheckoutOptions = Pick<
  Stripe.Checkout.SessionCreateParams,
  'payment_method_collection' | 'saved_payment_method_options' | 'subscription_data'
>

// First-time members get a free trial without entering a card; Stripe cancels the
// subscription if no payment method is added before the trial ends. Customers who
// already had a subscription used their trial, so Checkout collects a card up front.
// Their saved card is offered again: cards saved by a subscription (`limited`) or
// without a redisplay setting (`unspecified`) are hidden by Checkout's default filter.
export const getMembershipCheckoutOptions = ({
  hadSubscription,
  userId,
}: {
  hadSubscription: boolean
  userId: string
}): MembershipCheckoutOptions => {
  const metadata = { payloadUserId: userId }

  if (hadSubscription) {
    return {
      saved_payment_method_options: {
        allow_redisplay_filters: ['always', 'limited', 'unspecified'],
      },
      subscription_data: { metadata },
    }
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
