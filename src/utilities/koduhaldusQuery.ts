import type { Where } from 'payload'

// Which boards and games Koduhaldus loads (docs/rules/project/boards.md, "/koduhaldus layout").
// A member gets their own and the shared ones. So does an admin, until they open the other users'
// private ones (`?teised=1`): loading every user's boards made the page long and heavy for nothing.

/** The search param that opens the other users' private boards and games (admins only). */
export const KODUHALDUS_OTHERS_PARAM = 'teised'

/** The member's own and the shared ones. */
export const ownOrSharedWhere = (userId: number): Where => ({
  or: [{ owner: { equals: userId } }, { visibleToAllUsers: { equals: true } }],
})

/** Other users' private ones, which an admin can open. A row from before the field was set has none. */
export const othersPrivateWhere = (userId: number): Where => ({
  and: [
    { owner: { not_equals: userId } },
    { or: [{ visibleToAllUsers: { equals: false } }, { visibleToAllUsers: { exists: false } }] },
  ],
})
