// app/_components/header/NavMobile.tsx
'use client'

import * as React from 'react'
import { CMSLink } from '@/components/Link'
import type { Header as HeaderType } from '@/payload-types'
import { Menu } from 'lucide-react'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo/Logo'

type Props = { data: HeaderType }

export function NavMobile({ data }: Props) {
  const items = data?.navItems ?? []
  const [open, setOpen] = React.useState(false)

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-[84vw] sm:w-[400px] p-0">
          <SheetHeader className="p-4">
            <SheetTitle><Logo /></SheetTitle>
          </SheetHeader>

          <nav className="p-2">
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
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}
