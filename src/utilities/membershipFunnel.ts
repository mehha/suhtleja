import type { User } from '@/payload-types'

export type FunnelUser = Pick<
  User,
  'createdAt' | 'membershipStatus' | 'stripeCustomerId' | 'stripeSubscriptionId' | 'trialEndsAt'
>

export type FunnelCounts = {
  signups: number
  // Clicked "start trial": checkout creates the Stripe customer before redirecting.
  openedCheckout: number
  // Finished checkout: the webhook stores the subscription id.
  startedTrial: number
  paying: number
}

export type FunnelWeek = FunnelCounts & { label: string }

export type MembershipFunnel = FunnelCounts & {
  inTrial: number
  ended: number
  // Trials whose end date has passed, and how many of those are paying now.
  trialsFinished: number
  trialsConverted: number
  weeks: FunnelWeek[]
}

const DAY_MS = 24 * 60 * 60 * 1000

const startOfWeekUTC = (date: Date): Date => {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const daysSinceMonday = (day.getUTCDay() + 6) % 7
  return new Date(day.getTime() - daysSinceMonday * DAY_MS)
}

const formatWeekLabel = (date: Date): string =>
  `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}`

const emptyCounts = (): FunnelCounts => ({ openedCheckout: 0, paying: 0, signups: 0, startedTrial: 0 })

export const buildMembershipFunnel = (
  users: FunnelUser[],
  now: Date = new Date(),
  weekCount = 8,
): MembershipFunnel => {
  const currentWeek = startOfWeekUTC(now)
  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const start = new Date(currentWeek.getTime() - (weekCount - 1 - index) * 7 * DAY_MS)
    return { ...emptyCounts(), label: formatWeekLabel(start), startTime: start.getTime() }
  })

  const totals = { ...emptyCounts(), ended: 0, inTrial: 0, trialsConverted: 0, trialsFinished: 0 }

  for (const user of users) {
    const openedCheckout = Boolean(user.stripeCustomerId)
    const startedTrial = Boolean(user.stripeSubscriptionId)
    const paying = user.membershipStatus === 'active'
    const trialEnd = user.trialEndsAt ? new Date(user.trialEndsAt) : null

    totals.signups += 1
    if (openedCheckout) totals.openedCheckout += 1
    if (startedTrial) totals.startedTrial += 1
    if (paying) totals.paying += 1
    if (user.membershipStatus === 'trialing') totals.inTrial += 1
    if (user.membershipStatus === 'canceled' || user.membershipStatus === 'past_due') totals.ended += 1
    if (startedTrial && trialEnd && trialEnd.getTime() <= now.getTime()) {
      totals.trialsFinished += 1
      if (paying) totals.trialsConverted += 1
    }

    const week = weeks.find((w) => w.startTime === startOfWeekUTC(new Date(user.createdAt)).getTime())
    if (week) {
      week.signups += 1
      if (openedCheckout) week.openedCheckout += 1
      if (startedTrial) week.startedTrial += 1
      if (paying) week.paying += 1
    }
  }

  return {
    ...totals,
    weeks: weeks.map(({ startTime: _startTime, ...week }) => week),
  }
}
