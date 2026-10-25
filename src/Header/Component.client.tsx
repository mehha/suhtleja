'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header, User } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { HeaderNav } from '@/Header/Nav'
import { UserMenu } from '@/Header/Nav/UserMenu'
import { NavMobile } from '@/Header/Nav/NavMobile'
import { getClientSideURL } from '@/utilities/getURL'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { House, LogIn } from 'lucide-react'
import { ParentModeToggle } from '@/Header/Nav/ParentModeToggle'

interface HeaderClientProps {
  data: Header
  currentUser: User | null
  isParentMode?: boolean
  hasPin: boolean
}

type MeResponse = {
  user?: User | null
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

  useEffect(() => {
    let cancelled = false

    const syncUser = async () => {
      try {
        const baseUrl = getClientSideURL()
        const res = await fetch(`${baseUrl}/api/users/me`, {
          credentials: 'include',
          cache: 'no-store',
        })

        if (cancelled) return

        if (!res.ok) {
          setClientUser(null)
          return
        }

        const data = (await res.json().catch(() => null)) as MeResponse | null
        setClientUser(data?.user ?? null)
      } catch (err) {
        console.error('Header auth sync failed', err)
      }
    }

    void syncUser()

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
    <header className="container mt-6 relative z-20" {...(theme ? { 'data-theme': theme } : {})}>
      <div className="flex items-center justify-between gap-4 rounded-full bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-black sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
        <div className="flex items-center lg:justify-self-start">
          <Link href="/" className="flex items-center" aria-label="Suhtleja">
            <Logo
              className="origin-left scale-[0.82] sm:scale-90 lg:scale-100"
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
              <ParentModeToggle isParentMode={isParentMode} hasPin={effectiveHasPin} />
              <UserMenu
                name={name}
                email={clientUser.email ?? ''}
                onSignOut={handleSignOut}
                isParentMode={isParentMode}
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
