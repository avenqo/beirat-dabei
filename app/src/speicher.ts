import type { Payload } from 'payload'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import type { AbgleichSpeicher, OeffentlichSpeicher, RegelSpeicher } from '@beirat-dabei/handlers'
import type { BekannteSitzung, NeueSitzung, SitzungsAenderung } from '@beirat-dabei/ris-adapter'
import { STANDARD_EINSTELLUNGEN, type Notizfrage, type Versand } from '@beirat-dabei/core'

const STANDARD_FRAGEN: Notizfrage[] = [
  { schluessel: 'relevant', frage: 'War etwas Relevantes für den Beirat dabei?', typ: 'ja-nein', pflicht: true },
  { schluessel: 'tops', frage: 'Welche TOPs waren relevant?', typ: 'text', pflicht: false },
  { schluessel: 'beschluesse', frage: 'Was wurde beschlossen oder vertagt?', typ: 'text', pflicht: false },
]

const id = (v: unknown): string => String(typeof v === 'object' && v !== null ? (v as { id: string | number }).id : v)
const datum = (v: unknown): Date | null => (v ? new Date(v as string) : null)

/**
 * Payload-Anbindung an die Datenschnittstelle der Handler. Die Handler prüfen Rolle,
 * Fristen und Besitz selbst, deshalb läuft der Zugriff hier mit overrideAccess.
 */
export type VollerSpeicher = RegelSpeicher & AbgleichSpeicher & OeffentlichSpeicher

const istMitglied = (rolle: string | null | undefined) => rolle === 'mitglied' || rolle === 'admin'

