import type { MetadataRoute } from 'next'

import { webAppManifest } from '@/utilities/webAppManifest'

// /manifest.webmanifest: Next.js links it from every page. See src/utilities/webAppManifest.ts.
export default function manifest(): MetadataRoute.Manifest {
  return webAppManifest()
}
