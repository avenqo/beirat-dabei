import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import type { EmailAdapter } from 'payload'

const absender = process.env.EMAIL_FROM ?? 'beirat@example.de'

/** SMTP, wenn EMAIL_SMTP_HOST gesetzt ist, sonst Ausgabe ins Protokoll (Entwicklung). */
export function emailAdapter() {
  if (!process.env.EMAIL_SMTP_HOST) {
    const logAdapter: EmailAdapter = ({ payload }) => ({
      name: 'protokoll',
      defaultFromAddress: absender,
      defaultFromName: process.env.EMAIL_FROM_NAME ?? 'Beirat dabei',
      sendEmail: async (m) => {
        payload.logger.info(`[mail] an ${String(m.to)}: ${String(m.subject)}\n${String(m.text ?? m.html ?? '')}`)
      },
    })
    return logAdapter
  }
  return nodemailerAdapter({
    defaultFromAddress: absender,
    defaultFromName: process.env.EMAIL_FROM_NAME ?? 'Beirat dabei',
    transportOptions: {
      host: process.env.EMAIL_SMTP_HOST,
      port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
      secure: process.env.EMAIL_SMTP_SECURE === 'true',
      auth: { user: process.env.EMAIL_SMTP_USER, pass: process.env.EMAIL_SMTP_PASSWORD },
    },
  })
}
