---
title: Analytics Rules
description: Traffic analytics (Cloudflare Web Analytics) and the sign-up to paid funnel in Payload admin
tags: [suhtleja, analytics, funnel, membership]
---

# Analytics

## Scope
- Traffic: Cloudflare Web Analytics, injected by Cloudflare (no code in this repo).
- Funnel logic: `src/utilities/membershipFunnel.ts` (unit tests in `tests/int/membership-funnel.int.spec.ts`).
- Admin dashboard panel: `src/components/MembershipFunnel`, registered as `admin.components.beforeDashboard` in `src/payload.config.ts`.

## Traffic (Cloudflare Web Analytics)
- Site `suhtleja.ee` in Cloudflare account `5e14935f8ec5af079f9a4b1090f57456`, site tag `d4b7081bc76f41dd89d6d02b78415774`.
- The zone is proxied by Cloudflare and the site has automatic setup (`auto_install: true`): Cloudflare injects the beacon into HTML for real browsers and it reports to the site's own `/cdn-cgi/rum`.
- Don't add a manual snippet. Only one snippet may run per page; with both, the injected config makes every beacon use `/cdn-cgi/rum`, and turning automatic setup off makes that endpoint return 404, so nothing is recorded.
- `curl` and other non-browser clients don't get the injected script. Check in a real browser (DevTools or Playwright).
- Cookieless and no personal data, so no consent banner. Mention it in the privacy policy.
- Client-side route changes are tracked automatically (SPA mode).

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
