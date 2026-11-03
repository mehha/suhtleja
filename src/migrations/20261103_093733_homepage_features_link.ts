import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`features_link_label\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`features_link_href\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`features_link_label\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`features_link_href\` text;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`features_link_label\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`features_link_href\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`features_link_label\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`features_link_href\`;`)
}
