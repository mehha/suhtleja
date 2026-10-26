import type { User } from '@/payload-types'
import { getClientSideURL } from '@/utilities/getURL'

// Public pages are static, so the browser asks who is logged in. The header and the admin bar both
// need it after every navigation; they share one request per key (the pathname).
let last: { key: string; user: Promise<User | null> } | null = null

export function fetchClientUser(key: string): Promise<User | null> {
  if (last?.key === key) return last.user

  const user = fetch(`${getClientSideURL()}/api/users/me`, {
    credentials: 'include',
    cache: 'no-store',
  }).then(async (res) => {
    if (!res.ok) return null
    const data = (await res.json().catch(() => null)) as { user?: User | null } | null
    return data?.user ?? null
  })

  last = { key, user }
  return user
}
