// src/utilities/uiMode.ts
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type UiMode = 'child' | 'parent'

export async function getUiMode(): Promise<UiMode> {
  const cookieStore = await cookies()
  const uiModeCookie = cookieStore.get('uiMode')?.value

  return uiModeCookie === 'parent' ? 'parent' : 'child'
}

export async function isParentModeUtil(): Promise<boolean> {
  const mode = await getUiMode()
  return mode === 'parent'
}

export async function requireParentMode() {
  const mode = await getUiMode()

  if (mode !== 'parent') {
    // kui on child-mode või cookie puudub, viska minema
    redirect('/kodu')
  }
}
