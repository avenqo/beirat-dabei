import type { Abhaengigkeiten, Antwort, DateiStrom, Speicher } from "./handlers.js";

export interface DokumentZeile {
  id: string;
  titel: string;
  kategorie: string;
  /** Datum als JJJJ-MM-TT */
  datum: string | null;
  beschreibung: string | null;
  veroeffentlicht: boolean;
  hatDatei: boolean;
  dateiName: string | null;
  dateiTyp: string | null;
  dateiGroesse: number | null;
}

/** Zusätzliche Zugriffe für den öffentlichen Bereich. */
export interface OeffentlichSpeicher {
  /** Kennung der Datei, die in Directus als Projektlogo eingestellt ist */
  logoId(): Promise<string | null>;
  /** Alle Dokumente (auch Entwürfe); der Handler zeigt nur veröffentlichte */
  dokumente(): Promise<DokumentZeile[]>;
  dateiVonDokument(dokumentId: string): Promise<DateiStrom | null>;
}

export type OeffentlichAbhaengigkeiten = Omit<Abhaengigkeiten, "speicher"> & { speicher: Speicher & OeffentlichSpeicher };

export const KATEGORIEN = [
  { id: "geschaeftsordnung", titel: "Geschäftsordnung" },
  { id: "stellungnahme", titel: "Stellungnahmen" },
  { id: "taetigkeitsbericht", titel: "Tätigkeitsberichte" },
  { id: "sonstiges", titel: "Weitere Unterlagen" },
] as const;

const fehler = (status: number, code: string): Antwort => ({ status, body: { fehler: code } });
const URL_PRUEFEN = /^https?:\/\//;

/** Öffentlich: Name und Logo für Kopfzeile und Anmeldeseite. */
export async function instanz(d: OeffentlichAbhaengigkeiten): Promise<Antwort> {
  const [{ name }, logoId] = await Promise.all([d.speicher.einstellungen(), d.speicher.logoId()]);
  return {
    status: 200,
    body: { name: name ?? "Beirat dabei", logo: logoId ? `/assets/${logoId}?width=320&fit=inside` : null },
    kopf: { "cache-control": "public, max-age=300" },
  };
}

/** Öffentlich: nächste Sitzungstermine und veröffentlichte Unterlagen. Keine Namen, keine Notizen. */
export async function oeffentlich(d: OeffentlichAbhaengigkeiten): Promise<Antwort> {
  const jetzt = d.jetzt().getTime();
  const [{ name, einstellungen }, logoId, sitzungen, dokumente] = await Promise.all([
    d.speicher.einstellungen(),
    d.speicher.logoId(),
    d.speicher.sitzungen(),
    d.speicher.dokumente(),
  ]);

  const kommend = sitzungen
    .filter((s) => s.start.getTime() > jetzt)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 6)
    .map((s) => ({
      gremium: s.gremiumName,
      beginn: s.start.toISOString(),
      ort: s.ort ?? null,
      abgesagt: s.abgesagt,
      tagesordnung: s.toVeroeffentlicht && s.toLink && URL_PRUEFEN.test(s.toLink) ? s.toLink : null,
    }));

  const veroeffentlicht = dokumente.filter((x) => x.veroeffentlicht && x.hatDatei);
  const bekannt = new Set<string>(KATEGORIEN.map((k) => k.id));
  const kategorien = KATEGORIEN.map((k) => ({
    id: k.id,
    titel: k.titel,
    dokumente: veroeffentlicht
      .filter((x) => (bekannt.has(x.kategorie) ? x.kategorie : "sonstiges") === k.id)
      .sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? "") || a.titel.localeCompare(b.titel, "de"))
      .map((x) => ({
        id: x.id,
        titel: x.titel,
        datum: x.datum,
        beschreibung: x.beschreibung,
        dateiname: x.dateiName,
        typ: x.dateiTyp,
        groesse: x.dateiGroesse,
        url: `/beirat-dabei/datei/${x.id}`,
      })),
  })).filter((k) => k.dokumente.length > 0);

  return {
    status: 200,
    body: {
      instanz: { name: name ?? "Beirat dabei", logo: logoId ? `/assets/${logoId}?width=320&fit=inside` : null, zeitzone: einstellungen.zeitzone },
      sitzungen: kommend,
      kategorien,
    },
    kopf: { "cache-control": "public, max-age=120" },
  };
}

/** Öffentlich: die Datei eines veröffentlichten Dokuments. Entwürfe und fremde Dateien bleiben unerreichbar. */
export async function datei(d: OeffentlichAbhaengigkeiten, dokumentId: string): Promise<Antwort> {
  if (!/^[0-9a-f-]{36}$/i.test(dokumentId)) return fehler(404, "nicht-gefunden");
  const dokument = (await d.speicher.dokumente()).find((x) => x.id === dokumentId);
  if (!dokument || !dokument.veroeffentlicht || !dokument.hatDatei) return fehler(404, "nicht-gefunden");
  const datei = await d.speicher.dateiVonDokument(dokumentId);
  if (!datei) return fehler(404, "nicht-gefunden");
  return { status: 200, body: null, datei };
}
