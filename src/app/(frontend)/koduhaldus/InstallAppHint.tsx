'use client'

import { Smartphone, X } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'

// Shown until the parent closes it; remembered in this browser only.
export const INSTALL_HINT_DISMISSED_KEY = 'suhtleja:install-hint-dismissed'

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_HINT_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

// An iPad or iPhone browser tab, not the app opened from the home screen. iOS has no install
// prompt of its own, so the parent needs the steps. Only iOS keeps `navigator.standalone`, true in
// the app from the home screen; an iPad reports itself as a Mac, so touch points tell it apart.
export function shouldOfferInstall(nav: Navigator & { standalone?: boolean }, standaloneDisplay: boolean) {
  if (nav.standalone !== false || standaloneDisplay) return false
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1)
}

const noSubscription = () => () => undefined

export function InstallAppHint() {
  const [closed, setClosed] = useState(false)
  // Read in the browser only: the server renders nothing, and so does the first render after it.
  const offer = useSyncExternalStore(
    noSubscription,
    () => shouldOfferInstall(navigator, window.matchMedia('(display-mode: standalone)').matches) && !readDismissed(),
    () => false,
  )

  if (!offer || closed) return null

  const close = () => {
    try {
      window.localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, '1')
    } catch {
      // Private browsing may refuse; the hint still closes for now.
    }
    setClosed(true)
  }

  return (
    <section aria-labelledby="install-app-hint" className="relative rounded-lg border bg-white p-4 pr-12 shadow-sm">
      <h2 className="flex items-center gap-2 font-semibold" id="install-app-hint">
        <Smartphone className="h-5 w-5 text-pink-500" aria-hidden="true" />
        Pane Suhtleja avakuvale
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Siis avaneb Suhtleja oma ikoonilt täisekraanil nagu rakendus, ilma brauseri ribadeta.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        <li>Ava Safaris jagamismenüü: jagamisnupp (ruut noolega) või „⋯“ ja siis „Jaga“.</li>
        <li>Vali „Lisa avakuvale“ ja kinnita.</li>
        <li>Ava Suhtleja avakuvalt ja logi seal üks kord uuesti sisse.</li>
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">
        Et laps jääks Suhtlejasse, lülita sisse juhendatud juurdepääs: Seaded → Hõlbustus → Juhendatud juurdepääs.
      </p>
      <Button
        aria-label="Peida juhis"
        className="absolute right-2 top-2 h-9 w-9"
        onClick={close}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </section>
  )
}
