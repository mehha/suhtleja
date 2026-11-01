// Imports the reviewed picture bank lists (emoji.csv, sonavara.csv) into the media
// library: a "Pildipank" folder with one subfolder per category, and one picture per word with the
// word as its alt text. Words whose picture is still to be generated with AI are skipped.
//
// Local D1/R2:  pnpm payload run scripts/pildipank/import.ts
// Dry run:      PILDIPANK_DRY_RUN=1 pnpm payload run scripts/pildipank/import.ts
// (`payload run` passes no command-line arguments to the script, so options are environment variables.)
// Production needs remote bindings (NODE_ENV=production); run it there only with explicit permission.
//
// Reruns are safe: each picture's file name is derived from its word and source, so an existing
// picture is updated (alt text, category, caption) instead of added again. Nothing is deleted.
// AI pictures come from ai-pildid/ (not in git); a word whose file is missing there is skipped.
// Run one import at a time: two at once store the same pictures twice.
//
// Remove such copies: PILDIPANK_REMOVE_DUPLICATES=1 pnpm payload run scripts/pildipank/import.ts
// It deletes the copies (Payload names a second file `<name>-1.<ext>`, or counts up a name that ends in
// digits: `…-2705.png` becomes `…-2706.png`) after pointing any board card or puzzle that uses one at
// the original.

import fs from 'node:fs'
import path from 'node:path'
import { getPayload, type Payload } from 'payload'

import config from '@payload-config'
import type { Media } from '@/payload-types'
import { PICTURE_BANK_FOLDER_NAME } from '@/utilities/findLibraryMedia'
import {
  buildBankItems,
  captionDocument,
  CATEGORY_ORDER,
  findDuplicateFiles,
  fluentURL,
  parseCsv,
  renderShape,
  renderTextTile,
  sanitizeSvg,
  type BankItem,
} from './lib'

const DIR = path.resolve(process.cwd(), 'scripts/pildipank')
const dryRun = process.env.PILDIPANK_DRY_RUN === '1'

async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'suhtleja-pildipank-import' } }).catch(() => null)
    if (res?.ok) return res
    if (attempt === 4) throw new Error(`${url}: ${res ? `HTTP ${res.status}` : 'network error'}`)
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
  }
}

async function pictureFile(item: BankItem): Promise<{ data: Buffer; mimetype: string; ext: string }> {
  const source = item.source
  if (source.kind === 'ai') {
    const data = fs.readFileSync(path.join(DIR, 'ai-pildid', source.file))
    return { data, ext: path.extname(source.file).slice(1), mimetype: 'image/jpeg' }
  }
  if (source.kind === 'fluent') {
    const res = await fetchWithRetry(fluentURL(source.path))
    return { data: Buffer.from(await res.arrayBuffer()), ext: 'png', mimetype: 'image/png' }
  }
  if (source.kind === 'mulberry') {
    const clean = sanitizeSvg(await (await fetchWithRetry(source.url)).text())
    if (!clean) throw new Error(`${item.word}: the Mulberry SVG could not be made safe`)
    return { data: Buffer.from(clean), ext: 'svg', mimetype: 'image/svg+xml' }
  }
  const markup = source.kind === 'tekst' ? renderTextTile(source.text) : renderShape(source.spec)
  return { data: Buffer.from(markup), ext: 'svg', mimetype: 'image/svg+xml' }
}

const extensionOf = (item: BankItem) =>
  item.source.kind === 'ai' ? path.extname(item.source.file).slice(1) : item.source.kind === 'fluent' ? 'png' : 'svg'

const relationId = (value: unknown): number | null =>
  typeof value === 'object' && value ? (value as { id: number }).id : typeof value === 'number' ? value : null

const captionText = (media: Media): string | null => {
  const paragraph = media.caption?.root?.children?.[0] as { children?: Array<{ text?: string }> } | undefined
  return paragraph?.children?.map((child) => child.text ?? '').join('') || null
}

