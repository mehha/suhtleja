// Accounts registered by the end-to-end tests. Only these are deleted by remove-test-accounts.ts.
export const TEST_ACCOUNT_EMAIL = /^e2e-[a-z0-9]+@suhtleja\.test$/

export const testAccountEmail = (run: string) => `e2e-${run}@suhtleja.test`