export function speicherAusPayload(payload: Payload): VollerSpeicher {
  const opt = { overrideAccess: true, pagination: false, depth: 0 } as const
  return {
    async einstellungen() {
      const e = await payload.findGlobal({ slug: 'einstellungen', overrideAccess: true, depth: 0 })
      return {
        einstellungen: {
          fristVorTage: e.fristVorTage ?? STANDARD_EINSTELLUNGEN.fristVorTage,
          fristNachTage: e.fristNachTage ?? STANDARD_EINSTELLUNGEN.fristNachTage,
          zeitzone: e.zeitzone ?? STANDARD_EINSTELLUNGEN.zeitzone,
        },
        notizfragen: (e.notizfragen as Notizfrage[] | null) ?? STANDARD_FRAGEN,
        name: e.name ?? undefined,
        aboVersion: e.aboVersion ?? 1,
      }
    },
    async mitglieder() {
      const r = await payload.find({ collection: 'users', ...opt })
      // Das technische Administratorkonto ist kein Mitglied: kein Dashboard, keine Mails
      return r.docs.filter((u) => istMitglied(u.rolle)).map((u) => ({ id: id(u.id), aktiv: u.status !== 'gesperrt', name: u.name }))
    },
    async sitzungen() {
      const r = await payload.find({ collection: 'sitzungen', ...opt, depth: 1 })
      return r.docs.map((s) => ({
        id: id(s.id),
        gremiumId: id(s.gremium),
        gremiumName: typeof s.gremium === 'object' ? s.gremium.name : '',
        start: new Date(s.beginn),
        abgesagt: Boolean(s.abgesagt),
        toVeroeffentlicht: Boolean(s.toVeroeffentlicht),
        verschobenVon: datum(s.verschobenVon),
        ort: s.ort ?? undefined,
        risLink: s.risLink ?? undefined,
        toLink: s.toLink ?? undefined,
      }))
    },
    async sitzung(sid) {
      const alle = await this.sitzungen()
      return alle.find((s) => s.id === sid) ?? null
    },
    async teilnahmen(sitzungId) {
      const r = await payload.find({
        collection: 'teilnahmen',
        ...opt,
        where: sitzungId ? { sitzung: { equals: sitzungId } } : undefined,
      })
      return r.docs.map((t) => ({
        id: id(t.id),
        sitzungId: id(t.sitzung),
        mitgliedId: id(t.mitglied),
        eingetragenAm: new Date(t.eingetragenAm),
        ausgetragenAm: datum(t.ausgetragenAm),
        nichtTeilgenommen: Boolean(t.nichtTeilgenommen),
      }))
    },
    async teilnahmeAnlegen(d) {
      await payload.create({
        collection: 'teilnahmen',
        overrideAccess: true,
        data: {
          sitzung: d.sitzungId,
          mitglied: d.mitgliedId,
          eingetragenAm: d.eingetragenAm.toISOString(),
          ausgetragenAm: d.ausgetragenAm?.toISOString() ?? null,
          nichtTeilgenommen: d.nichtTeilgenommen,
        },
      })
    },
    async teilnahmeAendern(tid, d) {
      await payload.update({
        collection: 'teilnahmen',
        id: tid,
        overrideAccess: true,
        data: {
          ...(d.eingetragenAm ? { eingetragenAm: d.eingetragenAm.toISOString() } : {}),
          ...(d.ausgetragenAm !== undefined ? { ausgetragenAm: d.ausgetragenAm?.toISOString() ?? null } : {}),
          ...(d.nichtTeilgenommen !== undefined ? { nichtTeilgenommen: d.nichtTeilgenommen } : {}),
        },
      })
    },
    async notizen() {
      const r = await payload.find({ collection: 'notizen', ...opt })
      return r.docs.map((n) => ({
        sitzungId: id(n.sitzung),
        relevant: Boolean(n.relevant),
        antworten: (n.antworten as Record<string, string> | null) ?? {},
      }))
    },
    async notizSpeichern(sitzungId, wert) {
      const vorhanden = await payload.find({ collection: 'notizen', ...opt, where: { sitzung: { equals: sitzungId } }, limit: 1 })
      const data = { sitzung: sitzungId, relevant: wert.relevant, antworten: wert.antworten }
      if (vorhanden.docs[0]) await payload.update({ collection: 'notizen', id: vorhanden.docs[0].id, overrideAccess: true, data })
      else await payload.create({ collection: 'notizen', overrideAccess: true, data })
    },
    async notizLoeschen(sitzungId) {
      const r = await payload.delete({ collection: 'notizen', overrideAccess: true, where: { sitzung: { equals: sitzungId } } })
      return r.docs.length > 0
    },

    async empfaenger() {
      const r = await payload.find({ collection: 'users', ...opt })
      return r.docs
        .filter((u) => istMitglied(u.rolle))
        .map((u) => ({ id: id(u.id), aktiv: u.status !== 'gesperrt', name: u.name || 'Mitglied', email: u.email }))
    },
    async versand(): Promise<Versand[]> {
      const r = await payload.find({ collection: 'benachrichtigungen', ...opt })
      return r.docs.map((z) => ({ regel: z.regel as Versand['regel'], sitzungId: id(z.sitzung), empfaengerId: id(z.empfaenger), bezug: z.bezug ?? '' }))
    },
    async versandSchreiben(eintraege) {
      for (const e of eintraege) {
        await payload.create({
          collection: 'benachrichtigungen',
          overrideAccess: true,
          data: { regel: e.regel, sitzung: e.sitzungId, empfaenger: e.empfaengerId, bezug: e.bezug },
        })
      }
    },
    async risEinstellungen() {
      const e = await payload.findGlobal({ slug: 'einstellungen', overrideAccess: true, depth: 0 })
      return { adapter: e.risAdapter ?? 'manuell', quelle: e.risQuelle ?? '', ...(e.zeitzone ? { zeitzone: e.zeitzone } : {}) }
    },
    async gremien() {
      const r = await payload.find({ collection: 'gremien', ...opt })
      return r.docs.map((g) => ({ id: id(g.id), name: g.name, risKennung: g.risKennung ?? '', aktiv: Boolean(g.aktiv) }))
    },
    async sitzungenBekannt(gremiumId): Promise<BekannteSitzung[]> {
      const r = await payload.find({ collection: 'sitzungen', ...opt, where: { gremium: { equals: gremiumId } } })
      return r.docs.map((z) => ({
        id: id(z.id),
        risId: z.risId ?? null,
        start: new Date(z.beginn),
        ort: z.ort ?? null,
        abgesagt: Boolean(z.abgesagt),
        toVeroeffentlicht: Boolean(z.toVeroeffentlicht),
        toLink: z.toLink ?? null,
        risLink: z.risLink ?? null,
      }))
    },
    async sitzungAnlegen(gremiumId, d: NeueSitzung) {
      await payload.create({
        collection: 'sitzungen',
        overrideAccess: true,
        data: {
          gremium: gremiumId,
          risId: d.risId,
          beginn: d.start.toISOString(),
          ort: d.ort,
          risLink: d.risLink,
          abgesagt: d.abgesagt,
          toVeroeffentlicht: d.toVeroeffentlicht,
          toLink: d.toLink,
        },
      })
    },
    async sitzungAendern(sid, d: Partial<SitzungsAenderung>) {
      const data: Record<string, unknown> = {}
      if (d.start) data['beginn'] = d.start.toISOString()
      if (d.verschobenVon) data['verschobenVon'] = d.verschobenVon.toISOString()
      if (d.ort !== undefined) data['ort'] = d.ort
      if (d.risLink !== undefined) data['risLink'] = d.risLink
      if (d.abgesagt !== undefined) data['abgesagt'] = d.abgesagt
      if (d.toVeroeffentlicht !== undefined) data['toVeroeffentlicht'] = d.toVeroeffentlicht
      if (d.toLink !== undefined) data['toLink'] = d.toLink
      await payload.update({ collection: 'sitzungen', id: sid, overrideAccess: true, data })
    },
    async logoUrl() {
      const e = await payload.findGlobal({ slug: 'einstellungen', overrideAccess: true, depth: 1 })
      const logo = e.logo
      return logo && typeof logo === 'object' && logo.filename ? `/api/medien/file/${encodeURIComponent(logo.filename)}` : null
    },
    async rechtstexte() {
      const e = await payload.findGlobal({ slug: 'einstellungen', overrideAccess: true, depth: 0 })
      return { impressum: e.impressum ?? '', datenschutz: e.datenschutz ?? '' }
    },
    async dokumente() {
      const r = await payload.find({ collection: 'dokumente', ...opt, sort: '-datum' })
      return r.docs.map((z) => ({
        id: id(z.id),
        titel: z.titel,
        kategorie: z.kategorie ?? 'sonstiges',
        datum: z.datum ? String(z.datum).slice(0, 10) : null,
        beschreibung: z.beschreibung ?? null,
        veroeffentlicht: Boolean(z.veroeffentlicht),
        hatDatei: Boolean(z.filename),
        dateiName: z.filename ?? null,
        dateiTyp: z.mimeType ?? null,
        dateiGroesse: z.filesize ?? null,
      }))
    },
    async dateiVonDokument(dokumentId) {
      const z = await payload.findByID({ collection: 'dokumente', id: dokumentId, overrideAccess: true, depth: 0 }).catch(() => null)
      if (!z || !z.veroeffentlicht || !z.filename) return null
      const verzeichnis = path.resolve(process.env.UPLOADS_DIR ?? './data/uploads', 'dokumente')
      const pfad = path.resolve(verzeichnis, path.basename(z.filename))
      if (path.dirname(pfad) !== verzeichnis) return null
      const info = await stat(pfad).catch(() => null)
      if (!info) return null
      return { stream: createReadStream(pfad), typ: z.mimeType || 'application/octet-stream', name: z.filename, groesse: info.size }
    },
  }
}
