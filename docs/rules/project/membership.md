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
- Checkout options come from `src/utilities/membershipCheckout.ts`.
- A customer's first subscription gets a 14-day trial without a card:
  - `payment_method_collection: 'if_required'`
  - `trial_settings.end_behavior.missing_payment_method: 'cancel'`, so Stripe cancels the subscription if no payment method is added before the trial ends. The webhook then sets `membershipStatus` to `canceled`.
  - Trial users add a payment method through the Billing Portal ("Halda liikmelisust"); the profile page tells them so.
- Customers with any previous Stripe subscription (checked with `subscriptions.list`, `status: 'all'`) get no new trial, and Checkout collects a card up front. This stops repeated free trials.
- Checkout offers these returning customers their saved card again: `saved_payment_method_options.allow_redisplay_filters` is `['always', 'limited', 'unspecified']`.
  - Stripe's default shows only cards with `allow_redisplay: 'always'`. Cards saved by a subscription Checkout get `limited`, and cards saved without a redisplay setting (for example through the API) are `unspecified`, so by default none of them would be shown.
  - Checkout shows a saved card only if its `billing_details` include email, name and `address.country` (with `billing_address_collection: auto`). Cards saved by Checkout have them. A card without them stays hidden whatever the filter.
  - Cards added in the Billing Portal get `allow_redisplay: 'limited'` and only `address.country` (checked in the sandbox on 2026-10-25). Before creating the session, the checkout route fills in a missing email and name on the customer's saved cards from the Payload user (`getSavedCardBillingDetailsUpdate`). Users have no name until they set one (registration doesn't ask), so for them the card stays hidden. A failed update is logged and Checkout still opens.
  - Stripe sets these defaults to help with card network rules and data protection consent. Showing `limited`/`unspecified` cards was a deliberate owner decision; revisit it if legal/privacy review says customers must opt in (`saved_payment_method_options.payment_method_save: 'enabled'` with the default filter).
- Stripe Dashboard setup (owner action, live account):
  - Billing Portal must allow payment method updates.
  - Enable trial reminder emails with a link to the Stripe-hosted page under Settings → Billing → Subscriptions and emails → Manage free trial messaging.
- Checkout should treat `stripeCustomerId` as the primary Stripe identity and only use email lookup as a fallback.
- Checkout and portal routes must treat deleted or missing Stripe customers as stale local state, not as unrecoverable server errors.
- If checkout falls back to email lookup, it should:
  - prefer a Stripe customer whose metadata `payloadUserId` matches the current user
  - reuse a single unique email match
  - fail clearly instead of guessing when multiple unrelated Stripe customers share the same email
- Membership cancel/manage flow should use Stripe Billing Portal.
- Hide membership-management UI when `membershipStatus` is `none`; show only checkout/upgrade in that state.
- The frontend header must refresh client-side auth state after route changes so Stripe redirects and login/logout transitions do not require a manual browser refresh.
- Pending-cancellation profile UI should be driven by `membershipCancelAtPeriodEnd` plus a future `currentPeriodEndsAt`, not only by the current status label.
- Active membership statuses are only `trialing` and `active`.
- In non-production environments only, admin users may bypass membership gates for premium routes and APIs.
- `MEMBERSHIP_BYPASS_EMAILS` (comma-separated, case-insensitive) lists accounts that skip the membership gate in every environment, including production.
  - Source: `src/utilities/membershipStatus.ts`. Emails must never be hardcoded in source.
  - Unset or empty means nobody bypasses. Set it as a Cloudflare secret/variable, not in `wrangler.jsonc` or committed files.
  - Treat it as a privileged allowlist: keep it to owner/test accounts and review it when accounts change.
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
  - `/kodu` (navigation shell)
- Require active membership (`trialing` or `active`) on:
  - `/connect-dots`
  - `/koduhaldus`
  - `/boards/[id]`
  - `/boards/[id]/edit`
  - `/boards/[id]/compounds`
- Require active membership for premium API handlers:
  - `/next/groq`
  - `/next/symbols`
  - `/next/tts-ms`
- Enforce the same rule at collection access level for premium data:
  - `boards` create/read/update/delete for non-admin users.

## Required Environment
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_MEMBERSHIP`
- `STRIPE_BILLING_PORTAL_CONFIGURATION_ID` (optional)
- `NEXT_PUBLIC_SERVER_URL` (for success/cancel URLs)
- `MEMBERSHIP_BYPASS_EMAILS` (optional, see Core Rules)

## Local Development
- Use Stripe test mode locally. `.env` holds test-mode values only:
  - `STRIPE_SECRET_KEY=sk_test_…`
  - `STRIPE_PRICE_ID_MEMBERSHIP` set to a test-mode price
  - Never put a live key (`sk_live_…`) in any `.env*` file.
- Production reads `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRICE_ID_MEMBERSHIP` from Cloudflare Worker secrets.
  - Worker secrets take precedence over values from `.env*` files, so local test values never replace them.
  - OpenNext still copies every `.env*` file into the build (`.open-next/cloudflare/next-env.mjs`), so anything in them ships in the Worker bundle.
- Forward webhooks with the Stripe CLI, logged in to the sandbox:
  - `stripe listen --latest --forward-to http://127.0.0.1:3000/next/stripe/webhook`
  - Put the printed `whsec_…` in `.env.local` as `STRIPE_WEBHOOK_SECRET`. It stays the same for the same CLI login.
  - Sandbox events reach local development only through `stripe listen`. The sandbox must not have a webhook endpoint pointing at production (`https://suhtleja.ee/next/stripe/webhook`): production verifies with the live endpoint's secret, so every sandbox event fails there with "No signatures found matching the expected signature" and Stripe retries it for days. The old sandbox endpoint `we_1T8keiCI2glJglFUA0RZNdsl` was disabled on 2026-10-24 for this reason.
  - `--latest` forwards events in the newest API version. Without it, `stripe listen` uses the account default `2019-09-09`, the same version as the live endpoint (`we_1T8m6GCI2glJglFUuFMqPM2E`). Both work: subscription events in `2019-09-09` still include `items[].current_period_end`, which the webhook reads for `currentPeriodEndsAt` (checked on 2026-10-24 with sandbox and live events).
- Test checkout with card `4242 4242 4242 4242`, any future expiry and any CVC.
- `stripe trigger customer.subscription.created` only checks signature verification. Triggered objects have no `payloadUserId`, so no user is updated.
- Cancelling in the Billing Portal sets `cancel_at` instead of `cancel_at_period_end`. The webhook maps a future `cancel_at` to `membershipCancelAtPeriodEnd: true`.
- If checkout returns 409 `multiple_matching_customers`, the sandbox has several customers with the user's email and none has a matching `payloadUserId`. Delete the stale ones in the sandbox.

## Change Checklist
- If adding new membership statuses, update:
  - webhook status mapping
  - profile status labels
  - users select options
- If changing checkout behavior, keep webhook handling in sync.
