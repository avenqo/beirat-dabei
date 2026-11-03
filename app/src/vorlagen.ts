import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Payload } from 'payload'

/** Trägt Impressum und Datenschutzerklärung aus den Vorlagen ein, solange die Felder leer sind. */
export async function vorlagenEintragen(payload: Payload) {
  const verzeichnis = process.env.VORLAGEN_DIR ?? path.resolve(process.cwd(), '../docs/vorlagen')
  try {
    const e = await payload.findGlobal({ slug: 'einstellungen', overrideAccess: true, depth: 0 })
    const neu: { impressum?: string; datenschutz?: string } = {}
    for (const feld of ['impressum', 'datenschutz'] as const) {
      if (!e[feld]) neu[feld] = await readFile(path.join(verzeichnis, `${feld}.md`), 'utf8')
    }
    if (Object.keys(neu).length === 0) return
    await payload.updateGlobal({ slug: 'einstellungen', overrideAccess: true, data: neu })
    payload.logger.info(`beirat-dabei: Vorlagen für ${Object.keys(neu).join(' und ')} eingetragen (Platzhalter noch ausfüllen)`)
  } catch (e) {
    payload.logger.warn(`beirat-dabei: Vorlagen nicht eingetragen: ${(e as Error).message}`)
  }
}
