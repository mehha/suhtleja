import { execFileSync } from 'child_process'

// Deletes the accounts the member flow test registered in the local database.
export default function globalTeardown() {
  execFileSync('pnpm', ['payload', 'run', 'tests/e2e/remove-test-accounts.ts'], { stdio: 'inherit' })
}
