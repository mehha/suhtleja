// Generates the picture bank's AI pictures: one pictogram per sonavara.csv word with
// pilt=AI, in the card editor's pictogram style (buildPictogramPrompt), from its ai_kirjeldus.
// Pictures go to scripts/pildipank/ai-pildid/ (not in git) as 512 px JPEGs, and the word's `viide`
// gets the file name, so import.ts picks them up. Words that already have a picture are skipped.
//
//   pnpm payload run scripts/pildipank/generate-ai.ts
//   PILDIPANK_REDO="kauss,pott" pnpm payload run scripts/pildipank/generate-ai.ts   # new seed for these
//   PILDIPANK_LIMIT=5 ...                                                             # try a few first
//
// Uses Workers AI through `wrangler.ai-dev.jsonc` (needs `wrangler login`) and bills the account:
// about $0.001 per picture.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildPictogramPrompt,
  SYMBOL_GENERATION_MODEL,
  SYMBOL_GENERATION_SIZE,
} from '@/utilities/symbolGeneration'
import { getWorkersAI, type WorkersAI } from '@/utilities/workersAI'
import { aiPictureKey, describesGroup, parseCsv, toCsv, type CsvRow } from './lib'

const DIR = path.resolve(process.cwd(), 'scripts/pildipank')
const CSV = path.join(DIR, 'sonavara.csv')
const OUT = path.join(DIR, 'ai-pildid')
const CONCURRENCY = 4

const redo = new Set((process.env.PILDIPANK_REDO ?? '').split(',').map((w) => w.trim()).filter(Boolean))
const limit = Number(process.env.PILDIPANK_LIMIT || Infinity)

// A seed per word, so a rerun gives the same picture; PILDIPANK_REDO moves to the next seed.
const seedOf = (word: string, attempt: number) =>
  (parseInt(createHash('sha1').update(word).digest('hex').slice(0, 8), 16) + attempt * 7919) % 1_000_000

async function generate(ai: WorkersAI, prompt: string, seed: number): Promise<Buffer> {
  const form = new FormData()
  form.append('prompt', prompt)
  form.append('width', String(SYMBOL_GENERATION_SIZE))
  form.append('height', String(SYMBOL_GENERATION_SIZE))
  form.append('seed', String(seed))
  const body = new Response(form)
  const result = (await ai.run(SYMBOL_GENERATION_MODEL, {
    multipart: { body: body.body, contentType: body.headers.get('content-type') },
  })) as { image?: unknown }
  if (typeof result?.image !== 'string' || !result.image) throw new Error('empty image')
  return Buffer.from(result.image, 'base64')
}

// 768 px from the model, 512 px in the bank: plenty for a card, a third of the bytes.
function saveSmaller(original: Buffer, file: string) {
  const tmp = `${file}.orig.jpg`
  fs.writeFileSync(tmp, original)
  try {
    execFileSync('sips', ['-Z', '512', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', tmp, '--out', file], {
      stdio: 'ignore',
    })
  } catch {
    fs.copyFileSync(tmp, file) // no sips (not macOS): keep the original size
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const text = fs.readFileSync(CSV, 'utf8')
  const columns = text.slice(0, text.indexOf('\n')).split(',')
  const rows = parseCsv(text)

  const todo = rows
    .filter((row) => row['kaasa'] === 'jah' && row['pilt'] === 'AI')
    .filter((row) => redo.has(row['sõna']) || !row['viide'] || !fs.existsSync(path.join(OUT, row['viide'])))
    .slice(0, limit)
  console.log(`${todo.length} pictures to generate`)
  if (!todo.length) return

  const ai = await getWorkersAI()
  if (!ai) throw new Error('Workers AI is not available (run `wrangler login`)')

  const save = () => fs.writeFileSync(CSV, toCsv(rows, columns))
  const failures: string[] = []
  let done = 0

  const work = async (row: CsvRow) => {
    const word = row['sõna']
    const description = row['ai_kirjeldus'] || word
    const attempt = redo.has(word) ? Number(row['märkus'].match(/seemne katse (\d+)/)?.[1] ?? 0) + 1 : 0
    // A redone picture gets a new file name, so the import adds it instead of seeing it as unchanged.
    const file = `${aiPictureKey(word, attempt)}.jpg`
    try {
      const prompt = buildPictogramPrompt(description, { group: describesGroup(description) })
      let image: Buffer | null = null
      for (let tries = 1; !image; tries++) {
        try {
          image = await generate(ai, prompt, seedOf(word, attempt))
        } catch (error) {
          if (tries === 3) throw error
          await new Promise((resolve) => setTimeout(resolve, 2000 * tries))
        }
      }
      saveSmaller(image, path.join(OUT, file))
      row['viide'] = file
      row['märkus'] = attempt ? `AI-pilt, seemne katse ${attempt}` : 'AI-pilt'
    } catch (error) {
      failures.push(`${word}: ${(error as Error).message}`)
    }
    done++
    if (done % 20 === 0 || done === todo.length) {
      save()
      console.log(`${done}/${todo.length}`)
    }
  }

  const queue = [...todo]
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let row = queue.shift(); row; row = queue.shift()) await work(row)
    }),
  )
  save()

  console.log(`Done: ${todo.length - failures.length} generated, ${failures.length} failed.`)
  if (failures.length) console.log(failures.map((line) => `  ${line}`).join('\n'))
}

// `payload run` exits once the module has loaded, so wait here.
await main().catch((error) => {
  console.error(error)
  process.exit(1)
})
process.exit(0)
