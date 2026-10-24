import { describe, expect, it } from 'vitest'
import { buildMembershipFunnel, type FunnelUser } from '@/utilities/membershipFunnel'

const now = new Date('2026-10-24T12:00:00.000Z') // a Saturday; its week starts Monday 19.10

const user = (overrides: Partial<FunnelUser>): FunnelUser => ({
  createdAt: '2026-10-20T09:00:00.000Z',
  membershipStatus: 'none',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  trialEndsAt: null,
  ...overrides,
})

describe('buildMembershipFunnel', () => {
  it('counts each funnel step and current membership states', () => {
    const funnel = buildMembershipFunnel(
      [
        user({}),
        user({ stripeCustomerId: 'cus_1' }),
        user({ membershipStatus: 'trialing', stripeCustomerId: 'cus_2', stripeSubscriptionId: 'sub_2', trialEndsAt: '2026-11-03T00:00:00.000Z' }),
        user({ membershipStatus: 'active', stripeCustomerId: 'cus_3', stripeSubscriptionId: 'sub_3', trialEndsAt: '2026-10-01T00:00:00.000Z' }),
        user({ membershipStatus: 'canceled', stripeCustomerId: 'cus_4', stripeSubscriptionId: 'sub_4', trialEndsAt: '2026-10-10T00:00:00.000Z' }),
      ],
      now,
    )

    expect(funnel).toMatchObject({
      ended: 1,
      inTrial: 1,
      openedCheckout: 4,
      paying: 1,
      signups: 5,
      startedTrial: 3,
      trialsConverted: 1,
      trialsFinished: 2,
    })
  })

  it('groups sign-ups into Monday-based weeks, oldest first', () => {
    const funnel = buildMembershipFunnel(
      [
        user({ createdAt: '2026-10-19T00:30:00.000Z' }), // Monday of the current week
        user({ createdAt: '2026-10-18T23:30:00.000Z', stripeCustomerId: 'cus_1' }), // Sunday, previous week
        user({ createdAt: '2026-01-05T10:00:00.000Z' }), // outside the 8-week window
      ],
      now,
    )

    expect(funnel.weeks).toHaveLength(8)
    expect(funnel.weeks[7]).toEqual({ label: '19.10', openedCheckout: 0, paying: 0, signups: 1, startedTrial: 0 })
    expect(funnel.weeks[6]).toEqual({ label: '12.10', openedCheckout: 1, paying: 0, signups: 1, startedTrial: 0 })
    expect(funnel.weeks[0]?.label).toBe('31.08')
    expect(funnel.signups).toBe(3)
  })
})
