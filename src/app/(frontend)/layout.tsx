import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()

  const { user } = await payload.auth({ headers: requestHeaders })
  const isAdmin = user?.role === 'admin'
  const uiMode = await getUiMode()

  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang="et" suppressHydrationWarning>
      <head>
        <InitTheme />
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
