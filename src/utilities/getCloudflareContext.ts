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

const getCloudflareContextFromInjectedWrangler = async (): Promise<PayloadCloudflareContext> => {
  const { getPlatformProxy } = await import(
    /* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`
  )

  return getPlatformProxy(
    getPlatformProxyOptions(),
  ) as Promise<PayloadCloudflareContext>
}

export const getPayloadCloudflareContext = async (): Promise<PayloadCloudflareContext> => {
  if (isPayloadCLI() || process.env.NODE_ENV !== 'production') {
    return getCloudflareContextFromInjectedWrangler()
  }

  return getCloudflareContext({ async: true }) as Promise<PayloadCloudflareContext>
}
