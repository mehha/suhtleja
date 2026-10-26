import type { TextFieldSingleValidation } from 'payload'

// New accounts need a name: Checkout offers a returning member's saved card only when the card
// has a name, and the checkout route takes it from the account (see docs/rules/project/membership.md).
// Older accounts may have none, so updates (profile, Stripe webhook) don't require it.
export const validateUserName: TextFieldSingleValidation = (value, { operation }) =>
  operation !== 'create' || Boolean(value?.trim()) || 'Sisesta oma nimi.'
