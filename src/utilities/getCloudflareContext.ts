import { CloudflareContext, getCloudflareContext } from '@opennextjs/cloudflare'
import fs from 'fs'
import path from 'path'
import type { R2StorageOptions } from '@payloadcms/storage-r2'
import type { GetPlatformProxyOptions } from 'wrangler'

const payloadBinPath = path.join('payload', 'bin.js')

const resolveRealpath = (value: string): string | null =>
  fs.existsSync(value) ? fs.realpathSync(value) : null

const isPayloadCLI = (): boolean =>
  process.argv.some((value) => resolveRealpath(value)?.endsWith(payloadBinPath) ?? false)

type PayloadCloudflareContext = CloudflareContext & {
  env: CloudflareContext['env'] & {
    D1: Parameters<typeof import('@payloadcms/db-d1-sqlite').sqliteD1Adapter>[0]['binding']
    R2: R2StorageOptions['bucket']
  }
}

const getPlatformProxyOptions = (): GetPlatformProxyOptions => ({
  environment: process.env.CLOUDFLARE_ENV,
  remoteBindings: process.env.NODE_ENV === 'production',
})

// One platform proxy per process. Every getPlatformProxy() call starts another Miniflare with its own
// workerd process, and nothing closes them: next dev made one for each board save, speech file and
// media request, and on CI's runners the dev server and its workerd processes filled the 16 GB in
// 10 minutes of browser tests (2026-11-02). On globalThis, since next dev bundles this module once
// per route and runs it again after an edit.
const PROXY_KEY = Symbol.for('suhtleja.platformProxy')
type ProxyHolder = { [PROXY_KEY]?: Promise<PayloadCloudflareContext> }

const getCloudflareContextFromInjectedWrangler = (): Promise<PayloadCloudflareContext> => {
  const holder = globalThis as ProxyHolder
  return (holder[PROXY_KEY] ??= import(
    /* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`
  )
    .then(
      ({ getPlatformProxy }) =>
        getPlatformProxy(getPlatformProxyOptions()) as Promise<PayloadCloudflareContext>,
    )
    .catch((error: unknown) => {
      // A proxy that failed to start is tried again on the next call.
      delete holder[PROXY_KEY]
      throw error
    }))
}

export const getPayloadCloudflareContext = async (): Promise<PayloadCloudflareContext> => {
  if (isPayloadCLI() || process.env.NODE_ENV !== 'production') {
    return getCloudflareContextFromInjectedWrangler()
  }

  return getCloudflareContext({ async: true }) as Promise<PayloadCloudflareContext>
}
