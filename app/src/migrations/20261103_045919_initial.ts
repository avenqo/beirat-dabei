import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text(36) NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`rolle\` text DEFAULT 'mitglied' NOT NULL,
  	\`status\` text DEFAULT 'aktiv' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`reset_password_requested_at\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`gremien\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`ris_kennung\` text,
  	\`aktiv\` integer DEFAULT true,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`gremien_updated_at_idx\` ON \`gremien\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`gremien_created_at_idx\` ON \`gremien\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`sitzungen\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`gremium_id\` text(36) NOT NULL,
  	\`beginn\` text NOT NULL,
  	\`ort\` text,
  	\`ris_id\` text,
  	\`ris_link\` text,
  	\`to_veroeffentlicht\` integer DEFAULT false,
  	\`to_link\` text,
  	\`abgesagt\` integer DEFAULT false,
  	\`verschoben_von\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`gremium_id\`) REFERENCES \`gremien\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`sitzungen_gremium_idx\` ON \`sitzungen\` (\`gremium_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`sitzungen_ris_id_idx\` ON \`sitzungen\` (\`ris_id\`);`)
  await db.run(sql`CREATE INDEX \`sitzungen_updated_at_idx\` ON \`sitzungen\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`sitzungen_created_at_idx\` ON \`sitzungen\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`teilnahmen\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`sitzung_id\` text(36) NOT NULL,
  	\`mitglied_id\` text(36) NOT NULL,
  	\`eingetragen_am\` text NOT NULL,
  	\`ausgetragen_am\` text,
  	\`nicht_teilgenommen\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`sitzung_id\`) REFERENCES \`sitzungen\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`mitglied_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`teilnahmen_sitzung_idx\` ON \`teilnahmen\` (\`sitzung_id\`);`)
  await db.run(sql`CREATE INDEX \`teilnahmen_mitglied_idx\` ON \`teilnahmen\` (\`mitglied_id\`);`)
  await db.run(sql`CREATE INDEX \`teilnahmen_updated_at_idx\` ON \`teilnahmen\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`teilnahmen_created_at_idx\` ON \`teilnahmen\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`notizen\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`sitzung_id\` text(36) NOT NULL,
  	\`relevant\` integer DEFAULT false,
  	\`antworten\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`sitzung_id\`) REFERENCES \`sitzungen\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`notizen_sitzung_idx\` ON \`notizen\` (\`sitzung_id\`);`)
  await db.run(sql`CREATE INDEX \`notizen_updated_at_idx\` ON \`notizen\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`notizen_created_at_idx\` ON \`notizen\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` text(36) NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` text(36),
  	\`gremien_id\` text(36),
  	\`sitzungen_id\` text(36),
  	\`teilnahmen_id\` text(36),
  	\`notizen_id\` text(36),
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`gremien_id\`) REFERENCES \`gremien\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`sitzungen_id\`) REFERENCES \`sitzungen\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`teilnahmen_id\`) REFERENCES \`teilnahmen\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`notizen_id\`) REFERENCES \`notizen\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_gremien_id_idx\` ON \`payload_locked_documents_rels\` (\`gremien_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_sitzungen_id_idx\` ON \`payload_locked_documents_rels\` (\`sitzungen_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_teilnahmen_id_idx\` ON \`payload_locked_documents_rels\` (\`teilnahmen_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_notizen_id_idx\` ON \`payload_locked_documents_rels\` (\`notizen_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` text(36) NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` text(36),
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`einstellungen\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`name\` text DEFAULT 'Beirat dabei',
  	\`frist_vor_tage\` numeric DEFAULT 7,
  	\`frist_nach_tage\` numeric DEFAULT 3,
  	\`zeitzone\` text DEFAULT 'Europe/Berlin',
  	\`abo_version\` numeric DEFAULT 1,
  	\`notizfragen\` text,
  	\`impressum\` text,
  	\`datenschutz\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`gremien\`;`)
  await db.run(sql`DROP TABLE \`sitzungen\`;`)
  await db.run(sql`DROP TABLE \`teilnahmen\`;`)
  await db.run(sql`DROP TABLE \`notizen\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
  await db.run(sql`DROP TABLE \`einstellungen\`;`)
}
