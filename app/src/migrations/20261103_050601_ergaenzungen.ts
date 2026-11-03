import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`dokumente\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`titel\` text NOT NULL,
  	\`kategorie\` text DEFAULT 'sonstiges',
  	\`datum\` text,
  	\`beschreibung\` text,
  	\`veroeffentlicht\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	\`focal_x\` numeric,
  	\`focal_y\` numeric
  );
  `)
  await db.run(sql`CREATE INDEX \`dokumente_updated_at_idx\` ON \`dokumente\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`dokumente_created_at_idx\` ON \`dokumente\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`dokumente_filename_idx\` ON \`dokumente\` (\`filename\`);`)
  await db.run(sql`CREATE TABLE \`medien\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`alt\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	\`focal_x\` numeric,
  	\`focal_y\` numeric
  );
  `)
  await db.run(sql`CREATE INDEX \`medien_updated_at_idx\` ON \`medien\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`medien_created_at_idx\` ON \`medien\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`medien_filename_idx\` ON \`medien\` (\`filename\`);`)
  await db.run(sql`CREATE TABLE \`benachrichtigungen\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`regel\` text NOT NULL,
  	\`sitzung_id\` text(36) NOT NULL,
  	\`empfaenger_id\` text(36) NOT NULL,
  	\`bezug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`sitzung_id\`) REFERENCES \`sitzungen\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`empfaenger_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`benachrichtigungen_sitzung_idx\` ON \`benachrichtigungen\` (\`sitzung_id\`);`)
  await db.run(sql`CREATE INDEX \`benachrichtigungen_empfaenger_idx\` ON \`benachrichtigungen\` (\`empfaenger_id\`);`)
  await db.run(sql`CREATE INDEX \`benachrichtigungen_updated_at_idx\` ON \`benachrichtigungen\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`benachrichtigungen_created_at_idx\` ON \`benachrichtigungen\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`dokumente_id\` text(36) REFERENCES dokumente(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`medien_id\` text(36) REFERENCES medien(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`benachrichtigungen_id\` text(36) REFERENCES benachrichtigungen(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_dokumente_id_idx\` ON \`payload_locked_documents_rels\` (\`dokumente_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_medien_id_idx\` ON \`payload_locked_documents_rels\` (\`medien_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_benachrichtigungen_id_idx\` ON \`payload_locked_documents_rels\` (\`benachrichtigungen_id\`);`)
  await db.run(sql`ALTER TABLE \`einstellungen\` ADD \`logo_id\` text(36) REFERENCES medien(id);`)
  await db.run(sql`ALTER TABLE \`einstellungen\` ADD \`themenfokus\` text;`)
  await db.run(sql`ALTER TABLE \`einstellungen\` ADD \`ris_adapter\` text DEFAULT 'manuell';`)
  await db.run(sql`ALTER TABLE \`einstellungen\` ADD \`ris_quelle\` text;`)
  await db.run(sql`CREATE INDEX \`einstellungen_logo_idx\` ON \`einstellungen\` (\`logo_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`dokumente\`;`)
  await db.run(sql`DROP TABLE \`medien\`;`)
  await db.run(sql`DROP TABLE \`benachrichtigungen\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
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
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "gremien_id", "sitzungen_id", "teilnahmen_id", "notizen_id") SELECT "id", "order", "parent_id", "path", "users_id", "gremien_id", "sitzungen_id", "teilnahmen_id", "notizen_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_gremien_id_idx\` ON \`payload_locked_documents_rels\` (\`gremien_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_sitzungen_id_idx\` ON \`payload_locked_documents_rels\` (\`sitzungen_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_teilnahmen_id_idx\` ON \`payload_locked_documents_rels\` (\`teilnahmen_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_notizen_id_idx\` ON \`payload_locked_documents_rels\` (\`notizen_id\`);`)
  await db.run(sql`CREATE TABLE \`__new_einstellungen\` (
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
  await db.run(sql`INSERT INTO \`__new_einstellungen\`("id", "name", "frist_vor_tage", "frist_nach_tage", "zeitzone", "abo_version", "notizfragen", "impressum", "datenschutz", "updated_at", "created_at") SELECT "id", "name", "frist_vor_tage", "frist_nach_tage", "zeitzone", "abo_version", "notizfragen", "impressum", "datenschutz", "updated_at", "created_at" FROM \`einstellungen\`;`)
  await db.run(sql`DROP TABLE \`einstellungen\`;`)
  await db.run(sql`ALTER TABLE \`__new_einstellungen\` RENAME TO \`einstellungen\`;`)
}
