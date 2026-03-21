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
import { LogIn } from 'lucide-react'
import { ParentModeToggle } from '@/Header/Nav/ParentModeToggle'

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

      router.push('/login')
      router.refresh()
    }
  }

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  const name = currentUser?.name && true ? currentUser.name : (currentUser?.email ?? '')

  return (
    <header className="container mt-6 relative z-20" {...(theme ? { 'data-theme': theme } : {})}>
      <div className="flex items-center justify-between gap-4 rounded-full bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-black sm:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
        <div className="flex items-center lg:justify-self-start">
          <Link href="/" className="flex items-center" aria-label="Suhtleja">
            <Logo loading="eager" priority="high" />
          </Link>
        </div>

        <div className="hidden lg:flex lg:justify-self-center">
          <HeaderNav data={data} />
        </div>

        <div className="flex items-center gap-2 sm:gap-4 lg:justify-self-end">
          {/* ainult siis, kui on sisse loginud */}
          {currentUser ? (
            <>
              <ParentModeToggle isParentMode={isParentMode} hasPin={Boolean(hasPin)} />
              <UserMenu
                name={name}
                email={currentUser.email ?? ''}
                onSignOut={handleSignOut}
                isParentMode={isParentMode}
              />
            </>
          ) : (
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
          )}

          <NavMobile data={data} />
        </div>
      </div>
    </header>
  )
}
