import {
  TOKEN_GUELTIGKEIT_SEKUNDEN,
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
  einstellungen(): Promise<{ einstellungen: Einstellungen; notizfragen: Notizfrage[] }>;
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
  /** Gültigkeit der Magic Links in Sekunden */
  linkGueltigkeit?: number;
}

export interface Antwort {
  status: number;
  body: unknown;
}

const antwort = (status: number, body: unknown): Antwort => ({ status, body });
const fehler = (status: number, code: string, extra: object = {}): Antwort =>
  antwort(status, { fehler: code, ...extra });

const AKTIONEN: TeilnahmeAktion[] = ["eintragen", "austragen", "nicht-teilgenommen"];
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

  const [{ einstellungen, notizfragen }, sitzungen, teilnahmen, notizen] = await Promise.all([
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
  return antwort(200, { ...ansicht, notizfragen });
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
  const { notizfragen } = await d.speicher.einstellungen();
  return antwort(200, {
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

const GEGENAKTION: Partial<Record<TeilnahmeAktion, TeilnahmeAktion>> = {
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
