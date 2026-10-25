import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistSans } from 'geist/font/sans'
import { Nunito } from 'next/font/google'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { defaultTheme } from '@/providers/Theme/shared'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode, headers } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { Toaster } from '@/components/ui/sonner'
import { DEFAULT_META_DESCRIPTION, SITE_NAME } from '@/utilities/seo'
import { getUiMode } from '@/utilities/uiMode'
import { FrontendShell } from './FrontendShell'

// Rounded display face for marketing headings; its soft corners echo the logo tiles.
// Only the latin subset is preloaded; the others (latin-ext for š and ž) still load when a page uses them.
const displayFont = Nunito({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()

  const { user } = await payload.auth({ headers: requestHeaders })
  const isAdmin = user?.role === 'admin'
  const uiMode = await getUiMode()

  // scroll-pt: anchor links (/#hind) stop below the sticky header. The theme is always light, so it
  // is set here rather than by a script that would only run once Next.js's JavaScript has loaded.
  return (
    <html
      className={cn(GeistSans.variable, displayFont.variable, 'scroll-pt-[6.5rem] sm:scroll-pt-[7.5rem]')}
      data-theme={defaultTheme}
      lang="et"
      suppressHydrationWarning
    >
      <head>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body className="bg-gray-50 dark:bg-gray-900">
        <Providers>
          <Toaster />
          <FrontendShell
            adminBar={
              isAdmin ? (
                <AdminBar
                  adminBarProps={{
                    preview: isEnabled,
                    createProps: {
                      target: '_self',
                    },
                    editProps: {
                      target: '_self',
                    },
                    logoutProps: {
                      target: '_self',
                    },
                  }}
                />
              ) : null
            }
            footer={<Footer />}
            header={<Header />}
            uiMode={uiMode}
          >
            {children}
          </FrontendShell>
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  description: DEFAULT_META_DESCRIPTION,
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph({
    description: DEFAULT_META_DESCRIPTION,
    title: SITE_NAME,
    url: '/',
  }),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  twitter: {
    card: 'summary_large_image',
    description: DEFAULT_META_DESCRIPTION,
    title: SITE_NAME,
  },
}
