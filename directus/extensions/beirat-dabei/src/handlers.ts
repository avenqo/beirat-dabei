import {
  TOKEN_GUELTIGKEIT_SEKUNDEN,
  aboTokenErzeugen,
  aboTokenPruefen,
  kalenderErzeugen,
  dashboardBauen,
  notizPruefen,
  teilnahmeAnwenden,
  tokenErzeugen,
  tokenPruefen,
  type DashboardAnsicht,
  type Einstellungen,
  type Notiz,
  type Notizfrage,
  type SitzungInfo,
  type Teilnahme,
  type TeilnahmeAktion,
  type TeilnahmeFehler,
  type Token,
} from "@beirat-dabei/core";

/** Zugriff auf die Daten. Die Directus-Anbindung implementiert das; Tests nutzen eine Attrappe. */
export interface Speicher {
  einstellungen(): Promise<{ einstellungen: Einstellungen; notizfragen: Notizfrage[]; name?: string; aboVersion?: number }>;
  /** Alle Personen mit Mitglieds- oder Admin-Rolle. Ohne E-Mail-Adressen. */
  mitglieder(): Promise<{ id: string; aktiv: boolean; name: string }[]>;
  sitzungen(): Promise<SitzungInfo[]>;
  sitzung(id: string): Promise<SitzungInfo | null>;
  teilnahmen(sitzungId?: string): Promise<Teilnahme[]>;
  teilnahmeAnlegen(daten: Omit<Teilnahme, "id">): Promise<void>;
  teilnahmeAendern(id: string, daten: Partial<Omit<Teilnahme, "id">>): Promise<void>;
  notizen(): Promise<Notiz[]>;
  notizSpeichern(sitzungId: string, wert: { relevant: boolean; antworten: Record<string, string> }): Promise<void>;
}

export interface Abhaengigkeiten {
  speicher: Speicher;
  geheimnis: string;
  jetzt: () => Date;
  /** Öffentliche Adresse der Instanz, für Abo-Adressen und Kalendereinträge */
  publicUrl?: string;
  /** Angenommene Dauer einer Sitzung im Kalender */
  sitzungsdauerStunden?: number;
}

/** Eine Datei, die an die Antwort durchgereicht wird. */
export interface DateiStrom {
  stream: NodeJS.ReadableStream;
  typ: string;
  name: string;
  groesse: number | null;
}

export interface Antwort {
  status: number;
  body: unknown;
  /** Content-Type für Antworten, die kein JSON sind */
  typ?: string;
  kopf?: Record<string, string>;
  /** Wenn gesetzt, wird die Datei statt des Bodys gesendet */
  datei?: DateiStrom;
}

const antwort = (status: number, body: unknown): Antwort => ({ status, body });
const fehler = (status: number, code: string, extra: object = {}): Antwort =>
  antwort(status, { fehler: code, ...extra });

const AKTIONEN: TeilnahmeAktion[] = ["eintragen", "austragen", "nicht-teilgenommen", "dabei-gewesen"];
const STATUS_FUER_GRUND: Record<TeilnahmeFehler, number> = {
  abgesagt: 409,
  vergangen: 409,
  "nicht-vorbei": 409,
  "nicht-eingetragen": 409,
};

async function aktiveMitglieder(d: Abhaengigkeiten) {
  const mitglieder = await d.speicher.mitglieder();
  return new Map(mitglieder.filter((m) => m.aktiv).map((m) => [m.id, m]));
}

// --- Dashboard -----------------------------------------------------------

