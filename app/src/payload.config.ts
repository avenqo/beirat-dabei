import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { de } from '@payloadcms/translations/languages/de'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { Benachrichtigungen, Dokumente, Gremien, Medien, Notizen, Sitzungen, Teilnahmen } from './collections/Daten'
import { Einstellungen } from './globals/Einstellungen'
import { endpoints } from './endpoints'
import { emailAdapter } from './email'
import { migrations } from './migrations'
import { laeufeStarten } from './laeufe'
import { vorlagenEintragen } from './vorlagen'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const publicUrl = process.env.PUBLIC_URL ?? 'http://localhost:3000'

export default buildConfig({
  serverURL: publicUrl,
  secret: process.env.PAYLOAD_SECRET || '',
  admin: { user: Users.slug, importMap: { baseDir: path.resolve(dirname) }, meta: { titleSuffix: ' · Beirat dabei' } },
  i18n: { supportedLanguages: { de }, fallbackLanguage: 'de' },
  collections: [Users, Gremien, Sitzungen, Teilnahmen, Notizen, Dokumente, Medien, Benachrichtigungen],
  globals: [Einstellungen],
  endpoints,
  onInit: async (payload) => {
    await vorlagenEintragen(payload)
    laeufeStarten(payload)
  },
  editor: lexicalEditor(),
  email: emailAdapter(),
  csrf: [publicUrl],
  cors: [publicUrl],
  graphQL: { disable: true },
  db: sqliteAdapter({
    idType: 'uuid',
    client: { url: process.env.DATABASE_URL ?? 'file:./data/beirat.db' },
    push: process.env.NODE_ENV !== 'production',
    prodMigrations: migrations,
  }),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