async function folderId(payload: Payload, name: string, parent: number | null): Promise<number | null> {
  const { docs } = await payload.find({
    collection: 'payload-folders',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: { and: [{ name: { equals: name } }, parent ? { folder: { equals: parent } } : { folder: { exists: false } }] },
  })
  if (docs[0]) return docs[0].id
  if (dryRun) return null

  const folder = await payload.create({
    collection: 'payload-folders',
    data: { folder: parent ?? undefined, folderType: ['media'], name },
    overrideAccess: true,
  })
  console.log(`Folder created: ${parent ? `${PICTURE_BANK_FOLDER_NAME} / ` : ''}${name}`)
  return folder.id
}

async function removeDuplicates(payload: Payload, items: BankItem[]) {
  const { docs } = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 5000,
    overrideAccess: true,
    pagination: false,
    where: { filename: { contains: 'pildipank-' } },
  })
  const byName = new Map(docs.map((media) => [media.filename ?? '', media]))
  const expected = new Set(items.map((item) => `${item.key}.${extensionOf(item)}`))
  const stored = docs.map((media) => ({ alt: media.alt ?? '', name: media.filename ?? '' }))
  const pairs = findDuplicateFiles(expected, stored).map(({ duplicate, original }) => ({
    duplicate: byName.get(duplicate)!,
    original: byName.get(original)!,
  }))
  console.log(`${pairs.length} duplicate pictures${dryRun ? ' (dry run)' : ''}`)
  if (!pairs.length) return

  const replacement = new Map(pairs.map(({ duplicate, original }) => [duplicate.id, original.id]))
  const duplicateIds = [...replacement.keys()]
  const swap = (value: unknown) => {
    const id = relationId(value)
    return id !== null && replacement.has(id) ? replacement.get(id)! : value
  }

  // Anything that started using a copy keeps its picture: point it at the original first. D1 takes
  // at most 100 bound values per query (and Payload binds each `in` value twice), so ask in chunks.
  const idsUsing = async (collection: 'boards' | 'connect-dots-puzzles', field: string) => {
    const ids = new Set<number>()
    for (let start = 0; start < duplicateIds.length; start += 20) {
      const { docs } = await payload.find({
        collection,
        depth: 0,
        limit: 1000,
        overrideAccess: true,
        pagination: false,
        where: { [field]: { in: duplicateIds.slice(start, start + 20) } },
      })
      for (const doc of docs) ids.add(doc.id)
    }
    return [...ids]
  }

  const boardIds = new Set([...(await idsUsing('boards', 'grid.cells.image')), ...(await idsUsing('boards', 'thumbnail'))])
  for (const id of boardIds) {
    const board = await payload.findByID({ collection: 'boards', depth: 0, id, overrideAccess: true })
    const cells = (board.grid?.cells ?? []).map((cell) => ({ ...cell, image: swap(cell.image) as number | null }))
    if (!dryRun) {
      await payload.update({
        collection: 'boards',
        data: { grid: { ...board.grid, cells }, thumbnail: swap(board.thumbnail) as number | null },
        id,
        overrideAccess: true,
      })
    }
    console.log(`Board ${id}: now uses the original pictures`)
  }

  for (const id of await idsUsing('connect-dots-puzzles', 'image')) {
    const puzzle = await payload.findByID({ collection: 'connect-dots-puzzles', depth: 0, id, overrideAccess: true })
    if (!dryRun) {
      await payload.update({
        collection: 'connect-dots-puzzles',
        data: { image: swap(puzzle.image) as number | null },
        id,
        overrideAccess: true,
      })
    }
    console.log(`Puzzle ${id}: now uses the original picture`)
  }

  let removed = 0
  for (const { duplicate } of pairs) {
    if (!dryRun) await payload.delete({ collection: 'media', id: duplicate.id, overrideAccess: true })
    removed++
  }
  console.log(`Done${dryRun ? ' (dry run, nothing written)' : ''}: ${removed} duplicate pictures removed.`)
}

