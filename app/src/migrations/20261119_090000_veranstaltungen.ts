import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`veranstaltungen\` (
  	\`id\` text(36) PRIMARY KEY NOT NULL,
  	\`titel\` text NOT NULL,
  	\`beginn\` text NOT NULL,
  	\`ort\` text,
  	\`link\` text NOT NULL,
  	\`beschreibung\` text,
  	\`veroeffentlicht\` integer DEFAULT false,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`veranstaltungen_updated_at_idx\` ON \`veranstaltungen\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`veranstaltungen_created_at_idx\` ON \`veranstaltungen\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`veranstaltungen_id\` text(36) REFERENCES veranstaltungen(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_veranstaltungen_id_idx\` ON \`payload_locked_documents_rels\` (\`veranstaltungen_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX \`payload_locked_documents_rels_veranstaltungen_id_idx\`;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`veranstaltungen_id\`;`)
  await db.run(sql`DROP TABLE \`veranstaltungen\`;`)
}
