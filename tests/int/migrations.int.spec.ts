import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const migrationsDir = path.resolve(__dirname, '../../src/migrations')
const migrationFiles = readdirSync(migrationsDir).filter((file) => /^\d{8}_\d{6}.*\.ts$/.test(file))

// The body of a migration's up(), wherever it sits in the file (some files declare down() first).
function upBody(source: string): string {
  const start = source.indexOf('export async function up')
  if (start === -1) return ''
  const next = source.indexOf('export async function', start + 1)
  return next === -1 ? source.slice(start) : source.slice(start, next)
}

// Names of `__new_<table>` tables a migration's up() creates. Drizzle generates these to rebuild a
// table it can't alter in place (a new column default, dropping a column with a foreign key).
function findTableRebuilds(source: string): string[] {
  return [...upBody(source).matchAll(/CREATE TABLE \\?`(__new_[A-Za-z0-9_]+)\\?`/g)].map((match) => match[1] as string)
}

describe('D1 migrations', () => {
  it('finds rebuilds in up(), whichever function comes first', () => {
    const rebuild = 'await db.run(sql`CREATE TABLE \\`__new_pages_blocks_home\\` (`)'
    const alter = 'await db.run(sql`ALTER TABLE \\`pages\\` ADD \\`x\\` text;`)'
    expect(findTableRebuilds(`export async function up() {\n${rebuild}\n}\nexport async function down() {}`)).toEqual([
      '__new_pages_blocks_home',
    ])
    expect(findTableRebuilds(`export async function down() {\n${rebuild}\n}\nexport async function up() {\n${alter}\n}`)).toEqual([])
    expect(findTableRebuilds(`export async function down() {}\nexport async function up() {\n${rebuild}\n}`)).toEqual([
      '__new_pages_blocks_home',
    ])
  })

  it.each(migrationFiles)('%s does not rebuild a table', (file) => {
    const rebuilds = findTableRebuilds(readFileSync(path.join(migrationsDir, file), 'utf8'))
    expect(
      rebuilds,
      `${file} rebuilds ${rebuilds.join(', ')}. On D1, dropping the old table cascade-deletes its child rows ` +
        '(arrays, blocks, versions). Write the migration by hand with ALTER TABLE ... ADD and CREATE TABLE; see AGENTS.md.',
    ).toEqual([])
  })
})
