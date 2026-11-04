import type { GlobalConfig } from 'payload'
import { nurAdmins } from '../access'

export const Einstellungen: GlobalConfig = {
  slug: 'einstellungen',
  label: 'Einstellungen',
  admin: { group: 'Verwaltung' },
  access: { read: nurAdmins, update: nurAdmins },
  fields: [
    { name: 'name', label: 'Name der Instanz', type: 'text', defaultValue: 'Beirat dabei' },
    { name: 'fristVorTage', label: 'Frist vor der Sitzung (Tage)', type: 'number', defaultValue: 7, min: 0 },
    { name: 'fristNachTage', label: 'Frist nach der Sitzung (Tage)', type: 'number', defaultValue: 3, min: 0 },
    { name: 'zeitzone', label: 'Zeitzone', type: 'text', defaultValue: 'Europe/Berlin' },
    { name: 'aboVersion', label: 'Version der Kalender-Abos', type: 'number', defaultValue: 1, min: 1, admin: { description: 'Erhöhen, um alle Abo-Adressen ungültig zu machen.' } },
    { name: 'logo', label: 'Logo', type: 'upload', relationTo: 'medien' },
    {
      name: 'akzentfarbe',
      label: 'Akzentfarbe',
      type: 'text',
      admin: { description: 'Hauptfarbe des Dashboards als Hex-Wert, z. B. #1f4a2e. Leer lassen für das Standardgrün. Dunkle Töne wirken am besten.' },
      validate: (wert: string | null | undefined) =>
        !wert || /^#[0-9a-fA-F]{6}$/.test(wert) ? true : 'Bitte einen Hex-Wert mit sechs Stellen angeben, z. B. #1f4a2e',
    },
    { name: 'themenfokus', label: 'Themenfokus', type: 'text', admin: { description: 'Für die optionale KI-Vorsortierung' } },
    {
      name: 'risAdapter',
      label: 'RIS-Adapter',
      type: 'select',
      defaultValue: 'manuell',
      options: ['manuell', 'komfa', 'oparl', 'ical'].map((v) => ({ label: v, value: v })),
    },
    { name: 'risQuelle', label: 'Adresse des RIS', type: 'text', admin: { description: 'z. B. https://ris.musterstadt.example' } },
    { name: 'notizfragen', label: 'Fragen im Notizformular', type: 'json' },
    { name: 'impressum', label: 'Impressum (Markdown)', type: 'textarea' },
    { name: 'datenschutz', label: 'Datenschutzerklärung (Markdown)', type: 'textarea' },
  ],
}
