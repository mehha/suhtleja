---
title: Membership Rules
description: Stripe checkout + webhook flow for user membership status
tags: [suhtleja, stripe, membership, profile]
---

# Membership (Stripe)

## Scope
- Checkout route: `src/app/(frontend)/next/stripe/checkout/route.ts`
- Billing portal route: `src/app/(frontend)/next/stripe/portal/route.ts`
- Webhook route: `src/app/(frontend)/next/stripe/webhook/route.ts`
- Profile UX: `src/app/(frontend)/profile/*`
- User fields: `src/collections/Users/index.ts`

## Core Rules
- Membership state source of truth is Stripe webhooks, not redirect query params.
- Checkout should always create subscription with `trial_period_days: 14`.
- Membership cancel/manage flow should use Stripe Billing Portal.
- Hide membership-management UI when `membershipStatus` is `none`; show only checkout/upgrade in that state.
- Pending-cancellation profile UI should be driven by `membershipCancelAtPeriodEnd` plus a future `currentPeriodEndsAt`, not only by the current status label.
- Active membership statuses are only `trialing` and `active`.
- In non-production environments only, admin users may bypass membership gates for premium routes and APIs.
- The users with emails `info@mehh.ee` and `pilleriin.pukspuu@gmail.com` bypass membership gates in all environments.
- Premium routes and premium API handlers must enforce membership on the server side.
- Webhook must update user membership fields:
  - `stripeCustomerId`
  - `stripeSubscriptionId`
  - `membershipStatus`
  - `trialEndsAt`
  - `currentPeriodEndsAt`
  - `membershipCancelAtPeriodEnd`
- If subscription is canceled at period end, keep access active until period end,
  but show explicit UI state that membership is ending.

## App-Level Access Rules
- Keep these routes available without membership:
  - `/profile` (upgrade/manage when membership exists, otherwise upgrade only)
  - `/login` and `/register`
  - `/home` (navigation shell)
- Require active membership (`trialing` or `active`) on:
  - `/tools`
  - `/feelings`
  - `/quick-chat`
  - `/connect-dots`
  - `/boards`
  - `/boards/[id]`
  - `/boards/[id]/edit`
  - `/boards/[id]/compounds`
- Require active membership for premium API handlers:
  - `/next/groq`
  - `/next/pexels`
  - `/next/symbols`
  - `/next/tts-ms`
  - `/next/tts-tartu`
- Enforce the same rule at collection access level for premium data:
  - `boards` create/read/update/delete for non-admin users.

## Required Environment
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_MEMBERSHIP`
- `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` (optional)
- `NEXT_PUBLIC_SERVER_URL` (for success/cancel URLs)

## Change Checklist
- If adding new membership statuses, update:
  - webhook status mapping
  - profile status labels
  - users select options
- If changing checkout behavior, keep webhook handling in sync.
