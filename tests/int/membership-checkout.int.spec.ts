import { describe, expect, it } from 'vitest'
import {
  MEMBERSHIP_TRIAL_DAYS,
  getMembershipCheckoutOptions,
} from '@/utilities/membershipCheckout'

describe('membership checkout options', () => {
  it('offers first-time members a trial without collecting a card', () => {
    const options = getMembershipCheckoutOptions({ hadSubscription: false, userId: '42' })

    expect(options.payment_method_collection).toBe('if_required')
    expect(options.saved_payment_method_options).toBeUndefined()
    expect(options.subscription_data).toEqual({
      metadata: { payloadUserId: '42' },
      trial_period_days: MEMBERSHIP_TRIAL_DAYS,
      trial_settings: {
        end_behavior: { missing_payment_method: 'cancel' },
      },
    })
  })

  it('collects a card and skips the trial for returning customers', () => {
    const options = getMembershipCheckoutOptions({ hadSubscription: true, userId: '42' })

    expect(options.payment_method_collection).toBeUndefined()
    expect(options.subscription_data).toEqual({ metadata: { payloadUserId: '42' } })
  })

  it('offers returning customers their saved card', () => {
    const options = getMembershipCheckoutOptions({ hadSubscription: true, userId: '42' })

    expect(options.saved_payment_method_options).toEqual({
      allow_redisplay_filters: ['always', 'limited', 'unspecified'],
    })
  })
})
