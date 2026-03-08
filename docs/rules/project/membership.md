---
title: Membership Rules
description: Stripe checkout + webhook flow for user membership status
tags: [verba, stripe, membership, profile]
---

# Membership (Stripe)

## Scope
- Checkout route: `src/app/(frontend)/next/stripe/checkout/route.ts`
- Webhook route: `src/app/(frontend)/next/stripe/webhook/route.ts`
- Profile UX: `src/app/(frontend)/profile/*`
- User fields: `src/collections/Users/index.ts`

## Core Rules
- Membership state source of truth is Stripe webhooks, not redirect query params.
- Checkout should always create subscription with `trial_period_days: 14`.
- Webhook must update user membership fields:
  - `stripeCustomerId`
  - `stripeSubscriptionId`
  - `membershipStatus`
  - `trialEndsAt`
  - `currentPeriodEndsAt`

## Required Environment
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_MEMBERSHIP`
- `NEXT_PUBLIC_SERVER_URL` (for success/cancel URLs)

## Change Checklist
- If adding new membership statuses, update:
  - webhook status mapping
  - profile status labels
  - users select options
- If changing checkout behavior, keep webhook handling in sync.
