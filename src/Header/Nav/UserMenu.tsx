'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import Link from 'next/link'

type UserMenuProps = {
  name: string
  email?: string
  avatarUrl?: string
  onSignOut?: () => void
  isParentMode?: boolean // 👈 lisatud
}

export function UserMenu({ name, email, avatarUrl, onSignOut, isParentMode }: UserMenuProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-3">
      {/* Notification bell */}
      {/*<Button*/}
      {/*  variant="ghost"*/}
      {/*  size="icon"*/}
      {/*  className="rounded-full"*/}
      {/*  aria-label="Notifications"*/}
      {/*>*/}
      {/*  <Bell className="h-5 w-5" />*/}
      {/*</Button>*/}

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Avatar className="h-10 w-10 ring-2 ring-offset-2 ring-pink-500">
              <AvatarImage src={avatarUrl} alt={name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-44 rounded-2xl shadow-lg"
        >
          {isParentMode && (
            <>
              <DropdownMenuItem asChild className="rounded-xl">
                <Link href="/profile">Profiil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-xl">
                <Link href="/tegevused">Tegevused</Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            className="text-destructive rounded-xl"
            onClick={onSignOut}
          >
            Logi välja
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
