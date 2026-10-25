import type Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import {
  MEMBERSHIP_TRIAL_DAYS,
  getMembershipCheckoutOptions,
  getSavedCardBillingDetailsUpdate,
} from '@/utilities/membershipCheckout'

const billingDetails = (
  overrides: Partial<Stripe.PaymentMethod.BillingDetails> = {},
): Stripe.PaymentMethod.BillingDetails => ({
  address: {
    city: null,
    country: 'EE',
    line1: null,
    line2: null,
    postal_code: null,
    state: null,
  },
  email: null,
  name: null,
  phone: null,
  tax_id: null,
  ...overrides,
})

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

describe('saved card billing details', () => {
  const email = 'mari@example.com'

  it('fills in the email and name on a card added in the Billing Portal', () => {
    expect(
      getSavedCardBillingDetailsUpdate({
        billingDetails: billingDetails(),
        email,
        name: ' Mari Maasikas ',
      }),
    ).toEqual({ email, name: 'Mari Maasikas' })
  })

  it('keeps the details a card already has', () => {
    expect(
      getSavedCardBillingDetailsUpdate({
        billingDetails: billingDetails({ email: 'card@example.com' }),
        email,
        name: 'Mari Maasikas',
      }),
    ).toEqual({ name: 'Mari Maasikas' })
  })

  it('leaves complete cards alone', () => {
    expect(
      getSavedCardBillingDetailsUpdate({
        billingDetails: billingDetails({ email: 'card@example.com', name: 'Card Holder' }),
        email,
        name: 'Mari Maasikas',
      }),
    ).toBeNull()
  })

  it('leaves the card alone when the account has no name', () => {
    expect(
      getSavedCardBillingDetailsUpdate({ billingDetails: billingDetails(), email, name: null }),
    ).toBeNull()
    expect(
      getSavedCardBillingDetailsUpdate({ billingDetails: billingDetails(), email, name: '  ' }),
    ).toBeNull()
  })

  it('leaves the card alone when it has no country', () => {
    expect(
      getSavedCardBillingDetailsUpdate({
        billingDetails: billingDetails({ address: null }),
        email,
        name: 'Mari Maasikas',
      }),
    ).toBeNull()
  })
})
