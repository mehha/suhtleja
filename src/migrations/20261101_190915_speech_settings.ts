import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` ADD \`speech_voice\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`speech_rate\` text DEFAULT 'normal';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`speech_voice\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`speech_rate\`;`)
}
