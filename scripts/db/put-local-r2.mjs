// Writes downloaded R2 objects into Wrangler's local (Miniflare) R2 state.
// Usage: node scripts/db/put-local-r2.mjs <wrangler-config> <persist-dir> <binding> <source-dir> <keys-file>
import fs from 'node:fs'
import path from 'node:path'
import { getPlatformProxy } from 'wrangler'

const [configPath, persistDir, binding, sourceDir, keysFile] = process.argv.slice(2)

if (!configPath || !persistDir || !binding || !sourceDir || !keysFile) {
  console.error(
    'Usage: node scripts/db/put-local-r2.mjs <wrangler-config> <persist-dir> <binding> <source-dir> <keys-file>',
  )
  process.exit(1)
}

const contentTypes = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
}

const keys = fs.readFileSync(keysFile, 'utf8').split('\n').filter(Boolean)

const proxy = await getPlatformProxy({
  configPath,
  persist: { path: path.join(persistDir, 'v3') },
  remoteBindings: false,
})

try {
  const bucket = proxy.env[binding]

  if (!bucket) {
    throw new Error(`R2 binding '${binding}' not found in ${configPath}.`)
  }

  for (const key of keys) {
    const body = fs.readFileSync(path.join(sourceDir, key))
    const contentType = contentTypes[path.extname(key).toLowerCase()] ?? 'application/octet-stream'

    await bucket.put(key, body, { httpMetadata: { contentType } })

    const stored = await bucket.head(key)

    if (stored?.size !== body.length) {
      throw new Error(`Local R2 size mismatch for '${key}'.`)
    }
  }

  console.log(`Wrote ${keys.length} object(s) to local R2 binding '${binding}'.`)
} finally {
  await proxy.dispose()
}
