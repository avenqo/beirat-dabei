import { tageZwischen } from "./fristen.js";
import type { Einstellungen, Notiz, Sitzung, SitzungStatus, Teilnahme } from "./types.js";

export function aktiveTeilnahmen(teilnahmen: Teilnahme[], sitzungId: string): Teilnahme[] {
  return teilnahmen.filter((t) => t.sitzungId === sitzungId && !t.ausgetragenAm);
}

export function sitzungStatus(
  sitzung: Sitzung,
  teilnahmen: Teilnahme[],
  notizen: Notiz[],
  jetzt: Date,
  einstellungen: Einstellungen,
): SitzungStatus {
  if (sitzung.abgesagt) return "abgesagt";
  if (sitzung.start.getTime() <= jetzt.getTime()) {
    return notizen.some((n) => n.sitzungId === sitzung.id) ? "dokumentiert" : "notiz-fehlt";
  }
  if (aktiveTeilnahmen(teilnahmen, sitzung.id).length > 0) return "besetzt";
  const tage = tageZwischen(jetzt, sitzung.start, einstellungen.zeitzone);
  return tage <= einstellungen.fristVorTage ? "dringend" : "offen";
}
