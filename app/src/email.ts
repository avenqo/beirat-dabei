import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import type { EmailAdapter, SendEmailOptions } from 'payload'

const absender = process.env.EMAIL_FROM ?? 'beirat@example.de'
const absenderName = process.env.EMAIL_FROM_NAME ?? 'Beirat dabei'

/** Einfacher Textteil aus HTML, für Mails, die nur HTML mitbringen (zum Beispiel „Passwort vergessen“ von Payload). */
export function htmlZuText(html: string): string {
  return html
    .replace(/<(head|style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url: string, t: string) => `${t.replace(/<[^>]+>/g, '').trim()}: ${url}`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const an = (m: SendEmailOptions) => (Array.isArray(m.to) ? m.to.map(String).join(', ') : String(m.to ?? ''))

/**
 * Jede Mail bekommt einen Textteil (reine HTML-Mails landen öfter im Spam) und eine Zeile im Protokoll,
 * ob sie an den SMTP-Server übergeben wurde. Damit lässt sich „Mail kommt nicht an“ eingrenzen.
 */
function mitTextUndProtokoll(adapter: EmailAdapter): EmailAdapter {
  return (args) => {
    const innen = adapter(args)
    return {
      ...innen,
      sendEmail: async (m) => {
        const nachricht = !m.text && typeof m.html === 'string' ? { ...m, text: htmlZuText(m.html) } : m
        try {
          const ergebnis = await innen.sendEmail(nachricht)
          args.payload.logger.info(`beirat-dabei: Mail an ${an(m)} übergeben: ${String(m.subject ?? '')}`)
          return ergebnis
        } catch (e) {
          args.payload.logger.error({ err: e }, `beirat-dabei: Mail an ${an(m)} nicht verschickt: ${String(m.subject ?? '')}`)
          throw e
        }
      },
    }
  }
}

/** SMTP, wenn EMAIL_SMTP_HOST gesetzt ist, sonst Ausgabe ins Protokoll (Entwicklung). */
export async function emailAdapter(): Promise<EmailAdapter> {
  if (!process.env.EMAIL_SMTP_HOST) {
    const logAdapter: EmailAdapter = ({ payload }) => ({
      name: 'protokoll',
      defaultFromAddress: absender,
      defaultFromName: absenderName,
      sendEmail: async (m) => {
        payload.logger.info(`[mail] an ${an(m)}: ${String(m.subject)}\n${String(m.text ?? m.html ?? '')}`)
      },
    })
    return logAdapter
  }
  const smtp = await nodemailerAdapter({
    defaultFromAddress: absender,
    defaultFromName: absenderName,
    transportOptions: {
      host: process.env.EMAIL_SMTP_HOST,
      port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
      secure: process.env.EMAIL_SMTP_SECURE === 'true',
      // Ohne Benutzer keine Anmeldung (zum Beispiel bei einem lokalen Testserver)
      ...(process.env.EMAIL_SMTP_USER ? { auth: { user: process.env.EMAIL_SMTP_USER, pass: process.env.EMAIL_SMTP_PASSWORD } } : {}),
    },
  })
  return mitTextUndProtokoll(smtp)
}
