import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`boards\` ADD \`tts_cache\` text DEFAULT '{"entries":[],"updatedAt":""}';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`boards\` DROP COLUMN \`tts_cache\`;`)
}
