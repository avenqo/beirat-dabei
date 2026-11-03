import type { Access, FieldAccess, PayloadRequest } from 'payload'

export type Rolle = 'superadmin' | 'admin' | 'mitglied'

type MitMitgliedsdaten = { rolle?: Rolle | null; status?: 'aktiv' | 'gesperrt' | null } | null | undefined

export const rolleVon = (user: MitMitgliedsdaten): Rolle | null =>
  user && user.status !== 'gesperrt' ? (user.rolle ?? null) : null

export const istSuperadmin = (req: PayloadRequest) => rolleVon(req.user as MitMitgliedsdaten) === 'superadmin'
export const istAdmin = (req: PayloadRequest) => {
  const r = rolleVon(req.user as MitMitgliedsdaten)
  return r === 'superadmin' || r === 'admin'
}

/** Nur das technische Administratorkonto. */
export const nurSuperadmin: Access = ({ req }) => istSuperadmin(req)
/** Verwaltung: Superadmin und Admin. */
export const nurAdmins: Access = ({ req }) => istAdmin(req)
/** Mitglieder greifen nie direkt zu, sondern über die Endpoints. */
export const niemand: Access = () => false

export const feldNurSuperadmin: FieldAccess = ({ req }) => istSuperadmin(req)
