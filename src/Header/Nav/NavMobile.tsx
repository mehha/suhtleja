// app/_components/header/NavMobile.tsx
'use client'

import * as React from 'react'
import { CMSLink } from '@/components/Link'
import type { Header as HeaderType } from '@/payload-types'
import { LogOut, Menu, UserRound } from 'lucide-react'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo/Logo'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/utilities/ui'

import type { AppLink, InfoLink } from './links'

// A logged-in account gets the app's links in the menu instead of the site's.
export type NavMobileAccount = {
  name: string
  email: string
  isParentMode: boolean
  links: AppLink[]
  infoLinks: InfoLink[]
  onSignOut: () => void
}

type Props = { data: HeaderType; account?: NavMobileAccount; className?: string }

const appLinkClassName =
  'flex h-12 w-full items-center gap-3 rounded-xl px-3 text-base font-semibold transition-colors [&_svg]:h-5 [&_svg]:w-5'

export function NavMobile({ data, account, className }: Props) {
  const items = data?.navItems ?? []
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()

  return (
    <div className={className}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Ava menüü">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>

        <SheetContent
          side="right"
          className="flex w-[84vw] max-w-[400px] flex-col overflow-hidden p-0 supports-[width:100dvw]:w-[84dvw]"
        >
          <SheetHeader className="items-start shrink-0 p-4 pr-16 text-left">
            <SheetTitle className="flex justify-start">
              <SheetClose asChild>
                <Link href={account ? '/kodu' : '/'} aria-label="Suhtleja avaleht">
                  <Logo />
                </Link>
              </SheetClose>
            </SheetTitle>
          </SheetHeader>

          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            {account ? (
              <div className="space-y-2">
                <div className="px-3 pb-2">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {account.name || account.email}
                  </p>
                  {account.name && account.email ? (
                    <p className="truncate text-xs text-slate-500">{account.email}</p>
                  ) : null}
                </div>

                <ul className="space-y-1">
                  {account.links.map(({ href, label, icon: Icon, isActive }) => {
                    const active = isActive(pathname)
                    return (
                      <li key={href}>
                        <SheetClose asChild>
                          <Link
                            href={href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              appLinkClassName,
                              active ? 'bg-slate-100 text-slate-950' : 'text-slate-700 hover:bg-slate-50',
                            )}
                          >
                            <Icon aria-hidden="true" />
                            {label}
                          </Link>
                        </SheetClose>
                      </li>
                    )
                  })}
                  {account.isParentMode && (
                    <li>
                      <SheetClose asChild>
                        <Link
                          href="/profile"
                          aria-current={pathname === '/profile' ? 'page' : undefined}
                          className={cn(
                            appLinkClassName,
                            pathname === '/profile'
                              ? 'bg-slate-100 text-slate-950'
                              : 'text-slate-700 hover:bg-slate-50',
                          )}
                        >
                          <UserRound aria-hidden="true" />
                          Profiil ja liikmelisus
                        </Link>
                      </SheetClose>
                    </li>
                  )}
                </ul>

                {account.infoLinks.length > 0 && (
                  <ul className="space-y-1 border-t border-slate-200 pt-2">
                    {account.infoLinks.map(({ href, label, newTab }) => (
                      <li key={href}>
                        <SheetClose asChild>
                          <Link
                            href={href}
                            className="flex h-10 items-center rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                            {...(newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                          >
                            {label}
                          </Link>
                        </SheetClose>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="border-t border-slate-200 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      account.onSignOut()
                    }}
                    className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Logi välja
                  </button>
                </div>
              </div>
            ) : (
              <ul className="space-y-1">
                {items.map((item, i) => {
                  const topLabel =
                    item.label ||
                    item.link?.label ||
                    (typeof item.link?.reference?.value === 'object'
                      ? item.link?.reference?.value?.title
                      : '')

                  // Leaf item
                  return (
                    <li key={i} className="px-3 py-2">
                      <SheetClose asChild>
                        <CMSLink
                          appearance="link"
                          {...(item.link ?? {})}
                          label={topLabel}
                          onClick={() => setOpen(false)}
                        />
                      </SheetClose>
                    </li>
                  )
                })}
              </ul>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}
