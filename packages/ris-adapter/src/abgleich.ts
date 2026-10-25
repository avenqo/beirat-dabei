import type { RisSitzung, RisTagesordnung, Zeitraum } from "./types.js";

export interface BekannteSitzung {
  id: string;
  risId: string | null;
  start: Date;
  ort: string | null;
  abgesagt: boolean;
  toVeroeffentlicht: boolean;
  toLink: string | null;
  risLink: string | null;
}

export interface NeueSitzung {
  risId: string;
  start: Date;
  ort: string | null;
  risLink: string;
  abgesagt: boolean;
  toVeroeffentlicht: boolean;
  toLink: string | null;
}

export interface SitzungsAenderung {
  start: Date;
  verschobenVon: Date;
  ort: string | null;
  risLink: string;
  abgesagt: boolean;
  toVeroeffentlicht: boolean;
  toLink: string;
}

export type Aenderung =
  | { art: "anlegen"; risId: string; daten: NeueSitzung }
  | { art: "aendern"; id: string; risId: string; daten: Partial<SitzungsAenderung>; gruende: string[] };

export interface AbgleichEingabe {
  /** Bereits gespeicherte Sitzungen dieses Gremiums */
  bekannt: BekannteSitzung[];
  ris: RisSitzung[];
  /** Tagesordnungen, soweit abgerufen; fehlt ein Eintrag, bleibt der Stand unverändert */
  tagesordnungen: Map<string, RisTagesordnung>;
  jetzt: Date;
  zeitraum: Zeitraum;
  vollstaendig: boolean;
}

const MINUTE = 60_000;

/**
 * Vergleicht den Stand im RIS mit den gespeicherten Sitzungen und liefert die nötigen
 * Änderungen. Reine Funktion.
 *
 * - neue Sitzung: anlegen
 * - anderer Beginn: Beginn ändern, bei kommenden Sitzungen "verschoben von" setzen
 * - Absage im RIS, oder Sitzung fehlt bei vollständigem Abruf: als abgesagt markieren
 * - Tagesordnung erschienen: als veröffentlicht markieren
 * Nichts wird automatisch zurückgenommen (keine Entabsage, keine "TO zurückgezogen"),
 * das bleibt Sache der Administrierenden.
 */
export function abgleichBerechnen(e: AbgleichEingabe): Aenderung[] {
  const ergebnis: Aenderung[] = [];
  const nachRisId = new Map(e.bekannt.filter((b) => b.risId).map((b) => [b.risId as string, b]));
  const imRis = new Set(e.ris.map((r) => r.risId));

  for (const r of e.ris) {
    const to = e.tagesordnungen.get(r.risId);
    const b = nachRisId.get(r.risId);

    if (!b) {
      ergebnis.push({
        art: "anlegen",
        risId: r.risId,
        daten: {
          risId: r.risId,
          start: r.start,
          ort: r.ort,
          risLink: r.risLink,
          abgesagt: r.abgesagt || Boolean(to?.abgesagt),
          toVeroeffentlicht: Boolean(to?.veroeffentlicht),
          toLink: to?.veroeffentlicht ? to.link : null,
        },
      });
      continue;
    }

    const daten: Partial<SitzungsAenderung> = {};
    const gruende: string[] = [];
    if (Math.abs(b.start.getTime() - r.start.getTime()) >= MINUTE) {
      daten.start = r.start;
      gruende.push("Beginn geändert");
      if (b.start.getTime() > e.jetzt.getTime()) daten.verschobenVon = b.start;
    }
    if (r.ort && r.ort !== b.ort) {
      daten.ort = r.ort;
      gruende.push("Ort geändert");
    }
    if (b.risLink !== r.risLink) daten.risLink = r.risLink;
    if (!b.abgesagt && (r.abgesagt || to?.abgesagt)) {
      daten.abgesagt = true;
      gruende.push("im RIS abgesagt");
    }
    if (!b.toVeroeffentlicht && to?.veroeffentlicht) {
      daten.toVeroeffentlicht = true;
      daten.toLink = to.link;
      gruende.push("Tagesordnung veröffentlicht");
    } else if (b.toVeroeffentlicht && to?.veroeffentlicht && !b.toLink) {
      daten.toLink = to.link;
    }
    if (Object.keys(daten).length > 0) {
      ergebnis.push({ art: "aendern", id: b.id, risId: r.risId, daten, gruende });
    }
  }

  // Fehlt eine kommende Sitzung im vollständigen Abruf, gilt sie als abgesagt.
  if (e.vollstaendig && e.ris.length > 0) {
    for (const b of e.bekannt) {
      if (!b.risId || imRis.has(b.risId) || b.abgesagt) continue;
      if (b.start.getTime() <= e.jetzt.getTime()) continue;
      if (b.start < e.zeitraum.von || b.start > e.zeitraum.bis) continue;
      ergebnis.push({ art: "aendern", id: b.id, risId: b.risId, daten: { abgesagt: true }, gruende: ["im RIS nicht mehr aufgeführt"] });
    }
  }
  return ergebnis;
}
