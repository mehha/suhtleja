import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache'
import d1NextTagCache from '@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache'

// Public pages are static and live in R2; edits revalidate them through the D1 tag cache. There is no
// queue, so revalidation must expire entries at once (revalidatePath, revalidateTag with expire: 0).
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: d1NextTagCache,
  // Answer cached pages before loading the Next.js server, which matters most on a cold Worker.
  enableCacheInterception: true,
})
