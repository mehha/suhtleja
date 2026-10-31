'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import type { Header, User } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { HeaderNav } from '@/Header/Nav'
import { UserMenu } from '@/Header/Nav/UserMenu'
import { NavMobile } from '@/Header/Nav/NavMobile'
import { fetchClientUser } from '@/utilities/fetchClientUser'
import { getClientSideURL } from '@/utilities/getURL'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LogIn } from 'lucide-react'
import { ParentModeToggle } from '@/Header/Nav/ParentModeToggle'
import { AppNav } from '@/Header/Nav/AppNav'
import { appLinks, infoLinks } from '@/Header/Nav/links'
import { cn } from '@/utilities/ui'

// zoom (unlike a scale transform) shrinks the logo's layout box too, so the narrow header doesn't
// keep room for the full-size logo.
const logoClassName = '[zoom:0.82] sm:[zoom:0.9] lg:[zoom:1]'

const subscribeToNothing = () => () => {}
const cookieSaysParentMode = () => /(?:^|;\s*)uiMode=parent(?:;|$)/.test(document.cookie)

// What the header shows of the user. The server passes only this: the whole user document has the
// PIN hash and Stripe ids, and the header is on every page.
export type HeaderUser = Pick<User, 'email' | 'id' | 'name'>

interface HeaderClientProps {
  data: Header
  currentUser: HeaderUser | null
  isParentMode?: boolean
  hasPin: boolean
}

export const HeaderClient: React.FC<HeaderClientProps> = ({
  data,
  currentUser,
  isParentMode,
  hasPin,
}) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()
  const router = useRouter()
  const [clientUser, setClientUser] = useState<HeaderUser | null>(currentUser)
  // /api/users/me has the PIN hash only for admins (it's an admin-only field).
  const [clientHasPin, setClientHasPin] = useState(false)
  // Static pages render in child mode; in the browser the uiMode cookie tells (re-read on every render).
  const parentMode = useSyncExternalStore(
    subscribeToNothing,
    () => Boolean(isParentMode) || cookieSaysParentMode(),
    () => Boolean(isParentMode),
  )
  const [scrolled, setScrolled] = useState(false)

  async function handleSignOut() {
    try {
      const baseUrl = getClientSideURL()

      await fetch(`${baseUrl}/api/users/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch (err) {
      console.error('Logout error', err)
      // isegi kui failib, proovime ikkagi kasutaja "välja lükata"
    } finally {
      if (typeof document !== 'undefined') {
        document.cookie = ['uiMode=', 'path=/', 'max-age=0', 'samesite=lax'].join('; ')
      }

      setClientUser(null)
      router.push('/login')
      router.refresh()
    }
  }

  useEffect(() => {
    setClientUser(currentUser)
  }, [currentUser])

  // The header sticks to the top; once the page scrolls, a deeper shadow lifts it off the content
  // and the logo folds its wordmark away so the bar gets shorter.
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  // Static pages render the header logged out; the browser fills in the user.
  useEffect(() => {
    let cancelled = false

    fetchClientUser(pathname).then(
      (user) => {
        if (cancelled) return
        setClientUser(user)
        setClientHasPin(Boolean(user?.parentPinHash))
      },
      (err) => console.error('Header auth sync failed', err),
    )

    return () => {
      cancelled = true
    }
  }, [pathname])

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  const name = clientUser?.name && true ? clientUser.name : (clientUser?.email ?? '')
  const effectiveHasPin = hasPin || clientHasPin
  const links = useMemo(() => appLinks(parentMode), [parentMode])
  const accountInfoLinks = useMemo(() => infoLinks(data), [data])

  return (
    <header
      className="container pointer-events-none sticky top-3 z-30 mt-6 grid"
      {...(theme ? { 'data-theme': theme } : {})}
    >
      {/* Holds the header's place at full height, so the page doesn't move when the bar shrinks
          (a shrinking sticky header also makes scroll anchoring bounce it open and shut). */}
      <div aria-hidden="true" className="invisible col-start-1 row-start-1 py-3 sm:py-4">
        <Logo className={logoClassName} />
      </div>

      <div
        className={cn(
          'pointer-events-auto col-start-1 row-start-1 flex items-center justify-between gap-3 self-start rounded-full bg-white px-4 py-3 ring-1 ring-gray-900/5 transition-shadow duration-200 dark:bg-black sm:gap-4 sm:p-4 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center',
          scrolled ? 'shadow-lg shadow-slate-900/10' : 'shadow-sm',
        )}
      >
        <div className="flex items-center lg:justify-self-start">
          {/* Logged in, the logo leads to the app's home, like the Kodu link. */}
          <Link href={clientUser ? '/kodu' : '/'} className="flex items-center" aria-label="Suhtleja">
            <Logo className={logoClassName} compact={scrolled} loading="eager" priority="high" />
          </Link>
        </div>

        {clientUser ? (
          <div className="hidden md:flex lg:justify-self-center">
            <AppNav links={links} />
          </div>
        ) : (
          <div className="hidden lg:flex lg:justify-self-center">
            <HeaderNav data={data} />
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-4 lg:justify-self-end">
          {clientUser ? (
            <>
              <ParentModeToggle isParentMode={parentMode} hasPin={effectiveHasPin} />
              <div className="hidden md:block">
                <UserMenu
                  name={name}
                  email={clientUser.email ?? ''}
                  onSignOut={handleSignOut}
                  isParentMode={parentMode}
                  infoLinks={accountInfoLinks}
                />
              </div>
              <NavMobile
                data={data}
                className="md:hidden"
                account={{
                  name,
                  email: clientUser.email ?? '',
                  isParentMode: parentMode,
                  links,
                  infoLinks: accountInfoLinks,
                  onSignOut: handleSignOut,
                }}
              />
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="hidden h-10 shrink-0 items-center whitespace-nowrap rounded-full bg-[#22314c] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#172238] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22314c] focus-visible:ring-offset-2 sm:inline-flex"
              >
                Proovi tasuta
              </Link>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="xs"
                      aria-label="Logi sisse"
                      onClick={() => router.push('/login')}
                    >
                      <LogIn />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Logi sisse</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <NavMobile data={data} className="lg:hidden" />
            </>
          )}
        </div>
      </div>
    </header>
  )
}
