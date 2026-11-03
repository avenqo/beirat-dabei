import { Cron } from 'croner'
import type { Payload } from 'payload'
import { abgleichAusfuehren, regellaufAusfuehren, type Modus } from '@beirat-dabei/handlers'
import { standardHttp } from '@beirat-dabei/ris-adapter'
import { speicherAusPayload } from './speicher'

const modus = (wert: string | undefined): Modus => (wert === 'aus' || wert === 'scharf' ? wert : 'trocken')
const zahl = (wert: string | undefined, standard: number) => (Number.isFinite(Number(wert)) && wert ? Number(wert) : standard)

interface Zustand {
  gestartet?: boolean
  timer?: NodeJS.Timeout
  regellauf?: () => Promise<void>
}
const zustand: Zustand = ((globalThis as Record<string, unknown>).__beiratLaeufe ??= {}) as Zustand

/** Teilnahme geändert: Regeln kurz danach prüfen, damit R2 und R4 nicht bis zum nächsten Morgen warten. */
export function regellaufBald() {
  if (!zustand.regellauf) return
  clearTimeout(zustand.timer)
  zustand.timer = setTimeout(() => void zustand.regellauf?.(), 10_000)
}

/** Zeitpläne für Regellauf und RIS-Abgleich. Wird beim Start von Payload aufgerufen. */
export function laeufeStarten(payload: Payload) {
  if (zustand.gestartet || process.env.NEXT_PHASE === 'phase-production-build') return
  zustand.gestartet = true

  const env = process.env
  const geheimnis = env.MAGIC_LINK_SECRET
  const publicUrl = env.PUBLIC_URL
  if (!geheimnis || !publicUrl) throw new Error('MAGIC_LINK_SECRET und PUBLIC_URL müssen gesetzt sein.')
  const log = {
    info: (m: string) => payload.logger.info(`beirat-dabei: ${m}`),
    error: (e: unknown, m: string) => payload.logger.error({ err: e }, `beirat-dabei: ${m}`),
  }
  const zeitzone = env.TZ || 'Europe/Berlin'
  const speicher = speicherAusPayload(payload)
  const regelnModus = modus(env.REGELN_MODUS)
  const risModus = modus(env.RIS_MODUS)

  const regellauf = () =>
    regellaufAusfuehren({
      speicher,
      mailer: {
        async senden({ an, betreff, text, html }) {
          await payload.sendEmail({ to: an, subject: betreff, text, html })
        },
      },
      jetzt: () => new Date(),
      modus: regelnModus,
      mail: {
        dashboardUrl: (env.DASHBOARD_URL || `${publicUrl.replace(/\/$/, '')}/dashboard`).replace(/\/$/, ''),
        geheimnis,
        nachlaufTage: zahl(env.MAGIC_LINK_NACHLAUF_TAGE, 14),
        dauerStunden: zahl(env.SITZUNGSDAUER_STUNDEN, 3),
      },
      log,
    })
      .then(() => undefined)
      .catch((e) => log.error(e, 'Regellauf fehlgeschlagen'))

  if (regelnModus === 'aus') {
    log.info('Regellauf ist ausgeschaltet (REGELN_MODUS=aus).')
  } else {
    zustand.regellauf = regellauf
    new Cron(env.REGELN_CRON || '0 7 * * *', { timezone: zeitzone, protect: true }, regellauf)
    log.info(`Regellauf (${regelnModus}) geplant: ${env.REGELN_CRON || '0 7 * * *'}`)
  }

  if (risModus === 'aus') {
    log.info('RIS-Abgleich ist ausgeschaltet (RIS_MODUS=aus).')
  } else {
    const http = standardHttp({
      userAgent: env.RIS_USER_AGENT || `beirat-dabei/0.1 (+${publicUrl})`,
      pauseMs: zahl(env.RIS_PAUSE_MS, 1000),
    })
    const abgleich = async () => {
      try {
        const r = await abgleichAusfuehren({
          speicher,
          http,
          jetzt: () => new Date(),
          modus: risModus,
          log,
          rueckblickTage: zahl(env.RIS_RUECKBLICK_TAGE, 45),
        })
        if (r.angelegt + r.geaendert > 0) await regellauf()
      } catch (e) {
        log.error(e, 'RIS-Abgleich fehlgeschlagen')
      }
    }
    new Cron(env.RIS_CRON || '15 6,12,18 * * *', { timezone: zeitzone, protect: true }, abgleich)
    log.info(`RIS-Abgleich (${risModus}) geplant: ${env.RIS_CRON || '15 6,12,18 * * *'}`)
  }
}
