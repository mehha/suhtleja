'use client'

import { unstable_isUnrecognizedActionError } from 'next/navigation'
import React, { useEffect } from 'react'

import { Button } from '@/components/ui/button'

const STALE_ACTION_RELOAD_KEY = 'suhtleja:stale-action-reload'
const STALE_ACTION_RELOAD_GUARD_MS = 10_000

// A page loaded before a deploy still holds the old build's Server Action ids, which the
// server no longer recognizes. Reload once to pick up the new build; the timestamp guard
// stops a reload loop if the error comes straight back.
function reloadOnceForStaleAction() {
  try {
    const lastReload = Number(window.sessionStorage.getItem(STALE_ACTION_RELOAD_KEY))
    if (lastReload && Date.now() - lastReload < STALE_ACTION_RELOAD_GUARD_MS) return
    window.sessionStorage.setItem(STALE_ACTION_RELOAD_KEY, String(Date.now()))
  } catch {
    // Without storage there is no loop guard; leave the reload to the button.
    return
  }
  window.location.reload()
}

export default function FrontendError({ error, retry }: { error: unknown; retry: () => void }) {
  const isStaleAction = unstable_isUnrecognizedActionError(error)

  useEffect(() => {
    if (isStaleAction) {
      reloadOnceForStaleAction()
      return
    }
    console.error(error)
  }, [error, isStaleAction])

  return (
    <div className="container py-28">
      <div className="prose max-w-none">
        <h1 style={{ marginBottom: 0 }}>
          {isStaleAction ? 'Leht uuenes vahepeal' : 'Midagi läks valesti'}
        </h1>
        <p className="mb-4">
          {isStaleAction
            ? 'Suhtlejast tuli vahepeal uus versioon. Laadi leht uuesti ja proovi siis uuesti.'
            : 'Lehte ei õnnestunud laadida. Proovi uuesti.'}
        </p>
      </div>
      {isStaleAction ? (
        <Button onClick={() => window.location.reload()}>Laadi leht uuesti</Button>
      ) : (
        <Button onClick={retry}>Proovi uuesti</Button>
      )}
    </div>
  )
}
