'use client'

import type { PayloadAdminBarProps, PayloadMeUser } from '@payloadcms/admin-bar'

import { cn } from '@/utilities/ui'
import { usePathname, useSelectedLayoutSegments } from 'next/navigation'
import { PayloadAdminBar } from '@payloadcms/admin-bar'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchClientUser } from '@/utilities/fetchClientUser'
import { useFetchPageOrPost } from '@/utilities/useFetchPageOrPost'

import './index.scss'

import { getClientSideURL } from '@/utilities/getURL'

const baseClass = 'admin-bar'

const collectionLabels = {
  pages: {
    plural: 'Pages',
    singular: 'Page',
  },
  posts: {
    plural: 'Posts',
    singular: 'Post',
  },
  projects: {
    plural: 'Projects',
    singular: 'Project',
  },
}

const Title: React.FC = () => <span>Dashboard</span>

const RESERVED_PAGE_SLUGS = new Set([
  'posts',
  'search',
  'login',
  'register',
  'profile',
  'connect-dots',
  'boards',
  'next',
  'admin',
  'api',
])

const normalizePath = (pathname: string): string => {
  if (pathname === '/') return '/'
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

type AdminBarProps = {
  adminBarProps?: PayloadAdminBarProps
}

// Rendered on every page, including static ones, so the browser decides: the bar and its requests
// only load for admins.
export const AdminBar: React.FC<AdminBarProps> = (props) => {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchClientUser(pathname).then(
      (user) => {
        if (!cancelled) setIsAdmin(user?.role === 'admin')
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [pathname])

  return isAdmin ? <AdminBarContent {...props} /> : null
}

const AdminBarContent: React.FC<AdminBarProps> = (props) => {
  const { adminBarProps } = props || {}
  const segments = useSelectedLayoutSegments()
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const collection = (
    collectionLabels[segments?.[1] as keyof typeof collectionLabels] ? segments[1] : 'pages'
  ) as keyof typeof collectionLabels
  const router = useRouter()

  const normalizedPath = normalizePath(pathname)
  let targetCollection: 'pages' | 'posts' | undefined
  let targetSlug: string | undefined

  if (normalizedPath === '/') {
    targetCollection = 'pages'
    targetSlug = 'home'
  } else if (normalizedPath.startsWith('/posts/')) {
    const slug = normalizedPath.split('/')[2]
    if (slug) {
      targetCollection = 'posts'
      targetSlug = decodeURIComponent(slug)
    }
  } else if (/^\/[^/]+$/.test(normalizedPath)) {
    const slug = decodeURIComponent(normalizedPath.slice(1))
    if (slug && !RESERVED_PAGE_SLUGS.has(slug)) {
      targetCollection = 'pages'
      targetSlug = slug
    }
  }

  const docID = useFetchPageOrPost({
    collection: targetCollection,
    slug: targetSlug,
  })

  const onAuthChange = React.useCallback((user: PayloadMeUser) => {
    setShow(Boolean(user?.id))
  }, [])

  return (
    <div
      className={cn(baseClass, 'py-2 bg-black text-white', {
        block: show,
        hidden: !show,
      })}
    >
      <div className="container">
        <PayloadAdminBar
          {...adminBarProps}
          className="py-2 text-white"
          classNames={{
            controls: 'font-medium text-white',
            logo: 'text-white',
            user: 'text-white',
          }}
          cmsURL={getClientSideURL()}
          collectionSlug={collection}
          collectionLabels={{
            plural: collectionLabels[collection]?.plural || 'Pages',
            singular: collectionLabels[collection]?.singular || 'Page',
          }}
          id={docID}
          logo={<Title />}
          onAuthChange={onAuthChange}
          onPreviewExit={() => {
            fetch('/next/exit-preview').then(() => {
              router.push('/')
              router.refresh()
            })
          }}
          style={{
            backgroundColor: 'transparent',
            padding: 0,
            position: 'relative',
            zIndex: 'unset',
          }}
        />
      </div>
    </div>
  )
}
