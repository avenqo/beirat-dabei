import { tageZwischen } from "./fristen.js";
import { aktiveTeilnahmen, sitzungStatus } from "./status.js";
import type { Notiz, Sitzung, SitzungStatus, Zustand } from "./types.js";

export interface SitzungInfo extends Sitzung {
  gremiumName: string;
  ort?: string;
  risLink?: string;
  toLink?: string;
}

export interface SitzungAnsicht {
  id: string;
  gremiumId: string;
  gremium: string;
  beginn: string;
  ort: string | null;
  risLink: string | null;
  toLink: string | null;
  toVeroeffentlicht: boolean;
  abgesagt: boolean;
  verschoben: boolean;
  status: SitzungStatus;
  /** Kalendertage bis zur Sitzung, negativ danach */
  tageBis: number;
  teilnehmer: { mitgliedId: string; name: string }[];
  ichTeilnehmend: boolean;
  /** Nur nach der Sitzung gesetzt */
  notiz: Notiz | null;
}

export interface DashboardAnsicht {
  kommend: SitzungAnsicht[];
  vergangen: SitzungAnsicht[];
}

/**
 * Baut die Sicht für das Dashboard. Enthält nur Namen, nie E-Mail-Adressen:
 * `namen` bildet Mitglieds-ID auf Anzeigenamen ab.
 */
export function dashboardBauen(
  z: Omit<Zustand, "sitzungen"> & { sitzungen: SitzungInfo[] },
  namen: Map<string, string>,
  ichId: string,
): DashboardAnsicht {
  const aktiveMitglieder = new Set(z.mitglieder.filter((m) => m.aktiv).map((m) => m.id));
  const ansichten = z.sitzungen.map((s): SitzungAnsicht => {
    const aktive = aktiveTeilnahmen(z.teilnahmen, s.id).filter((t) => aktiveMitglieder.has(t.mitgliedId));
    const vorbei = s.start.getTime() <= z.jetzt.getTime();
    return {
      id: s.id,
      gremiumId: s.gremiumId,
      gremium: s.gremiumName,
      beginn: s.start.toISOString(),
      ort: s.ort ?? null,
      risLink: s.risLink ?? null,
      toLink: s.toLink ?? null,
      toVeroeffentlicht: s.toVeroeffentlicht,
      abgesagt: s.abgesagt,
      verschoben: Boolean(s.verschobenVon),
      status: sitzungStatus(s, z.teilnahmen, z.notizen, z.jetzt, z.einstellungen),
      tageBis: tageZwischen(z.jetzt, s.start, z.einstellungen.zeitzone),
      teilnehmer: aktive
        .map((t) => ({ mitgliedId: t.mitgliedId, name: namen.get(t.mitgliedId) ?? "Unbekannt" }))
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
      ichTeilnehmend: aktive.some((t) => t.mitgliedId === ichId),
      notiz: vorbei ? (z.notizen.find((n) => n.sitzungId === s.id) ?? null) : null,
    };
  });
  const nachBeginn = (a: SitzungAnsicht, b: SitzungAnsicht) => a.beginn.localeCompare(b.beginn);
  return {
    kommend: ansichten.filter((a) => a.tageBis >= 0 && a.status !== "notiz-fehlt" && a.status !== "dokumentiert").sort(nachBeginn),
    vergangen: ansichten.filter((a) => !(a.tageBis >= 0 && a.status !== "notiz-fehlt" && a.status !== "dokumentiert")).sort((a, b) => nachBeginn(b, a)),
  };
}
