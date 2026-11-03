import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { istAdmin, istSuperadmin, nurSuperadmin, rolleVon, feldNurSuperadmin, type Rolle } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Mitglied', plural: 'Mitglieder' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'email', 'rolle', 'status'], group: 'Verwaltung' },
  auth: {
    tokenExpiration: 60 * 60 * 24 * 14,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    cookies: { secure: process.env.COOKIE_SECURE !== 'false', sameSite: 'Lax' },
    forgotPassword: {
      generateEmailSubject: () => 'Passwort zurücksetzen',
      // Mitglieder setzen das Passwort im Dashboard, nicht in der Verwaltungsoberfläche
      generateEmailHTML: (args) => {
        const dashboard = (process.env.DASHBOARD_URL || `${process.env.PUBLIC_URL ?? ''}/dashboard`).replace(/\/$/, '')
        const link = `${dashboard}/passwort.html?token=${encodeURIComponent(args?.token ?? '')}`
        return `<p>Hallo,</p><p>für dein Konto wurde ein neues Passwort angefordert. Über diesen Link kannst du es festlegen:</p><p><a href="${link}">Neues Passwort festlegen</a></p><p>Wenn du das nicht angefordert hast, ignoriere diese E-Mail. Dein Passwort bleibt dann unverändert.</p>`
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
      defaultValue: 'mitglied',
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
