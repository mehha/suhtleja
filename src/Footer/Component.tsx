import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import type { Footer } from '@/payload-types'

// import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'

export async function Footer() {
  const footerData: Footer = await getCachedGlobal('footer', 1)()

  const navItems = footerData?.navItems || []

  return (
    <footer className="mt-auto bg-[#22314c] text-white dark:bg-card">
      <div className="container flex flex-col gap-8 py-8 lg:flex-row lg:items-center lg:justify-between">
        <Link className="flex items-center" href="/">
          <Logo className="rounded-[22px] bg-white px-3 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.22)]" />
        </Link>

        <div className="flex min-w-0 flex-col-reverse items-start gap-4 lg:flex-row lg:items-center">
          {/*<ThemeSelector />*/}
          {/* Six links don't fit beside the logo on a tablet, so they sit below it and wrap. */}
          <nav className="flex flex-col gap-4 md:flex-row md:flex-wrap md:gap-x-6 md:gap-y-3 lg:justify-end">
            {navItems.map(({ link }, i) => {
              return <CMSLink className="font-semibold text-white/85 hover:text-white" key={i} {...link} />
            })}
          </nav>
        </div>
      </div>
    </footer>
  )
}
