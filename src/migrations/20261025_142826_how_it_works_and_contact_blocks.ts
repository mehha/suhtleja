import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`pages_blocks_how_it_works_steps\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`description\` text,
  	\`media_id\` integer,
  	\`media_aspect_ratio\` text DEFAULT '4/3',
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_how_it_works\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_how_it_works_steps_order_idx\` ON \`pages_blocks_how_it_works_steps\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_how_it_works_steps_parent_id_idx\` ON \`pages_blocks_how_it_works_steps\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_how_it_works_steps_media_idx\` ON \`pages_blocks_how_it_works_steps\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_how_it_works\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`eyebrow\` text,
  	\`title\` text DEFAULT 'Kuidas see töötab',
  	\`intro\` text DEFAULT 'Suhtleja on pilditahvel, mis räägib. Laps puudutab pilti, kuuleb sõna eesti keeles ja saab nii öelda, mida ta tahab, tunneb või vajab. Nii jõuad esimese tahvlini.',
  	\`cta_title\` text DEFAULT 'Proovi Suhtlejat oma lapsega',
  	\`cta_label\` text DEFAULT 'Proovi tasuta',
  	\`cta_href\` text DEFAULT '/register',
  	\`cta_note\` text DEFAULT 'Esimesed 14 päeva on tasuta. Kaarti pole vaja.',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_how_it_works_order_idx\` ON \`pages_blocks_how_it_works\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_how_it_works_parent_id_idx\` ON \`pages_blocks_how_it_works\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_how_it_works_path_idx\` ON \`pages_blocks_how_it_works\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_contact_topics\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`description\` text,
  	\`subject\` text,
  	\`button_label\` text DEFAULT 'Kirjuta meile',
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_contact\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_contact_topics_order_idx\` ON \`pages_blocks_contact_topics\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_contact_topics_parent_id_idx\` ON \`pages_blocks_contact_topics\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_contact\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`intro\` text DEFAULT 'Kirjuta või helista, kui sul on küsimusi, vajad abi seadistamisel või soovid Suhtlejat kasutada lasteaias, koolis või teraapias.',
  	\`email\` text DEFAULT 'info@mehh.ee',
  	\`phone\` text DEFAULT '+372 565 777 69',
  	\`response_note\` text,
  	\`company_name\` text DEFAULT 'Mehh Meedia OÜ',
  	\`company_reg_code\` text DEFAULT '16677696',
  	\`company_address\` text DEFAULT 'Idapõllu tee 5-30, 74001 Haabneeme alevik, Viimsi vald, Harju maakond',
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_contact_order_idx\` ON \`pages_blocks_contact\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_contact_parent_id_idx\` ON \`pages_blocks_contact\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_contact_path_idx\` ON \`pages_blocks_contact\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_how_it_works_steps\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`description\` text,
  	\`media_id\` integer,
  	\`media_aspect_ratio\` text DEFAULT '4/3',
  	\`_uuid\` text,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_how_it_works\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_how_it_works_steps_order_idx\` ON \`_pages_v_blocks_how_it_works_steps\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_how_it_works_steps_parent_id_idx\` ON \`_pages_v_blocks_how_it_works_steps\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_how_it_works_steps_media_idx\` ON \`_pages_v_blocks_how_it_works_steps\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_how_it_works\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`eyebrow\` text,
  	\`title\` text DEFAULT 'Kuidas see töötab',
  	\`intro\` text DEFAULT 'Suhtleja on pilditahvel, mis räägib. Laps puudutab pilti, kuuleb sõna eesti keeles ja saab nii öelda, mida ta tahab, tunneb või vajab. Nii jõuad esimese tahvlini.',
  	\`cta_title\` text DEFAULT 'Proovi Suhtlejat oma lapsega',
  	\`cta_label\` text DEFAULT 'Proovi tasuta',
  	\`cta_href\` text DEFAULT '/register',
  	\`cta_note\` text DEFAULT 'Esimesed 14 päeva on tasuta. Kaarti pole vaja.',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_how_it_works_order_idx\` ON \`_pages_v_blocks_how_it_works\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_how_it_works_parent_id_idx\` ON \`_pages_v_blocks_how_it_works\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_how_it_works_path_idx\` ON \`_pages_v_blocks_how_it_works\` (\`_path\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_contact_topics\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`description\` text,
  	\`subject\` text,
  	\`button_label\` text DEFAULT 'Kirjuta meile',
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_contact\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_contact_topics_order_idx\` ON \`_pages_v_blocks_contact_topics\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_contact_topics_parent_id_idx\` ON \`_pages_v_blocks_contact_topics\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_contact\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`_path\` text NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`intro\` text DEFAULT 'Kirjuta või helista, kui sul on küsimusi, vajad abi seadistamisel või soovid Suhtlejat kasutada lasteaias, koolis või teraapias.',
  	\`email\` text DEFAULT 'info@mehh.ee',
  	\`phone\` text DEFAULT '+372 565 777 69',
  	\`response_note\` text,
  	\`company_name\` text DEFAULT 'Mehh Meedia OÜ',
  	\`company_reg_code\` text DEFAULT '16677696',
  	\`company_address\` text DEFAULT 'Idapõllu tee 5-30, 74001 Haabneeme alevik, Viimsi vald, Harju maakond',
  	\`_uuid\` text,
  	\`block_name\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_contact_order_idx\` ON \`_pages_v_blocks_contact\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_contact_parent_id_idx\` ON \`_pages_v_blocks_contact\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_contact_path_idx\` ON \`_pages_v_blocks_contact\` (\`_path\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`pages_blocks_how_it_works_steps\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_how_it_works\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_contact_topics\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_contact\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_how_it_works_steps\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_how_it_works\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_contact_topics\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_contact\`;`)
}
