import { createHmac } from 'crypto'
import { expect, type APIRequestContext } from '@playwright/test'

import { testAccountEmail } from './testAccounts'

// The PIN a new account gets (the server reads the same `.env*` files, see playwright.config.ts).
export const DEFAULT_PIN = process.env.DEFAULT_PARENT_PIN || '0000'

// What a finished Checkout leads to: Stripe sends a signed customer.subscription.created event for a
// trial, and the webhook gives the account its membership.
export async function startTrial(request: APIRequestContext, userId: number, run: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error('Needs STRIPE_WEBHOOK_SECRET, the same one the local server uses.')

  const now = Math.floor(Date.now() / 1000)
  const trialEnd = now + 14 * 24 * 60 * 60
  const body = JSON.stringify({
    id: `evt_e2e_${run}`,
    object: 'event',
    type: 'customer.subscription.created',
    created: now,
    data: {
      object: {
        id: `sub_e2e_${run}`,
        object: 'subscription',
        customer: `cus_e2e_${run}`,
        status: 'trialing',
        trial_end: trialEnd,
        cancel_at: null,
        cancel_at_period_end: false,
        items: { object: 'list', data: [{ id: `si_e2e_${run}`, object: 'subscription_item', current_period_end: trialEnd }] },
        metadata: { payloadUserId: String(userId) },
      },
    },
  })
  const signature = createHmac('sha256', webhookSecret).update(`${now}.${body}`).digest('hex')
  const response = await request.post('/next/stripe/webhook', {
    data: body,
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${now},v1=${signature}` },
  })
  expect(response.status(), await response.text()).toBe(200)
}

// A member on a trial, made the way the register form makes one (`/api/users`, then the login), so a
// test can start on the member's pages. The request context keeps the login cookie.
export async function createMember(request: APIRequestContext) {
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const email = testAccountEmail(run)
  const password = `e2e-${run}-Passw0rd`

  const created = await request.post('/api/users', { data: { name: 'Testija', email, password } })
  expect(created.status(), await created.text()).toBe(201)
  const login = await request.post('/api/users/login', { data: { email, password } })
  expect(login.status(), await login.text()).toBe(200)
  const { user } = (await login.json()) as { user: { id: number } }

  await startTrial(request, user.id, run)
  return { id: user.id, email, password, run }
}
