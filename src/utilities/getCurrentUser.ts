import { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'

// One auth per page render: the page and the header both ask, and each ask reads the user from the
// database. React's cache lasts for one render; server actions and route handlers get a fresh read.
export const getCurrentUser = cache(async () => {
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()
  const { user } = await payload.auth({ headers: requestHeaders })
  return { payload, user }
})
