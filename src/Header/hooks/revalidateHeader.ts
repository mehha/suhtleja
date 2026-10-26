import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'

export const revalidateHeader: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating header`)

    // Expire at once: there is no background revalidation queue (open-next.config.ts), so a
    // stale-while-revalidate ('max') entry would keep being served stale.
    revalidateTag('global_header', { expire: 0 })
  }

  return doc
}
