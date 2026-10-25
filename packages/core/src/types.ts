export interface Einstellungen {
  /** Frist vor der Sitzung in Tagen (Regeln 3 und 4, Status "dringend"). */
  fristVorTage: number;
  /** Frist nach der Sitzung in Tagen (Regel 5). */
  fristNachTage: number;
  /** IANA-Zeitzone, nach der Kalendertage gezählt werden. */
  zeitzone: string;
}

export const STANDARD_EINSTELLUNGEN: Einstellungen = {
  fristVorTage: 7,
  fristNachTage: 3,
  zeitzone: "Europe/Berlin",
};

export interface Mitglied {
  id: string;
  aktiv: boolean;
}

export interface Sitzung {
  id: string;
  gremiumId: string;
  start: Date;
  abgesagt: boolean;
  toVeroeffentlicht: boolean;
  /** Gesetzt, wenn der Abgleich eine Verschiebung erkannt hat: der frühere Beginn. */
  verschobenVon?: Date | null;
}

export interface Teilnahme {
  id: string;
  sitzungId: string;
  mitgliedId: string;
  eingetragenAm: Date;
  /** Gesetzt, solange die Person ausgetragen ist. Die Zeile bleibt für Regel 4 erhalten. */
  ausgetragenAm?: Date | null;
  /** Rückmeldung "doch nicht teilgenommen" nach der Sitzung. */
  nichtTeilgenommen: boolean;
}

export interface Notiz {
  sitzungId: string;
  relevant?: boolean;
  antworten?: Record<string, string>;
}

export interface Notizfrage {
  schluessel: string;
  frage: string;
  typ: "ja-nein" | "text";
  pflicht: boolean;
}

export type RegelId = "R1" | "R2" | "R3" | "R4" | "R5" | "verschoben" | "abgesagt";

/** Eintrag im Versandprotokoll. Verhindert doppelte Nachrichten. */
export interface Versand {
  regel: RegelId;
  sitzungId: string;
  empfaengerId: string;
  bezug: string;
}

/** Eine fällige Nachricht an eine Person. Mehrere Regeln können sich eine Mail teilen. */
export interface Nachricht {
  empfaengerId: string;
  sitzungId: string;
  regeln: RegelId[];
  /** Wer die Nachricht ausgelöst hat (Regel 2), sonst leer. */
  ausloeserId?: string;
  /** Nach erfolgreichem Versand ins Protokoll zu schreiben. */
  protokoll: Versand[];
}

export type SitzungStatus =
  | "abgesagt"
  | "besetzt"
  | "offen"
  | "dringend"
  | "notiz-fehlt"
  | "dokumentiert";

export interface Zustand {
  jetzt: Date;
  einstellungen: Einstellungen;
  mitglieder: Mitglied[];
  sitzungen: Sitzung[];
  teilnahmen: Teilnahme[];
  notizen: Notiz[];
  versand: Versand[];
}
