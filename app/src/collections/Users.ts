import type { CollectionConfig, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { istAdmin, istSuperadmin, nurSuperadmin, rolleVon, feldNurSuperadmin, type Rolle } from '../access'

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Minuten ohne Aktivität bis zur Abmeldung (ANMELDUNG_MINUTEN, Standard 120, mindestens 5). */
export function anmeldungMinuten(): number {
  const wert = Number(process.env.ANMELDUNG_MINUTEN)
  return Number.isFinite(wert) && wert >= 5 ? Math.round(wert) : 120
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Mitglied', plural: 'Mitglieder' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'email', 'rolle', 'status'], group: 'Verwaltung' },
  auth: {
    // Abmeldung nach so vielen Minuten ohne Aktivität. Dashboard und Verwaltung verlängern die Anmeldung, solange man etwas tut.
    tokenExpiration: anmeldungMinuten() * 60,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    cookies: { secure: process.env.COOKIE_SECURE !== 'false', sameSite: 'Lax' },
    forgotPassword: {
      generateEmailSubject: () => 'Passwort zurücksetzen',
      // Mitglieder setzen das Passwort im Dashboard, nicht in der Verwaltungsoberfläche
      generateEmailHTML: (args) => {
        const dashboard = (process.env.DASHBOARD_URL || `${process.env.PUBLIC_URL ?? ''}/dashboard`).replace(/\/$/, '')
        const link = `${dashboard}/passwort.html?token=${encodeURIComponent(args?.token ?? '')}`
        const name = (args?.user as { name?: string } | undefined)?.name
        const gruss = name ? `Hallo ${esc(name)},` : 'Hallo,'
        return `<!doctype html><html lang="de"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1b1b1b;max-width:36em">
<p>${gruss}</p>
<p>für dein Konto wurde ein neues Passwort angefordert. Über diesen Link kannst du es festlegen. Er gilt eine Stunde.</p>
<p><a href="${esc(link)}" style="display:inline-block;padding:.6em 1.2em;background:#2e7d32;color:#fff;border-radius:6px;text-decoration:none">Neues Passwort festlegen</a></p>
<p>Wenn du das nicht angefordert hast, ignoriere diese E-Mail. Dein Passwort bleibt dann unverändert.</p>
</body></html>`
      },
    },
  },
  access: {
    // Ohne Rolle (nicht angemeldet) oder als Mitglied kommt man nicht in die Verwaltung
    admin: ({ req }) => istAdmin(req),
    // Nur das technische Konto legt Mitglieder an, ändert sie und löscht sie. Admins sehen die Liste.
    create: nurSuperadmin,
    update: nurSuperadmin,
    delete: nurSuperadmin,
    read: ({ req }) => {
      if (istAdmin(req)) return true
      return req.user ? { id: { equals: req.user.id } } : false
    },
  },
  hooks: {
    // „Passwort vergessen“ antwortet nach außen immer gleich. Damit sich im Betrieb eingrenzen lässt,
    // warum keine Mail ankommt, steht im Protokoll, ob es ein passendes Konto gab und ob die Mail raus ist.
    beforeOperation: [
      async ({ args, operation, req }) => {
        if (operation !== 'forgotPassword') return args
        const email = String((args as { data?: { email?: unknown } }).data?.email ?? '').toLowerCase().trim()
        if (!email) return args
        const { docs } = await req.payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
        const konto = docs[0] as { status?: string } | undefined
        if (!konto) req.payload.logger.info(`beirat-dabei: Passwort vergessen: kein Konto mit der Adresse ${email}, keine Mail`)
        else if (konto.status === 'gesperrt') req.payload.logger.info(`beirat-dabei: Passwort vergessen: Konto ${email} ist gesperrt, Anmeldung bleibt auch mit neuem Passwort gesperrt`)
        return args
      },
    ],
    afterForgotPassword: [
      ({ args }) => {
        const a = args as { data?: { email?: unknown }; req?: PayloadRequest }
        a.req?.payload.logger.info(`beirat-dabei: Passwort vergessen: Link an ${String(a.data?.email ?? '').toLowerCase().trim()} verschickt`)
      },
    ],
    // Nach dem Zurücksetzen des Passworts nicht automatisch anmelden (Empfehlung OWASP):
    // Wer nur den Link aus der Mail hat, soll sich mit dem neuen Passwort selbst anmelden.
    // Payload legt beim Zurücksetzen eine Sitzung an und setzt das Cookie. Die Sitzung wird hier
    // wieder entfernt (alle früheren hat Payload schon beendet) und das Token aus der Antwort
    // genommen. Das Cookie bleibt dann leer, man ist auf allen Geräten abgemeldet.
    afterOperation: [
      async ({ operation, result, req }) => {
        if (operation !== 'resetPassword') return result
        const r = result as { token?: string; user?: { id?: string | number; email?: string } }
        const id = r.user?.id
        if (id !== undefined) {
          await req.payload.db.updateOne({ collection: 'users', id, data: { sessions: [] }, req, returning: false })
          req.payload.logger.info(`beirat-dabei: Passwort für ${r.user?.email ?? id} neu gesetzt, alle Sitzungen beendet`)
        }
        return { ...r, token: undefined, user: undefined }
      },
    ],
    beforeLogin: [
      ({ user }) => {
        if ((user as { status?: string }).status === 'gesperrt') {
          throw new APIError('Dieses Konto ist gesperrt.', 403)
        }
      },
    ],
    beforeValidate: [
      async ({ data, operation, req }) => {
        // Die erste Person, die sich registriert, ist das technische Administratorkonto
        if (operation === 'create' && data) {
          const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true })
          if (totalDocs === 0) return { ...data, rolle: 'superadmin' as Rolle, status: 'aktiv' }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    {
      name: 'rolle',
      label: 'Rolle',
      type: 'select',
      // Im Formular für das erste Konto ist das technische Administratorkonto vorgewählt
      defaultValue: async ({ req }: { req: PayloadRequest }) => {
        const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true })
        return totalDocs === 0 ? 'superadmin' : 'mitglied'
      },
      required: true,
      saveToJWT: true,
      options: [
        { label: 'Mitglied', value: 'mitglied' },
        { label: 'Admin', value: 'admin' },
        { label: 'Technisches Administratorkonto', value: 'superadmin' },
      ],
      access: { create: feldNurSuperadmin, update: feldNurSuperadmin },
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      defaultValue: 'aktiv',
      required: true,
      saveToJWT: true,
      options: [
        { label: 'Aktiv', value: 'aktiv' },
        { label: 'Gesperrt', value: 'gesperrt' },
      ],
      access: { create: feldNurSuperadmin, update: feldNurSuperadmin },
    },
  ],
}

export { rolleVon, istSuperadmin }
