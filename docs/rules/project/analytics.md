---
title: Analytics Rules
description: Traffic analytics (Cloudflare Web Analytics) and the sign-up to paid funnel in Payload admin
tags: [suhtleja, analytics, funnel, membership]
---

# Analytics

## Scope
- Traffic beacon: `src/app/(frontend)/layout.tsx`, token in `src/utilities/analytics.ts`.
- Funnel logic: `src/utilities/membershipFunnel.ts` (unit tests in `tests/int/membership-funnel.int.spec.ts`).
- Admin dashboard panel: `src/components/MembershipFunnel`, registered as `admin.components.beforeDashboard` in `src/payload.config.ts`.

## Traffic (Cloudflare Web Analytics)
- Site `suhtleja.ee` in Cloudflare account `5e14935f8ec5af079f9a4b1090f57456`, site tag `d4b7081bc76f41dd89d6d02b78415774`.
- The beacon is embedded manually. Automatic injection did not reach pages served by the Worker for European visitors, so it stays off; never enable both (one snippet per page).
- The beacon renders only when `NODE_ENV === 'production'` and the visitor is not an admin, so local development and the owner's own visits don't count.
- It is cookieless and collects no personal data, so it needs no consent banner. Mention it in the privacy policy.
- Client-side route changes are tracked automatically (SPA mode is the default).

## Funnel (Payload admin dashboard)
- Source: the `users` collection. Admin accounts and `MEMBERSHIP_BYPASS_EMAILS` accounts are excluded.
- Steps:
  - Registreerus: user created.
  - Avas Stripe’i lehe: `stripeCustomerId` set (checkout creates the customer before redirecting).
  - Alustas prooviperioodi: `stripeSubscriptionId` set by the webhook.
  - Maksab praegu: `membershipStatus === 'active'`.
- Trial conversion counts trials whose `trialEndsAt` has passed and how many of those are `active`.
- Weekly rows are Monday-based UTC weeks for the last 8 weeks, by sign-up date. Statuses are current, not historical.
- The panel renders nothing for non-admins, and it queries with the Local API.

## Change Checklist
- If membership fields or statuses change, update `buildMembershipFunnel` and its tests.
- If the funnel adds a step that needs history (for example, when a trial converted), store an event or timestamp; the users table only holds the current state.