async function main() {
  const read = (name: string) => parseCsv(fs.readFileSync(path.join(DIR, name), 'utf8'))
  const { items, waitingForAI } = buildBankItems(read('emoji.csv'), read('sonavara.csv'))
  console.log(`${items.length} pictures to import, ${waitingForAI.length} words wait for AI pictures${dryRun ? ' (dry run)' : ''}`)

  const payload = await getPayload({ config })

  if (process.env.PILDIPANK_REMOVE_DUPLICATES === '1') {
    await removeDuplicates(payload, items)
    process.exit(0)
  }

  const rootId = await folderId(payload, PICTURE_BANK_FOLDER_NAME, null)
  const categoryIds = new Map<string, number | null>()
  for (const category of CATEGORY_ORDER) {
    if (items.some((item) => item.category === category)) {
      categoryIds.set(category, rootId ? await folderId(payload, category, rootId) : null)
    }
  }

  const { docs: existingDocs } = await payload.find({
    collection: 'media',
    depth: 0,
    limit: 5000,
    overrideAccess: true,
    pagination: false,
    where: { filename: { contains: 'pildipank-' } },
  })
  const existing = new Map(existingDocs.map((media) => [media.filename ?? '', media]))

  const counts = { created: 0, failed: 0, unchanged: 0, updated: 0 }
  const failures: string[] = []
  // AI pictures live in ai-pildid/, which is not in git: on a machine without one, skip that word.
  const missingAIFiles: string[] = []
  for (const [index, item] of items.entries()) {
    const filename = `${item.key}.${extensionOf(item)}`
    const folder = categoryIds.get(item.category) ?? null
    const data = {
      alt: item.word,
      caption: item.caption ? captionDocument(item.caption) : null,
      folder,
    }

    try {
      const media = existing.get(filename)
      if (media) {
        const same =
          media.alt === item.word && relationId(media.folder) === folder && captionText(media) === item.caption
        if (same) counts.unchanged++
        else {
          if (!dryRun) await payload.update({ collection: 'media', data, id: media.id, overrideAccess: true })
          counts.updated++
        }
      } else if (item.source.kind === 'ai' && !fs.existsSync(path.join(DIR, 'ai-pildid', item.source.file))) {
        missingAIFiles.push(item.word)
      } else {
        if (!dryRun) {
          const file = await pictureFile(item)
          const doc = await payload.create({
            collection: 'media',
            data,
            file: { data: file.data, mimetype: file.mimetype, name: filename, size: file.data.length },
            overrideAccess: true,
          })
          if (doc.filename !== filename) {
            console.warn(`${item.word}: stored as ${doc.filename} (a file named ${filename} already existed)`)
          }
        }
        counts.created++
      }
    } catch (error) {
      counts.failed++
      failures.push(`${item.word}: ${(error as Error).message}`)
    }

    if ((index + 1) % 50 === 0) console.log(`${index + 1}/${items.length}`)
  }

  console.log(
    `Done${dryRun ? ' (dry run, nothing written)' : ''}: ${counts.created} created, ${counts.updated} updated, ` +
      `${counts.unchanged} unchanged, ${counts.failed} failed, ${missingAIFiles.length} skipped.`,
  )
  if (missingAIFiles.length) {
    console.log(`Skipped, AI picture file not in ai-pildid/: ${missingAIFiles.length} words (run generate-ai.ts or copy the folder).`)
  }
  if (failures.length) console.log(failures.map((line) => `  ${line}`).join('\n'))
  if (waitingForAI.length) console.log(`Waiting for AI pictures: ${waitingForAI.length} words (sonavara.csv, pilt=AI).`)
  process.exit(counts.failed ? 1 : 0)
}

// `payload run` exits once the module has loaded, so wait here.
await main().catch((error) => {
  console.error(error)
  process.exit(1)
})
