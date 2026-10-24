import type { Metadata } from 'next'

import type { Media, Page, Post, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'
import { DEFAULT_META_DESCRIPTION, DEFAULT_OG_IMAGE_PATH, HOME_TITLE, SITE_NAME } from './seo'

type MediaWithSizes = Media & {
  sizes?: {
    og?: {
      url?: string | null
    }
  }
}

const getImageURL = (image?: Media | Config['db']['defaultIDType'] | null) => {
  const serverUrl = getServerSideURL()

  let url = serverUrl + DEFAULT_OG_IMAGE_PATH

  if (image && typeof image === 'object' && 'url' in image) {
    const ogUrl = (image as MediaWithSizes).sizes?.og?.url

    url = ogUrl ? serverUrl + ogUrl : serverUrl + (image.thumbnailURL ?? image.url ?? '')
  }

  return url
}

const getCanonicalPath = (path?: string) => {
  if (!path || path === 'home' || path === '/home') {
    return '/'
  }

  return path.startsWith('/') ? path : `/${path}`
}

export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | null
  path?: string
}): Promise<Metadata> => {
  const { doc, path } = args

  const ogImage = getImageURL(doc?.meta?.image)
  const canonicalPath = getCanonicalPath(path)

  const metaTitle = doc?.meta?.title?.trim()
  const docTitle = typeof doc?.title === 'string' ? doc.title.trim() : ''
  // The CMS title of the home page is just "Home", so it gets a descriptive default.
  const isHome = canonicalPath === '/'
  const title = metaTitle || (isHome ? HOME_TITLE : docTitle) || SITE_NAME
  const description = doc?.meta?.description || DEFAULT_META_DESCRIPTION

  return {
    alternates: {
      canonical: canonicalPath,
    },
    description,
    openGraph: mergeOpenGraph({
      description,
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: canonicalPath,
    }),
    // Absolute so the home title never gets the layout's "%s | Suhtleja" template.
    title: isHome ? { absolute: title } : title,
    twitter: {
      card: 'summary_large_image',
      description,
      images: ogImage ? [ogImage] : undefined,
      title,
    },
  }
}
