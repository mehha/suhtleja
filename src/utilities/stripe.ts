import Stripe from 'stripe'

const STRIPE_REQUEST_TIMEOUT_MS = 15_000

export const createStripeClient = (apiKey: string) =>
  new Stripe(apiKey, {
    // Cloudflare/OpenNext runs in workerd. Force Stripe to use fetch transport
    // instead of the default Node HTTP client to avoid hanging requests.
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 0,
    telemetry: false,
    timeout: STRIPE_REQUEST_TIMEOUT_MS,
  })
