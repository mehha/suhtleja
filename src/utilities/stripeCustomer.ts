import type { Payload } from 'payload'
import type Stripe from 'stripe'

// The member's Stripe customer, for Checkout and for the trial made at sign-up (membership.md):
// the saved `stripeCustomerId` first, then a lookup by e-mail, else a new customer.

type CustomerUser = { id: number; email: string; stripeCustomerId?: string | null }

export type ResolvedStripeCustomer =
  | { customerId: string; isNewCustomer: boolean }
  | { error: 'multiple_matching_customers' }

export const isMissingStripeResource = (err: unknown): boolean => {
  const stripeErr = err as Stripe.errors.StripeError

  return (
    stripeErr?.type === 'StripeInvalidRequestError' &&
    (stripeErr?.code === 'resource_missing' ||
      stripeErr?.message?.toLowerCase().includes('no such customer'))
  )
}

/** Whether the customer ever had a subscription: they get no second trial. */
export const hasAnySubscription = async (stripe: Stripe, customerId: string): Promise<boolean> => {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 1,
  })

  return subscriptions.data.length > 0
}

/**
 * The user's Stripe customer. A deleted or missing saved customer is stale local state: it is looked
 * up again. Several customers with the user's e-mail and none of them theirs is an error, not a
 * guess. A customer that differs from the saved one is saved, and the old membership fields cleared.
 */
export async function resolveStripeCustomer(
  payload: Payload,
  stripe: Stripe,
  user: CustomerUser,
): Promise<ResolvedStripeCustomer> {
  let customerId = user.stripeCustomerId || undefined
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
      console.warn('Stripe customer lookup blocked due to duplicate customers for email', {
        email: user.email,
        userId: String(user.id),
        customerIds: customersWithSameEmail.map((customer) => customer.id),
      })

      return { error: 'multiple_matching_customers' }
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

  if (customerId !== user.stripeCustomerId) {
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

  return { customerId, isNewCustomer }
}
