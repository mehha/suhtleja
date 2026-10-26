// Toasts that survive a redirect. A server action redirects to `withToast(path, key)`, and
// <FlashToast /> (mounted in the frontend layout) shows the message and removes the param.
// Plain module: imported by server actions and by the client component.

export const FLASH_TOASTS = {
  'board-created': { type: 'success', message: 'Tahvel loodud. Lisa sellele kaarte.' },
  'board-pinned': { type: 'success', message: 'Tahvel lisati koduvaatesse.' },
  'board-unpinned': { type: 'success', message: 'Tahvel eemaldati koduvaatest.' },
  'board-shared': { type: 'success', message: 'Tahvel on nüüd kõigile nähtav.' },
  'board-unshared': { type: 'success', message: 'Tahvel pole enam kõigile nähtav.' },
  'board-deleted': { type: 'success', message: 'Tahvel kustutati.' },
  'game-pinned': { type: 'success', message: 'Mäng lisati koduvaatesse.' },
  'game-unpinned': { type: 'success', message: 'Mäng eemaldati koduvaatest.' },
  'game-deleted': { type: 'success', message: 'Mäng kustutati.' },
  'game-saved': { type: 'success', message: 'Mäng salvestatud.' },
  'pin-removed': { type: 'success', message: 'PIN eemaldati. Vaade lülitus lapse vaatesse.' },
  error: { type: 'error', message: 'Midagi läks valesti. Proovi uuesti.' },
} as const satisfies Record<string, { type: 'success' | 'error' | 'info'; message: string }>

export type FlashToastKey = keyof typeof FLASH_TOASTS

export const FLASH_TOAST_PARAM = 'toast'

export function isFlashToastKey(value: string | null): value is FlashToastKey {
  return value !== null && Object.prototype.hasOwnProperty.call(FLASH_TOASTS, value)
}

// `path` may already have a query string or a hash.
export function withToast(path: string, key: FlashToastKey): string {
  const hashIndex = path.indexOf('#')
  const hash = hashIndex === -1 ? '' : path.slice(hashIndex)
  const base = hashIndex === -1 ? path : path.slice(0, hashIndex)
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}${FLASH_TOAST_PARAM}=${key}${hash}`
}

// What a server action that stays on the page returns, so the client can toast the outcome.
export type ActionResult = { ok: true } | { ok: false; error: string }

export const ACTION_ERROR = FLASH_TOASTS.error.message
