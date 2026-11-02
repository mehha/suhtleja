'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { copyBoardForUser } from '@/utilities/copyBoard'
import { withToast } from '@/utilities/flashToast'
import { getCurrentUser } from '@/utilities/getCurrentUser'
import { requireActiveMembership } from '@/utilities/membership'
import { createStarterBoardsForUser } from '@/utilities/starterBoards'
import { requireParentMode } from '@/utilities/uiMode'

// "Tee endale koopia" (Koduhaldus, and a shared board's parent view): the member's own private copy
// of a board they can read, opened in the editor. A failure returns to `returnTo` with a toast.
export async function copyBoard(formData: FormData) {
  await requireParentMode()
  const { payload, user } = await getCurrentUser()
  if (!user) redirect('/admin')
  requireActiveMembership(user)

  const boardId = String(formData.get('boardId') ?? '')
  const rawReturnTo = String(formData.get('returnTo') ?? '')
  // Only a path on this site.
  const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/koduhaldus'

  let copyId: number | null = null
  try {
    copyId = (await copyBoardForUser(payload, user, boardId))?.id ?? null
  } catch (error) {
    console.error('copyBoard failed', error)
  }

  if (copyId === null) redirect(withToast(returnTo, 'error'))

  revalidatePath('/koduhaldus')
  redirect(withToast(`/boards/${copyId}/edit`, 'board-copied'))
}

// "Loo alustuskomplekt" (the "Lisa tahvel" dialog on Kodu and Koduhaldus): the starter set as the
// member's own boards, with their speech made. Opens the core words board, which is on the home.
export async function createStarterBoards(formData: FormData) {
  await requireParentMode()
  const { payload, user } = await getCurrentUser()
  if (!user) redirect('/admin')
  requireActiveMembership(user)

  const rawReturnTo = String(formData.get('returnTo') ?? '')
  const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/koduhaldus'

  let coreId: number | null = null
  try {
    coreId = (await createStarterBoardsForUser(payload, user)).coreId
  } catch (error) {
    console.error('createStarterBoards failed', error)
  }

  revalidatePath('/kodu')
  revalidatePath('/koduhaldus')
  redirect(coreId === null ? withToast(returnTo, 'error') : withToast(`/boards/${coreId}`, 'starter-created'))
}
