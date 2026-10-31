import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`symbol_generations\` ADD \`media_id\` integer REFERENCES media(id) ON DELETE set null;`)
  await db.run(sql`ALTER TABLE \`symbol_generations\` ADD \`shared\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`symbol_generations\` ADD \`personal\` integer DEFAULT false;`)
  await db.run(sql`ALTER TABLE \`symbol_generations\` ADD \`image_hashes\` text;`)
  await db.run(sql`CREATE INDEX \`symbol_generations_media_idx\` ON \`symbol_generations\` (\`media_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_symbol_generations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`user_id\` integer,
  	\`label\` text NOT NULL,
  	\`prompt\` text,
  	\`images\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_symbol_generations\`("id", "user_id", "label", "prompt", "images", "updated_at", "created_at") SELECT "id", "user_id", "label", "prompt", "images", "updated_at", "created_at" FROM \`symbol_generations\`;`)
  await db.run(sql`DROP TABLE \`symbol_generations\`;`)
  await db.run(sql`ALTER TABLE \`__new_symbol_generations\` RENAME TO \`symbol_generations\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`symbol_generations_user_idx\` ON \`symbol_generations\` (\`user_id\`);`)
  await db.run(sql`CREATE INDEX \`symbol_generations_updated_at_idx\` ON \`symbol_generations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`symbol_generations_created_at_idx\` ON \`symbol_generations\` (\`created_at\`);`)
}