export async function dashboard(d: Abhaengigkeiten, nutzerId: string | null): Promise<Antwort> {
  if (!nutzerId) return fehler(401, "nicht-angemeldet");
  const mitglieder = await d.speicher.mitglieder();
  if (!mitglieder.some((m) => m.id === nutzerId && m.aktiv)) return fehler(403, "kein-mitglied");

  const [{ einstellungen, notizfragen, name }, sitzungen, teilnahmen, notizen] = await Promise.all([
    d.speicher.einstellungen(),
    d.speicher.sitzungen(),
    d.speicher.teilnahmen(),
    d.speicher.notizen(),
  ]);
  const ansicht: DashboardAnsicht = dashboardBauen(
    {
      jetzt: d.jetzt(),
      einstellungen,
      mitglieder: mitglieder.map(({ id, aktiv }) => ({ id, aktiv })),
      sitzungen,
      teilnahmen,
      notizen,
      versand: [],
    },
    new Map(mitglieder.map((m) => [m.id, m.name])),
    nutzerId,
  );
  return antwort(200, {
    ...ansicht,
    notizfragen,
    instanz: { name: name ?? "Beirat dabei", zeitzone: einstellungen.zeitzone },
    ich: nutzerId,
  });
}

// --- Teilnahme -----------------------------------------------------------

async function teilnahmeAusfuehren(
  d: Abhaengigkeiten,
  mitgliedId: string,
  sitzungId: unknown,
  aktion: unknown,
): Promise<Antwort> {
  if (typeof sitzungId !== "string" || !AKTIONEN.includes(aktion as TeilnahmeAktion)) {
    return fehler(400, "ungueltige-eingabe");
  }
  const sitzung = await d.speicher.sitzung(sitzungId);
  if (!sitzung) return fehler(404, "sitzung-unbekannt");

  const ergebnis = teilnahmeAnwenden({
    aktion: aktion as TeilnahmeAktion,
    sitzung,
    teilnahmen: await d.speicher.teilnahmen(sitzungId),
    mitgliedId,
    jetzt: d.jetzt(),
  });
  if (!ergebnis.ok) return fehler(STATUS_FUER_GRUND[ergebnis.grund], ergebnis.grund);

  const a = ergebnis.aenderung;
  if (a.art === "anlegen") await d.speicher.teilnahmeAnlegen(a.daten);
  else if (a.art === "aktualisieren") await d.speicher.teilnahmeAendern(a.id, a.daten);
  return antwort(200, { ok: true, geaendert: a.art !== "keine" });
}

export async function teilnahme(
  d: Abhaengigkeiten,
  nutzerId: string | null,
  body: { sitzung?: unknown; aktion?: unknown },
): Promise<Antwort> {
  if (!nutzerId) return fehler(401, "nicht-angemeldet");
  if (!(await aktiveMitglieder(d)).has(nutzerId)) return fehler(403, "kein-mitglied");
  return teilnahmeAusfuehren(d, nutzerId, body?.sitzung, body?.aktion);
}

// --- Notiz ---------------------------------------------------------------

async function notizAusfuehren(
  d: Abhaengigkeiten,
  mitgliedId: string,
  sitzungId: unknown,
  eingabe: unknown,
): Promise<Antwort> {
  if (typeof sitzungId !== "string") return fehler(400, "ungueltige-eingabe");
  const sitzung = await d.speicher.sitzung(sitzungId);
  if (!sitzung) return fehler(404, "sitzung-unbekannt");
  if (sitzung.abgesagt) return fehler(409, "abgesagt");
  if (sitzung.start.getTime() > d.jetzt().getTime()) return fehler(409, "nicht-vorbei");

  const teilnahmen = await d.speicher.teilnahmen(sitzungId);
  const dabei = teilnahmen.some((t) => t.mitgliedId === mitgliedId && !t.ausgetragenAm && !t.nichtTeilgenommen);
  if (!dabei) return fehler(403, "nicht-teilnehmend");

  const { notizfragen } = await d.speicher.einstellungen();
  const pruefung = notizPruefen(eingabe, notizfragen);
  if (!pruefung.ok) return fehler(400, "ungueltige-eingabe", { felder: pruefung.fehler });

  await d.speicher.notizSpeichern(sitzungId, pruefung.wert);
  return antwort(200, { ok: true });
}

