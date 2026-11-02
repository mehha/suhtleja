'use client'

import { useEffect } from 'react'

import { offlineSupported, registerOfflineWorker, syncOffline } from '@/utilities/offlineCache'

// Let the page settle and the board load its own speech first.
const START_DELAY_MS = 2000

/**
 * On the child's pages (FrontendShell's child view): registers the service worker and brings this
 * device's copy of the child's home, boards, games, speech and pictures up to date, so they work
 * without the network (src/utilities/offlineCache.ts, docs/rules/project/offline.md).
 */
export function OfflineSync() {
  useEffect(() => {
    if (!offlineSupported()) return
    // The copy keeps the build files this page loaded, which the browser lists only up to 250 by
    // default; a board's pictures and speech would push the word forms' part off the list.
    performance.setResourceTimingBufferSize?.(2000)
    registerOfflineWorker()
    if (!navigator.onLine) return
    const timer = window.setTimeout(() => void syncOffline(), START_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return null
}
