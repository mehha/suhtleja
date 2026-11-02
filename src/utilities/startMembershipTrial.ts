// Starts a first-time member's trial without the Stripe page (next/stripe/trial, membership.md).
// `trial_used`: the customer had a subscription, so only Checkout, which takes a card, is left.

export type MembershipTrialResult = 'started' | 'trial_used' | 'failed'

const TRIAL_TIMEOUT_MS = 20_000

export async function startMembershipTrial(): Promise<MembershipTrialResult> {
  try {
    const res = await fetch('/next/stripe/trial', {
      method: 'POST',
      credentials: 'include',
      signal: AbortSignal.timeout(TRIAL_TIMEOUT_MS),
    })
    if (res.ok) return 'started'

    const json = (await res.json().catch(() => null)) as { error?: string } | null
    return json?.error === 'trial_used' ? 'trial_used' : 'failed'
  } catch (err) {
    console.error('Starting the trial failed', err)
    return 'failed'
  }
}