export async function notiz(
  d: Abhaengigkeiten,
  nutzerId: string | null,
  body: { sitzung?: unknown; relevant?: unknown; antworten?: unknown },
): Promise<Antwort> {
  if (!nutzerId) return fehler(401, "nicht-angemeldet");
  if (!(await aktiveMitglieder(d)).has(nutzerId)) return fehler(403, "kein-mitglied");
  return notizAusfuehren(d, nutzerId, body?.sitzung, { relevant: body?.relevant, antworten: body?.antworten });
}

// --- Magic Links ---------------------------------------------------------

async function tokenPruefenFuerLink(d: Abhaengigkeiten, wert: string) {
  const r = tokenPruefen(wert, d.geheimnis, d.jetzt());
  if (!r.ok) return { fehler: fehler(r.grund === "abgelaufen" ? 410 : 400, `link-${r.grund}`) };
  const mitglied = (await aktiveMitglieder(d)).get(r.token.m);
  if (!mitglied) return { fehler: fehler(403, "kein-mitglied") };
  const sitzung = await d.speicher.sitzung(r.token.s);
  if (!sitzung) return { fehler: fehler(404, "sitzung-unbekannt") };
  return { token: r.token as Token, mitglied, sitzung };
}

/** Öffentlich, ändert nichts: liefert die Angaben für die Bestätigungsseite. */
export async function linkInfo(d: Abhaengigkeiten, wert: string): Promise<Antwort> {
  const r = await tokenPruefenFuerLink(d, wert);
  if ("fehler" in r && r.fehler) return r.fehler;
  const { token, mitglied, sitzung } = r as Exclude<typeof r, { fehler: Antwort }>;
  const teilnahmen = await d.speicher.teilnahmen(sitzung.id);
  const bereitsEingetragen = teilnahmen.some((t) => t.mitgliedId === mitglied.id && !t.ausgetragenAm);
  const { notizfragen, name } = await d.speicher.einstellungen();
  return antwort(200, {
    instanz: name ?? "Beirat dabei",
    aktion: token.a,
    mitglied: mitglied.name,
    bereitsEingetragen,
    sitzung: {
      id: sitzung.id,
      gremium: sitzung.gremiumName,
      beginn: sitzung.start.toISOString(),
      ort: sitzung.ort ?? null,
      abgesagt: sitzung.abgesagt,
    },
    ...(token.a === "notiz" ? { notizfragen } : {}),
  });
}

const GEGENAKTION: Partial<Record<TeilnahmeAktion, "eintragen" | "austragen">> = {
  eintragen: "austragen",
  austragen: "eintragen",
};

/** Öffentlich, ändert: führt die Aktion des Tokens aus. Liefert einen Rückgängig-Token. */
export async function linkBestaetigen(
  d: Abhaengigkeiten,
  wert: string,
  body: { relevant?: unknown; antworten?: unknown } = {},
): Promise<Antwort> {
  const r = await tokenPruefenFuerLink(d, wert);
  if ("fehler" in r && r.fehler) return r.fehler;
  const { token, mitglied, sitzung } = r as Exclude<typeof r, { fehler: Antwort }>;

  if (token.a === "notiz") {
    return notizAusfuehren(d, mitglied.id, sitzung.id, { relevant: body?.relevant, antworten: body?.antworten });
  }
  const ergebnis = await teilnahmeAusfuehren(d, mitglied.id, sitzung.id, token.a);
  if (ergebnis.status !== 200) return ergebnis;

  const gegen = GEGENAKTION[token.a as TeilnahmeAktion];
  const rueckgaengig = gegen
    ? tokenErzeugen({ a: gegen, m: mitglied.id, s: sitzung.id }, d.geheimnis, d.jetzt(), TOKEN_GUELTIGKEIT_SEKUNDEN)
    : null;
  return antwort(200, { ok: true, aktion: token.a, rueckgaengig });
}

// --- Kalender-Abo ----------------------------------------------------------

const ABO_VERGANGENHEIT_TAGE = 60;

function basisUrl(d: Abhaengigkeiten): string {
  return (d.publicUrl ?? "").replace(/\/$/, "");
}

