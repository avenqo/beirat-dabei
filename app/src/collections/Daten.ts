import type { CollectionConfig } from 'payload'
import { niemand, nurAdmins } from '../access'
import { regellaufBald } from '../laeufe'

const verwaltung = { create: nurAdmins, update: nurAdmins, delete: nurAdmins, read: nurAdmins }

const bereinigen = { beforeValidate: [({ value }: { value?: unknown }) => (typeof value === 'string' ? value.trim() : value)] }

export const Gremien: CollectionConfig = {
  slug: 'gremien',
  labels: { singular: 'Gremium', plural: 'Gremien' },
  admin: { useAsTitle: 'name', group: 'Inhalt' },
  access: verwaltung,
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, hooks: bereinigen },
    { name: 'risKennung', label: 'RIS-Kennung', type: 'text', hooks: bereinigen, admin: { description: 'Name des Gremiums im Kalender des RIS. Bei Handpflege leer lassen.' } },
    { name: 'aktiv', label: 'Aktiv', type: 'checkbox', defaultValue: true },
  ],
}

export const Sitzungen: CollectionConfig = {
  slug: 'sitzungen',
  labels: { singular: 'Sitzung', plural: 'Sitzungen' },
  admin: { useAsTitle: 'beginn', defaultColumns: ['beginn', 'gremium', 'abgesagt'], group: 'Inhalt' },
  access: verwaltung,
  fields: [
    { name: 'gremium', label: 'Gremium', type: 'relationship', relationTo: 'gremien', required: true },
    { name: 'beginn', label: 'Beginn', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'ort', label: 'Ort', type: 'text' },
    { name: 'risId', label: 'RIS-Kennung der Sitzung', type: 'text', unique: true, index: true },
    { name: 'risLink', label: 'Link zur Sitzung im RIS', type: 'text' },
    { name: 'toVeroeffentlicht', label: 'Tagesordnung veröffentlicht', type: 'checkbox', defaultValue: false },
    { name: 'toLink', label: 'Link zur Tagesordnung', type: 'text' },
    { name: 'abgesagt', label: 'Abgesagt', type: 'checkbox', defaultValue: false },
    { name: 'verschobenVon', label: 'Früherer Beginn', type: 'date', admin: { readOnly: true } },
  ],
}

export const Teilnahmen: CollectionConfig = {
  slug: 'teilnahmen',
  labels: { singular: 'Teilnahme', plural: 'Teilnahmen' },
  admin: { group: 'Inhalt' },
  // Schreiben nur über die Endpoints (prüfen Rolle, Fristen und Besitz im Code)
  access: { create: niemand, update: niemand, delete: niemand, read: nurAdmins },
  hooks: { afterChange: [() => regellaufBald()] },
  fields: [
    { name: 'sitzung', type: 'relationship', relationTo: 'sitzungen', required: true, index: true },
    { name: 'mitglied', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'eingetragenAm', type: 'date', required: true },
    { name: 'ausgetragenAm', type: 'date' },
    { name: 'nichtTeilgenommen', type: 'checkbox', defaultValue: false },
  ],
}

export const Notizen: CollectionConfig = {
  slug: 'notizen',
  labels: { singular: 'Notiz', plural: 'Notizen' },
  admin: { group: 'Inhalt' },
  access: { create: niemand, update: niemand, delete: nurAdmins, read: nurAdmins },
  fields: [
    { name: 'sitzung', type: 'relationship', relationTo: 'sitzungen', required: true, unique: true },
    { name: 'relevant', type: 'checkbox', defaultValue: false },
    { name: 'antworten', type: 'json' },
  ],
}

const uploadVerzeichnis = (name: string) => `${process.env.UPLOADS_DIR ?? './data/uploads'}/${name}`

export const Dokumente: CollectionConfig = {
  slug: 'dokumente',
  labels: { singular: 'Dokument', plural: 'Dokumente' },
  admin: { useAsTitle: 'titel', defaultColumns: ['titel', 'kategorie', 'veroeffentlicht'], group: 'Inhalt', description: 'Unterlagen für den öffentlichen Bereich: Geschäftsordnung, Stellungnahmen, Tätigkeitsberichte, Protokolle' },
  // Öffentlich zugänglich ist nur, was der Endpoint /beirat-dabei/datei/:id ausliefert (veröffentlichte Dokumente)
  access: verwaltung,
  upload: {
    staticDir: uploadVerzeichnis('dokumente'),
    mimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.oasis.opendocument.text'],
  },
  fields: [
    { name: 'titel', label: 'Titel', type: 'text', required: true, admin: { description: 'Name des Dokuments, so wie er öffentlich erscheint' } },
    {
      name: 'kategorie',
      label: 'Kategorie',
      type: 'select',
      defaultValue: 'sonstiges',
      options: [
        { label: 'Geschäftsordnung', value: 'geschaeftsordnung' },
        { label: 'Stellungnahme', value: 'stellungnahme' },
        { label: 'Tätigkeitsbericht', value: 'taetigkeitsbericht' },
        { label: 'Protokoll', value: 'protokoll' },
        { label: 'Weitere Unterlagen', value: 'sonstiges' },
      ],
    },
    { name: 'datum', label: 'Datum', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' }, description: 'Für die Sortierung (neueste zuerst)' } },
    { name: 'beschreibung', label: 'Beschreibung', type: 'textarea', admin: { description: 'Optional: ein bis zwei Sätze' } },
    { name: 'veroeffentlicht', label: 'Veröffentlicht', type: 'checkbox', defaultValue: false, admin: { description: 'Nur mit Haken ist das Dokument ohne Anmeldung sichtbar' } },
  ],
}

/** Logo und andere Bilder; öffentlich lesbar, damit das Logo auch ohne Anmeldung erscheint. */
export const Medien: CollectionConfig = {
  slug: 'medien',
  labels: { singular: 'Bild', plural: 'Bilder' },
  admin: { group: 'Verwaltung' },
  access: { ...verwaltung, read: () => true },
  upload: { staticDir: uploadVerzeichnis('medien'), mimeTypes: ['image/png', 'image/jpeg', 'image/webp'] },
  fields: [{ name: 'alt', label: 'Beschreibung', type: 'text' }],
}

/** Versandprotokoll, verhindert doppelte Nachrichten. */
export const Benachrichtigungen: CollectionConfig = {
  slug: 'benachrichtigungen',
  labels: { singular: 'Benachrichtigung', plural: 'Benachrichtigungen' },
  admin: { group: 'Verwaltung', description: 'Versandprotokoll' },
  access: { create: niemand, update: niemand, delete: niemand, read: nurAdmins },
  fields: [
    { name: 'regel', type: 'text', required: true },
    { name: 'sitzung', type: 'relationship', relationTo: 'sitzungen', required: true, index: true },
    { name: 'empfaenger', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'bezug', type: 'text' },
  ],
}
