import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/**
 * False while the page renders on the server and hydrates, true once it runs in the browser: for
 * what only the browser can show (drag and drop) without a hydration mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
