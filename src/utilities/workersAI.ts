import path from 'path'

import { getPayloadCloudflareContext } from './getCloudflareContext'

export type WorkersAI = {
  run: (model: string, inputs: unknown) => Promise<unknown>
}

type AIPlatformProxy = { env: { AI?: WorkersAI } }

let devProxy: Promise<AIPlatformProxy> | null = null

/**
 * The Workers AI binding, or null when it isn't available.
 *
 * Production reads it from the Worker's env. Local dev can't use the app's platform proxy for it: that
 * proxy keeps remote bindings off so D1 and R2 stay local, and Workers AI only runs remotely. Dev opens
 * a second proxy from `wrangler.ai-dev.jsonc`, which has only the AI binding. It needs `wrangler login`
 * and bills the account like production.
 */
export async function getWorkersAI(): Promise<WorkersAI | null> {
  if (process.env.NODE_ENV === 'production') {
    const cloudflare = await getPayloadCloudflareContext()
    return (cloudflare.env as { AI?: WorkersAI }).AI ?? null
  }

  devProxy ??= import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(
    ({ getPlatformProxy }) =>
      getPlatformProxy({
        configPath: path.resolve(process.cwd(), 'wrangler.ai-dev.jsonc'),
        remoteBindings: true,
      }) as Promise<AIPlatformProxy>,
  )

  try {
    return (await devProxy).env.AI ?? null
  } catch (error) {
    devProxy = null
    console.error('Workers AI dev proxy failed', error)
    return null
  }
}