/** Mit Directus-Anmeldung: die persönliche Abo-Adresse. */
export async function abo(d: Abhaengigkeiten, nutzerId: string | null): Promise<Antwort> {
  if (!nutzerId) return fehler(401, "nicht-angemeldet");
  if (!(await aktiveMitglieder(d)).has(nutzerId)) return fehler(403, "kein-mitglied");
  const { aboVersion } = await d.speicher.einstellungen();
  const pfad = `/beirat-dabei/ical/${aboTokenErzeugen(nutzerId, d.geheimnis, aboVersion ?? 1)}.ics`;
  const url = `${basisUrl(d)}${pfad}`;
  return antwort(200, { url, webcal: url.replace(/^https?:/, "webcal:") });
}

/**
 * Öffentlich, durch den Abo-Token geschützt: alle Sitzungstermine als iCal-Feed.
 * Jede Abweichung (falscher Token, inaktives Mitglied) ergibt gleichermaßen 404.
 */
export async function ical(d: Abhaengigkeiten, tokenMitEndung: string): Promise<Antwort> {
  const nichtDa = fehler(404, "nicht-gefunden");
  const { einstellungen, name, aboVersion } = await d.speicher.einstellungen();
  const mitgliedId = aboTokenPruefen(tokenMitEndung.replace(/\.ics$/i, ""), d.geheimnis, aboVersion ?? 1);
  if (!mitgliedId) return nichtDa;
  const mitglieder = await d.speicher.mitglieder();
  if (!mitglieder.some((m) => m.id === mitgliedId && m.aktiv)) return nichtDa;

  const jetzt = d.jetzt();
  const grenze = jetzt.getTime() - ABO_VERGANGENHEIT_TAGE * 86_400_000;
  const [sitzungen, teilnahmen] = await Promise.all([d.speicher.sitzungen(), d.speicher.teilnahmen()]);
  const namen = new Map(mitglieder.filter((m) => m.aktiv).map((m) => [m.id, m.name]));
  const basis = basisUrl(d);
  let domain = "beirat-dabei";
  try {
    domain = new URL(basis).hostname || domain;
  } catch {
    /* ohne gültige Adresse bleibt der Standard */
  }

  const termine = sitzungen
    .filter((s) => s.start.getTime() >= grenze)
    .map((s) => {
      const dabei = teilnahmen.filter((t) => t.sitzungId === s.id && !t.ausgetragenAm && namen.has(t.mitgliedId));
      const zeilen = [
        s.abgesagt
          ? "Die Sitzung ist abgesagt."
          : dabei.length > 0
            ? `Dabei: ${dabei.map((t) => namen.get(t.mitgliedId)).join(", ")}${dabei.some((t) => t.mitgliedId === mitgliedId) ? " (du bist eingetragen)" : ""}`
            : "Noch niemand eingetragen.",
        s.toVeroeffentlicht && s.toLink ? `Tagesordnung: ${s.toLink}` : "Tagesordnung: noch nicht veröffentlicht",
        basis ? `Dashboard: ${basis}/dashboard/` : "",
      ].filter(Boolean);
      const link = s.toVeroeffentlicht && s.toLink ? s.toLink : s.risLink;
      return {
        id: s.id,
        start: s.start,
        dauerMinuten: Math.round((d.sitzungsdauerStunden ?? 3) * 60),
        titel: `${s.abgesagt ? "ABGESAGT: " : ""}${s.gremiumName}`,
        beschreibung: zeilen.join("\n"),
        abgesagt: s.abgesagt,
        ...(s.ort ? { ort: s.ort } : {}),
        ...(link && /^https?:\/\//.test(link) ? { url: link } : {}),
      };
    });

  const text = kalenderErzeugen(termine, { name: name ?? "Beirat dabei", domain, jetzt });
  return {
    status: 200,
    body: text,
    typ: "text/calendar; charset=utf-8",
    kopf: { "cache-control": "private, max-age=900" },
  };
}
