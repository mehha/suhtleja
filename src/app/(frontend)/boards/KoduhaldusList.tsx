'use client'

import Link from 'next/link'
import { useRef, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { KODUHALDUS_OTHERS_PARAM } from '@/utilities/koduhaldusQuery'
import { cn } from '@/utilities/ui'
import { copyBoard } from './actions'
import { ConfirmDeleteDialog, type DeleteTarget } from './ConfirmDeleteDialog'

// The rows of Koduhaldus's boards and games (docs/rules/project/boards.md, "/koduhaldus layout"):
// one list layout at every width, not a table. On a phone a row is the name, then its switch and
// buttons; from 640px they share a line.

/** A search box once a list is long enough to need one. */
export const SEARCH_FROM = 9

export function ListSearch({
  count,
  label,
  onChange,
  value,
}: {
  count: number
  label: string
  onChange: (value: string) => void
  value: string
}) {
  if (count < SEARCH_FROM) return null
  return (
    <Input
      aria-label={label}
      className="max-w-xs"
      onChange={(event) => onChange(event.target.value)}
      placeholder={`${label}…`}
      type="search"
      value={value}
    />
  )
}

/** "Minu tahvlid", "Jagatud tahvlid" …: a heading, what the group is, and its rows. */
export function ListGroup({
  action,
  children,
  collapsed,
  description,
  empty,
  title,
}: {
  // Next to the heading (the admin's "Näita" / "Peida").
  action?: ReactNode
  children: ReactNode[]
  // Only the heading: the rows aren't loaded.
  collapsed?: boolean
  description?: string
  // Shown instead of the list when the group has no rows; without it an empty group isn't shown.
  empty?: string
  title: string
}) {
  if (!collapsed && !children.length && !empty) return null
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {collapsed ? null : children.length ? (
        <ul className="divide-y rounded-xl border bg-background">{children}</ul>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

/** One board or game: its name (opens it) with badges, its switches, and its buttons. */
export function ListRow({
  actions,
  badges,
  controls,
  href,
  name,
  subtitle,
}: {
  actions?: ReactNode
  badges?: ReactNode
  controls: ReactNode
  href: string
  name: string
  subtitle?: ReactNode
}) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* At least 24px tall, so a finger finds it on a tablet. */}
          <Link className="inline-block break-words py-0.5 font-medium underline-offset-2 hover:underline" href={href}>
            {name}
          </Link>
          {badges}
        </div>
        {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:shrink-0 sm:justify-end">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{controls}</div>
        {/* The same width on every row from 640px, so the switches line up; empty on a shared game. */}
        <div className={cn('items-center justify-end gap-1 sm:flex sm:w-48', actions ? 'flex' : 'hidden')}>
          {actions}
        </div>
      </div>
    </li>
  )
}

/**
 * The admin's "Teiste kasutajate …" opens and closes with the page's address (`?teised=1`), so the
 * server loads those rows only when asked, and a reload or the back button keeps the choice.
 */
export function OthersToggle({ label, shown }: { label: string; shown: boolean }) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link
        aria-label={`${shown ? 'Peida' : 'Näita'} ${label}`}
        href={shown ? '/koduhaldus' : `/koduhaldus?${KODUHALDUS_OTHERS_PARAM}=1`}
        scroll={false}
      >
        {shown ? 'Peida' : 'Näita'}
      </Link>
    </Button>
  )
}

/** "Muuda": the row's main action, a visible button. */
export function EditButton({ href, name }: { href: string; name: string }) {
  return (
    <Button asChild className="gap-1.5" size="sm" variant="outline">
      <Link aria-label={`Muuda: ${name}`} href={href}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Muuda
      </Link>
    </Button>
  )
}

function CopyMenuItem() {
  const { pending } = useFormStatus()
  return (
    // The menu stays open while the copy is made (its editor opens next), and a second tap does nothing.
    <DropdownMenuItem asChild className="py-2.5" disabled={pending} onSelect={(event) => event.preventDefault()}>
      <button className="w-full" type="submit">
        <Copy aria-hidden="true" />
        {pending ? 'Teen koopiat…' : 'Tee koopia'}
      </button>
    </DropdownMenuItem>
  )
}

/** "…": a row's less used actions, a copy of the board and deleting (which asks first). */
export function RowMenu({
  copy,
  name,
  remove,
}: {
  copy?: { boardId: number; returnTo: string }
  name: string
  remove?: DeleteTarget
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  if (!copy && !remove) return null

  // A press on the button itself isn't outside the menu: its click opens and closes it.
  const onTrigger = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    if (event.target instanceof Node && triggerRef.current?.contains(event.target)) event.preventDefault()
  }

  return (
    <>
      {/* Not modal: a modal menu that opens the dialog left the page without pointer events. */}
      <DropdownMenu modal={false} onOpenChange={setMenuOpen} open={menuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Muud toimingud: ${name}`}
            className="h-9 w-9"
            // It opens on the click, not on the press (Radix's way): a press that turns into a scroll
            // opens nothing, and WebKit on Linux (the CI's iPhone and iPad) followed a tap's touch
            // press with a mouse press, which opened the menu and shut it at once. The keyboard
            // (Enter, Space, arrow down) still goes through Radix.
            onClick={() => setMenuOpen((open) => !open)}
            onPointerDown={(event) => event.preventDefault()}
            ref={triggerRef}
            size="icon"
            variant="ghost"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-44"
          onFocusOutside={onTrigger}
          onPointerDownOutside={onTrigger}
        >
          {copy ? (
            <form action={copyBoard}>
              <input name="boardId" type="hidden" value={copy.boardId} />
              <input name="returnTo" type="hidden" value={copy.returnTo} />
              <CopyMenuItem />
            </form>
          ) : null}
          {remove ? (
            <DropdownMenuItem
              className="py-2.5 text-red-600 focus:bg-red-50 focus:text-red-700"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              Kustuta
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {remove ? <ConfirmDeleteDialog {...remove} name={name} onOpenChange={setDeleteOpen} open={deleteOpen} /> : null}
    </>
  )
}
