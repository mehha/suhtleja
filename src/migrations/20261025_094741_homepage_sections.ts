import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'

// Written by hand instead of using the generated table rebuild. On D1, `PRAGMA foreign_keys=OFF`
// has no effect, so the generated `__new_` copy-and-drop of pages_blocks_suhtleja_homepage
// cascade-deletes its array rows (feature items, highlights) and their version history.
//
// This migration only adds columns and tables. The removed "Kellele" fields (audience image,
// checklist and button) keep their columns and table so no stored content is deleted; nothing
// reads them any more. Their copy lives on as fallback text in src/blocks/SuhtlejaHomepage/defaults.ts.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`hero_note\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`audience_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`listen_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`listen_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`listen_title\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`listen_description\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`steps_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`steps_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`steps_title\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`about_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`about_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`about_title\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`about_description\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`about_link_label\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`about_link_href\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_title\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_description\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_plan_name\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_price\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_period\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_cta_label\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_cta_href\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_note\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_institutions_text\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_institutions_label\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`pricing_institutions_href\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`faq_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`faq_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`faq_title\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`closing_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`closing_title\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`closing_description\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`closing_cta_label\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`closing_cta_href\` text;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` ADD \`closing_note\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`hero_note\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`audience_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`listen_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`listen_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`listen_title\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`listen_description\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`steps_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`steps_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`steps_title\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`about_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`about_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`about_title\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`about_description\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`about_link_label\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`about_link_href\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_title\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_description\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_plan_name\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_price\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_period\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_cta_label\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_cta_href\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_note\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_institutions_text\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_institutions_label\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`pricing_institutions_href\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`faq_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`faq_eyebrow\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`faq_title\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`closing_enabled\` integer DEFAULT true;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`closing_title\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`closing_description\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`closing_cta_label\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`closing_cta_href\` text;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` ADD \`closing_note\` text;`)
  await db.run(sql`CREATE TABLE \`pages_blocks_suhtleja_homepage_hero_badges\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_hero_badges_order_idx\` ON \`pages_blocks_suhtleja_homepage_hero_badges\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_hero_badges_parent_id_idx\` ON \`pages_blocks_suhtleja_homepage_hero_badges\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_suhtleja_homepage_audience_cards\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`description\` text,
  	\`link_label\` text,
  	\`link_href\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_audience_cards_order_idx\` ON \`pages_blocks_suhtleja_homepage_audience_cards\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_audience_cards_parent_id_idx\` ON \`pages_blocks_suhtleja_homepage_audience_cards\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_suhtleja_homepage_listen_tiles\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_listen_tiles_order_idx\` ON \`pages_blocks_suhtleja_homepage_listen_tiles\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_listen_tiles_parent_id_idx\` ON \`pages_blocks_suhtleja_homepage_listen_tiles\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_listen_tiles_image_idx\` ON \`pages_blocks_suhtleja_homepage_listen_tiles\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_suhtleja_homepage_steps_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`description\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_steps_items_order_idx\` ON \`pages_blocks_suhtleja_homepage_steps_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_steps_items_parent_id_idx\` ON \`pages_blocks_suhtleja_homepage_steps_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_suhtleja_homepage_about_points\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`description\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_about_points_order_idx\` ON \`pages_blocks_suhtleja_homepage_about_points\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_about_points_parent_id_idx\` ON \`pages_blocks_suhtleja_homepage_about_points\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_suhtleja_homepage_about_testimonials\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`quote\` text,
  	\`name\` text,
  	\`role\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_about_testimonials_order_idx\` ON \`pages_blocks_suhtleja_homepage_about_testimonials\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_about_testimonials_parent_id_idx\` ON \`pages_blocks_suhtleja_homepage_about_testimonials\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_suhtleja_homepage_pricing_includes\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_pricing_includes_order_idx\` ON \`pages_blocks_suhtleja_homepage_pricing_includes\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_pricing_includes_parent_id_idx\` ON \`pages_blocks_suhtleja_homepage_pricing_includes\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`pages_blocks_suhtleja_homepage_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_faq_items_order_idx\` ON \`pages_blocks_suhtleja_homepage_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`pages_blocks_suhtleja_homepage_faq_items_parent_id_idx\` ON \`pages_blocks_suhtleja_homepage_faq_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_suhtleja_homepage_hero_badges\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`text\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_hero_badges_order_idx\` ON \`_pages_v_blocks_suhtleja_homepage_hero_badges\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_hero_badges_parent_id_idx\` ON \`_pages_v_blocks_suhtleja_homepage_hero_badges\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_suhtleja_homepage_audience_cards\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`description\` text,
  	\`link_label\` text,
  	\`link_href\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_audience_cards_order_idx\` ON \`_pages_v_blocks_suhtleja_homepage_audience_cards\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_audience_cards_parent_id_idx\` ON \`_pages_v_blocks_suhtleja_homepage_audience_cards\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_suhtleja_homepage_listen_tiles\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_listen_tiles_order_idx\` ON \`_pages_v_blocks_suhtleja_homepage_listen_tiles\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_listen_tiles_parent_id_idx\` ON \`_pages_v_blocks_suhtleja_homepage_listen_tiles\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_listen_tiles_image_idx\` ON \`_pages_v_blocks_suhtleja_homepage_listen_tiles\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_suhtleja_homepage_steps_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`description\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_steps_items_order_idx\` ON \`_pages_v_blocks_suhtleja_homepage_steps_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_steps_items_parent_id_idx\` ON \`_pages_v_blocks_suhtleja_homepage_steps_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_suhtleja_homepage_about_points\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`description\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_about_points_order_idx\` ON \`_pages_v_blocks_suhtleja_homepage_about_points\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_about_points_parent_id_idx\` ON \`_pages_v_blocks_suhtleja_homepage_about_points\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_suhtleja_homepage_about_testimonials\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`quote\` text,
  	\`name\` text,
  	\`role\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_about_testimonials_order_idx\` ON \`_pages_v_blocks_suhtleja_homepage_about_testimonials\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_about_testimonials_parent_id_idx\` ON \`_pages_v_blocks_suhtleja_homepage_about_testimonials\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_suhtleja_homepage_pricing_includes\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`text\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_pricing_includes_order_idx\` ON \`_pages_v_blocks_suhtleja_homepage_pricing_includes\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_pricing_includes_parent_id_idx\` ON \`_pages_v_blocks_suhtleja_homepage_pricing_includes\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_pages_v_blocks_suhtleja_homepage_faq_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_pages_v_blocks_suhtleja_homepage\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_faq_items_order_idx\` ON \`_pages_v_blocks_suhtleja_homepage_faq_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_pages_v_blocks_suhtleja_homepage_faq_items_parent_id_idx\` ON \`_pages_v_blocks_suhtleja_homepage_faq_items\` (\`_parent_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`_pages_v_blocks_suhtleja_homepage_faq_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_suhtleja_homepage_pricing_includes\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_suhtleja_homepage_about_testimonials\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_suhtleja_homepage_about_points\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_suhtleja_homepage_steps_items\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_suhtleja_homepage_listen_tiles\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_suhtleja_homepage_audience_cards\`;`)
  await db.run(sql`DROP TABLE \`_pages_v_blocks_suhtleja_homepage_hero_badges\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_suhtleja_homepage_faq_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_suhtleja_homepage_pricing_includes\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_suhtleja_homepage_about_testimonials\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_suhtleja_homepage_about_points\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_suhtleja_homepage_steps_items\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_suhtleja_homepage_listen_tiles\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_suhtleja_homepage_audience_cards\`;`)
  await db.run(sql`DROP TABLE \`pages_blocks_suhtleja_homepage_hero_badges\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`hero_note\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`audience_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`listen_enabled\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`listen_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`listen_title\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`listen_description\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`steps_enabled\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`steps_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`steps_title\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`about_enabled\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`about_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`about_title\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`about_description\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`about_link_label\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`about_link_href\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_enabled\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_title\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_description\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_plan_name\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_price\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_period\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_cta_label\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_cta_href\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_note\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_institutions_text\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_institutions_label\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_institutions_href\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`faq_enabled\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`faq_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`faq_title\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`closing_enabled\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`closing_title\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`closing_description\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`closing_cta_label\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`closing_cta_href\`;`)
  await db.run(sql`ALTER TABLE \`pages_blocks_suhtleja_homepage\` DROP COLUMN \`closing_note\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`hero_note\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`audience_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`listen_enabled\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`listen_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`listen_title\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`listen_description\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`steps_enabled\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`steps_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`steps_title\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`about_enabled\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`about_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`about_title\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`about_description\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`about_link_label\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`about_link_href\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_enabled\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_title\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_description\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_plan_name\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_price\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_period\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_cta_label\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_cta_href\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_note\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_institutions_text\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_institutions_label\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`pricing_institutions_href\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`faq_enabled\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`faq_eyebrow\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`faq_title\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`closing_enabled\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`closing_title\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`closing_description\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`closing_cta_label\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`closing_cta_href\`;`)
  await db.run(sql`ALTER TABLE \`_pages_v_blocks_suhtleja_homepage\` DROP COLUMN \`closing_note\`;`)
}
