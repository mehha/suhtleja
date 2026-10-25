// Deletes the accounts (and their boards) that member-flow.e2e.spec.ts registers in the local
// database. Customers can't delete their own account, so the tests can't clean up through the app.
// Run with `pnpm payload run tests/e2e/remove-test-accounts.ts`; Playwright's global teardown does.
import { getPayload } from 'payload'
import config from '@payload-config'

import { TEST_ACCOUNT_EMAIL } from './testAccounts'

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to delete accounts outside the local database.')

{
  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'users',
    where: { email: { contains: '@suhtleja.test' } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const ids = found.docs.filter((user) => TEST_ACCOUNT_EMAIL.test(user.email)).map((user) => user.id)

  if (ids.length > 0) {
    await payload.delete({ collection: 'boards', where: { owner: { in: ids } }, overrideAccess: true })
    await payload.delete({ collection: 'users', where: { id: { in: ids } }, overrideAccess: true })
  }
  console.log(`Removed ${ids.length} test account(s).`)
  process.exit(0)
}
