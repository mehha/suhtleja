'use client'

import { LogOut, UserRound } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import Link from 'next/link'

import type { InfoLink } from './links'

type UserMenuProps = {
  name: string
  email?: string
  avatarUrl?: string
  onSignOut?: () => void
  isParentMode?: boolean
  infoLinks?: InfoLink[]
}

export function UserMenu({
  name,
  email,
  avatarUrl,
  onSignOut,
  isParentMode,
  infoLinks = [],
}: UserMenuProps) {
  const displayName = name || email || 'Kasutaja'
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const fallbackContent = initials ? initials : <UserRound className="h-4 w-4" aria-hidden="true" />

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Kasutaja menüü"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white bg-slate-900 text-sm font-semibold text-white shadow-sm ring-1 ring-slate-900/25 transition hover:border-accent hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="bg-transparent text-[15px] font-bold text-current">
                    {fallbackContent}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Kasutaja menüü</TooltipContent>
        </Tooltip>

        <DropdownMenuContent
          align="end"
          className="w-56 rounded-2xl border-slate-200 bg-white p-2 text-slate-950 shadow-lg"
        >
          <div className="px-2 pb-2 pt-1">
            <p className="truncate text-sm font-semibold text-slate-950">{displayName}</p>
            {email ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
          </div>

          {isParentMode && (
            <DropdownMenuItem asChild className="rounded-xl text-slate-800 focus:text-slate-950">
              <Link href="/profile" className="flex w-full items-center gap-2">
                <UserRound className="h-4 w-4" />
                Profiil ja liikmelisus
              </Link>
            </DropdownMenuItem>
          )}
          {infoLinks.length > 0 && (
            <>
              <DropdownMenuSeparator className="my-1.5" />
              {infoLinks.map(({ href, label, newTab }) => (
                <DropdownMenuItem
                  key={href}
                  asChild
                  className="rounded-xl text-slate-600 focus:text-slate-950"
                >
                  <Link
                    href={href}
                    className="flex w-full items-center"
                    {...(newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                  >
                    {label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuItem
            className="rounded-xl text-red-600 focus:text-red-700"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
            Logi välja
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}
