import type { ServerProps } from 'payload'
import React from 'react'

import type { User } from '@/payload-types'
import { buildMembershipFunnel, type FunnelUser } from '@/utilities/membershipFunnel'
import { hasMembershipBypassEmail } from '@/utilities/membershipStatus'
import './index.scss'

const percent = (part: number, whole: number): string =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–'

const MembershipFunnel = async ({ payload, user }: ServerProps) => {
  if ((user as User | null | undefined)?.role !== 'admin') return null

  const { docs } = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 0,
    pagination: false,
    select: {
      createdAt: true,
      email: true,
      membershipStatus: true,
      role: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      trialEndsAt: true,
    },
  })

  // Admins and membership-bypass accounts are the owner's own, not customers.
  const customers = docs.filter(
    (doc) => doc.role !== 'admin' && !hasMembershipBypassEmail(doc),
  ) as FunnelUser[]
  const funnel = buildMembershipFunnel(customers)

  const steps = [
    { label: 'Registreerus', value: funnel.signups, rate: null },
    { label: 'Avas Stripe’i lehe', value: funnel.openedCheckout, rate: percent(funnel.openedCheckout, funnel.signups) },
    { label: 'Alustas prooviperioodi', value: funnel.startedTrial, rate: percent(funnel.startedTrial, funnel.signups) },
    { label: 'Maksab praegu', value: funnel.paying, rate: percent(funnel.paying, funnel.signups) },
  ]

  return (
    <section className="membership-funnel">
      <h3 className="membership-funnel__title">Müügilehter</h3>
      <p className="membership-funnel__note">
        Kliendid ilma admini- ja erandkontodeta. Protsent on registreerunutest.
      </p>

      <div className="membership-funnel__steps">
        {steps.map((step) => (
          <div className="membership-funnel__step" key={step.label}>
            <span className="membership-funnel__value">{step.value}</span>
            <span className="membership-funnel__label">{step.label}</span>
            {step.rate && <span className="membership-funnel__rate">{step.rate}</span>}
          </div>
        ))}
      </div>

      <p className="membership-funnel__note">
        Prooviperioodis praegu: {funnel.inTrial} · Lõppenud või makseraskus: {funnel.ended} ·
        Prooviperiood läbi: {funnel.trialsFinished}, neist maksab {funnel.trialsConverted} (
        {percent(funnel.trialsConverted, funnel.trialsFinished)})
      </p>

      <table className="membership-funnel__table">
        <thead>
          <tr>
            <th>Nädal alates</th>
            <th>Registreerus</th>
            <th>Avas Stripe’i lehe</th>
            <th>Alustas prooviperioodi</th>
            <th>Maksab praegu</th>
          </tr>
        </thead>
        <tbody>
          {funnel.weeks.map((week) => (
            <tr key={week.label}>
              <td>{week.label}</td>
              <td>{week.signups}</td>
              <td>{week.openedCheckout}</td>
              <td>{week.startedTrial}</td>
              <td>{week.paying}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="membership-funnel__note">
        Külastused ja allikad:{' '}
        <a href="https://dash.cloudflare.com/?to=/:account/web-analytics" rel="noreferrer" target="_blank">
          Cloudflare Web Analytics
        </a>
        . Maksed ja tellimused:{' '}
        <a href="https://dashboard.stripe.com/subscriptions" rel="noreferrer" target="_blank">
          Stripe
        </a>
        .
      </p>
    </section>
  )
}

export default MembershipFunnel
