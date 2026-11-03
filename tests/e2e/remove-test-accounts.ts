// Deletes the accounts (and their boards, games and uploaded pictures) that the end-to-end tests
// register in the local database. Customers can't delete their own account, so the tests can't clean
// up through the app. Run with `pnpm payload run tests/e2e/remove-test-accounts.ts`; Playwright's
// global teardown does.
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

  // A delete by `where` reports what it couldn't delete instead of throwing.
  const failures: string[] = []
  let removed = 0
  if (ids.length > 0) {
    // Their pictures go before the users: media.owner_id has no ON DELETE, so an account that still
    // owns a picture can't be deleted.
    for (const collection of ['boards', 'connect-dots-puzzles', 'media'] as const) {
      const result = await payload.delete({ collection, where: { owner: { in: ids } }, overrideAccess: true })
      failures.push(...result.errors.map((error) => `${collection} ${error.id}: ${error.message}`))
    }
    const users = await payload.delete({ collection: 'users', where: { id: { in: ids } }, overrideAccess: true })
    failures.push(...users.errors.map((error) => `users ${error.id}: ${error.message}`))
    removed = users.docs.length
  }

  console.log(`Removed ${removed} of ${ids.length} test account(s).`)
  if (failures.length > 0) {
    console.error(`Could not delete:\n${failures.join('\n')}`)
    process.exitCode = 1
  }
  process.exit()
}
