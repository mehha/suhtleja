import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`boards_grid_cells\` ADD \`word_class\` text;`)
  await db.run(sql`ALTER TABLE \`boards\` ADD \`extra_word_class_colors\` integer DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`boards_grid_cells\` DROP COLUMN \`word_class\`;`)
  await db.run(sql`ALTER TABLE \`boards\` DROP COLUMN \`extra_word_class_colors\`;`)
}
