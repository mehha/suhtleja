'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useState, useSyncExternalStore } from 'react'

import type { Header, User } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { HeaderNav } from '@/Header/Nav'
import { UserMenu } from '@/Header/Nav/UserMenu'
import { NavMobile } from '@/Header/Nav/NavMobile'
import { fetchClientUser } from '@/utilities/fetchClientUser'
import { getClientSideURL } from '@/utilities/getURL'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { House, LogIn } from 'lucide-react'
import { ParentModeToggle } from '@/Header/Nav/ParentModeToggle'
import { cn } from '@/utilities/ui'

const subscribeToNothing = () => () => {}
const cookieSaysParentMode = () => /(?:^|;\s*)uiMode=parent(?:;|$)/.test(document.cookie)

interface HeaderClientProps {
  data: Header
  currentUser: User | null
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
  const [clientUser, setClientUser] = useState<User | null>(currentUser)
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

  // The header sticks to the top; once the page scrolls, a deeper shadow lifts it off the content.
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
        if (!cancelled) setClientUser(user)
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
  const effectiveHasPin = Boolean(clientUser?.parentPinHash || hasPin)

  return (
    <header className="container sticky top-3 z-30 mt-6" {...(theme ? { 'data-theme': theme } : {})}>
      <div
        className={cn(
          'flex items-center justify-between gap-4 rounded-full bg-white px-4 py-3 ring-1 ring-gray-900/5 transition-shadow duration-200 dark:bg-black sm:p-4 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center',
          scrolled ? 'shadow-lg shadow-slate-900/10' : 'shadow-sm',
        )}
      >
        <div className="flex items-center lg:justify-self-start">
          <Link href="/" className="flex items-center" aria-label="Suhtleja">
            {/* -my-1.5 drops the space the phone-size scale leaves empty (68px box, 56px logo). */}
            <Logo
              className="-my-1.5 origin-left scale-[0.82] sm:my-0 sm:scale-90 lg:scale-100"
              loading="eager"
              priority="high"
            />
          </Link>
        </div>

        <div className="hidden lg:flex lg:justify-self-center">
          <HeaderNav data={data} />
        </div>

        <div className="flex items-center gap-2 sm:gap-4 lg:justify-self-end">
          {/* ainult siis, kui on sisse loginud */}
          {clientUser ? (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      aria-label="Kodu"
                      className="h-10 w-10 rounded-full border border-slate-300 bg-white p-0 text-slate-800 shadow-sm hover:bg-accent hover:text-accent-foreground [&_svg]:h-[18px] [&_svg]:w-[18px]"
                    >
                      <Link href="/home">
                        <House aria-hidden="true" />
                        <span className="sr-only">Kodu</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Kodu</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <ParentModeToggle isParentMode={parentMode} hasPin={effectiveHasPin} />
              <UserMenu
                name={name}
                email={clientUser.email ?? ''}
                onSignOut={handleSignOut}
                isParentMode={parentMode}
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
            </>
          )}

          <NavMobile data={data} />
        </div>
      </div>
    </header>
  )
}
