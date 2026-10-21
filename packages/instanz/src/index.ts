import { parse } from "yaml";

export type RisAdapterName = "manuell" | "komfa";
const RIS_ADAPTER: RisAdapterName[] = ["manuell", "komfa"];

export interface Notizfrage {
  schluessel: string;
  frage: string;
  typ: "ja-nein" | "text";
  pflicht: boolean;
}

export interface GremiumSoll {
  name: string;
  risKennung: string;
  aktiv: boolean;
}

/** Startkonfiguration einer Instanz, wie sie in der instanz.yaml steht. */
export interface Instanz {
  name: string;
  zeitzone: string;
  fristVorTage: number;
  fristNachTage: number;
  themenfokus: string;
  notizfragen: Notizfrage[];
  ris: { adapter: RisAdapterName; quelle: string };
  rollen: { mitglied: string; admin: string };
  gremien: GremiumSoll[];
}

export type LeseErgebnis = { ok: true; instanz: Instanz } | { ok: false; fehler: string[] };

type Objekt = Record<string, unknown>;
const istObjekt = (v: unknown): v is Objekt => typeof v === "object" && v !== null && !Array.isArray(v);

function unbekannteSchluessel(o: Objekt, erlaubt: string[], pfad: string, fehler: string[]) {
  for (const k of Object.keys(o)) {
    if (!erlaubt.includes(k)) fehler.push(`${pfad}${k}: unbekannter Schlüssel (Tippfehler? Erlaubt: ${erlaubt.join(", ")})`);
  }
}

function text(o: Objekt, schluessel: string, pfad: string, fehler: string[], opts: { pflicht?: boolean } = {}): string {
  const w = o[schluessel];
  if (w === undefined || w === null || w === "") {
    if (opts.pflicht) fehler.push(`${pfad}${schluessel}: fehlt`);
    return "";
  }
  if (typeof w !== "string") {
    fehler.push(`${pfad}${schluessel}: muss ein Text sein`);
    return "";
  }
  return w.trim();
}

function ganzzahl(o: Objekt, schluessel: string, standard: number, pfad: string, fehler: string[]): number {
  const w = o[schluessel];
  if (w === undefined || w === null) return standard;
  if (typeof w !== "number" || !Number.isInteger(w) || w < 0 || w > 365) {
    fehler.push(`${pfad}${schluessel}: muss eine ganze Zahl von 0 bis 365 sein`);
    return standard;
  }
  return w;
}

function zeitzoneGueltig(z: string): boolean {
  try {
    new Intl.DateTimeFormat("de-DE", { timeZone: z });
    return true;
  } catch {
    return false;
  }
}

/** Liest und prüft eine instanz.yaml. Meldet alle Fehler auf einmal, auf Deutsch. */
export function instanzLesen(yamlText: string): LeseErgebnis {
  let roh: unknown;
  try {
    roh = parse(yamlText);
  } catch (e) {
    return { ok: false, fehler: [`Die Datei ist kein gültiges YAML: ${(e as Error).message.split("\n")[0]}`] };
  }
  if (!istObjekt(roh)) return { ok: false, fehler: ["Die Datei muss mit Schlüsseln wie „name:“ beginnen."] };

  const fehler: string[] = [];
  unbekannteSchluessel(roh, ["name", "zeitzone", "fristen", "themenfokus", "notizfragen", "ris", "rollen", "gremien"], "", fehler);

  const name = text(roh, "name", "", fehler, { pflicht: true });
  const zeitzone = text(roh, "zeitzone", "", fehler) || "Europe/Berlin";
  if (!zeitzoneGueltig(zeitzone)) fehler.push(`zeitzone: „${zeitzone}“ ist keine bekannte Zeitzone (zum Beispiel Europe/Berlin)`);
  const themenfokus = text(roh, "themenfokus", "", fehler);

  // Fristen
  let fristVorTage = 7;
  let fristNachTage = 3;
  if (roh["fristen"] !== undefined) {
    if (!istObjekt(roh["fristen"])) fehler.push("fristen: muss die Einträge vor_sitzung_tage und nach_sitzung_tage enthalten");
    else {
      unbekannteSchluessel(roh["fristen"], ["vor_sitzung_tage", "nach_sitzung_tage"], "fristen.", fehler);
      fristVorTage = ganzzahl(roh["fristen"], "vor_sitzung_tage", 7, "fristen.", fehler);
      fristNachTage = ganzzahl(roh["fristen"], "nach_sitzung_tage", 3, "fristen.", fehler);
    }
  }

  // Notizfragen
  const notizfragen: Notizfrage[] = [];
  const fragen = roh["notizfragen"];
  if (!Array.isArray(fragen) || fragen.length === 0) fehler.push("notizfragen: mindestens die Frage „relevant“ ist nötig");
  else {
    const gesehen = new Set<string>();
    fragen.forEach((f, i) => {
      const pfad = `notizfragen[${i + 1}].`;
      if (!istObjekt(f)) return void fehler.push(`notizfragen[${i + 1}]: muss ein Eintrag mit schluessel, frage, typ sein`);
      unbekannteSchluessel(f, ["schluessel", "frage", "typ", "pflicht"], pfad, fehler);
      const schluessel = text(f, "schluessel", pfad, fehler, { pflicht: true });
      const frage = text(f, "frage", pfad, fehler, { pflicht: true });
      const typ = f["typ"] ?? "text";
      if (typ !== "ja-nein" && typ !== "text") fehler.push(`${pfad}typ: muss „ja-nein“ oder „text“ sein`);
      if (f["pflicht"] !== undefined && typeof f["pflicht"] !== "boolean") fehler.push(`${pfad}pflicht: muss true oder false sein`);
      if (schluessel && !/^[a-z][a-z0-9_-]*$/.test(schluessel)) fehler.push(`${pfad}schluessel: nur Kleinbuchstaben, Ziffern, _ und -, beginnend mit einem Buchstaben`);
      if (gesehen.has(schluessel)) fehler.push(`${pfad}schluessel: „${schluessel}“ kommt doppelt vor`);
      gesehen.add(schluessel);
      notizfragen.push({
        schluessel,
        frage,
        typ: typ === "ja-nein" ? "ja-nein" : "text",
        pflicht: f["pflicht"] === true || schluessel === "relevant",
      });
    });
    const relevant = notizfragen.find((f) => f.schluessel === "relevant");
    if (!relevant) fehler.push("notizfragen: die Frage mit dem Schlüssel „relevant“ fehlt");
    else if (relevant.typ !== "ja-nein") fehler.push("notizfragen: die Frage „relevant“ muss den Typ „ja-nein“ haben");
  }

  // RIS
  let ris: Instanz["ris"] = { adapter: "manuell", quelle: "" };
  if (roh["ris"] !== undefined) {
    if (!istObjekt(roh["ris"])) fehler.push("ris: muss adapter und quelle enthalten");
    else {
      unbekannteSchluessel(roh["ris"], ["adapter", "quelle"], "ris.", fehler);
      const adapter = text(roh["ris"], "adapter", "ris.", fehler) || "manuell";
      const quelle = text(roh["ris"], "quelle", "ris.", fehler);
      if (!RIS_ADAPTER.includes(adapter as RisAdapterName)) fehler.push(`ris.adapter: „${adapter}“ ist unbekannt, möglich sind ${RIS_ADAPTER.join(", ")}`);
      else if (adapter !== "manuell") {
        if (!quelle) fehler.push(`ris.quelle: für den Adapter „${adapter}“ nötig (Adresse des RIS)`);
        else if (!/^https?:\/\/[^\s/]+/.test(quelle)) fehler.push("ris.quelle: muss eine Adresse mit https:// sein");
      }
      ris = { adapter: adapter as RisAdapterName, quelle };
    }
  }

  // Rollen
  const rollen = { mitglied: "mitglied", admin: "admin" };
  if (roh["rollen"] !== undefined) {
    if (!istObjekt(roh["rollen"])) fehler.push("rollen: muss mitglied und admin enthalten");
    else {
      unbekannteSchluessel(roh["rollen"], ["mitglied", "admin"], "rollen.", fehler);
      rollen.mitglied = text(roh["rollen"], "mitglied", "rollen.", fehler) || rollen.mitglied;
      rollen.admin = text(roh["rollen"], "admin", "rollen.", fehler) || rollen.admin;
    }
  }
  if (rollen.mitglied === rollen.admin) fehler.push("rollen: mitglied und admin müssen verschiedene Namen haben");

  // Gremien
  const gremien: GremiumSoll[] = [];
  const g = roh["gremien"];
  if (!Array.isArray(g) || g.length === 0) fehler.push("gremien: mindestens ein Gremium ist nötig");
  else {
    const namen = new Set<string>();
    g.forEach((eintrag, i) => {
      const pfad = `gremien[${i + 1}].`;
      if (!istObjekt(eintrag)) return void fehler.push(`gremien[${i + 1}]: muss ein Eintrag mit name sein`);
      unbekannteSchluessel(eintrag, ["name", "ris_kennung", "aktiv"], pfad, fehler);
      const n = text(eintrag, "name", pfad, fehler, { pflicht: true });
      if (eintrag["aktiv"] !== undefined && typeof eintrag["aktiv"] !== "boolean") fehler.push(`${pfad}aktiv: muss true oder false sein`);
      if (n && namen.has(n)) fehler.push(`${pfad}name: „${n}“ kommt doppelt vor`);
      namen.add(n);
      gremien.push({ name: n, risKennung: text(eintrag, "ris_kennung", pfad, fehler), aktiv: eintrag["aktiv"] !== false });
    });
  }

  if (fehler.length > 0) return { ok: false, fehler };
  return { ok: true, instanz: { name, zeitzone, fristVorTage, fristNachTage, themenfokus, notizfragen, ris, rollen, gremien } };
}

// --- Plan: was ändert sich in Directus? ------------------------------------

/** Felder der Sammlung „einstellungen“, wie sie die instanz.yaml vorgibt. */
export function einstellungenSoll(i: Instanz): Record<string, unknown> {
  return {
    name: i.name,
    zeitzone: i.zeitzone,
    frist_vor_tage: i.fristVorTage,
    frist_nach_tage: i.fristNachTage,
    themenfokus: i.themenfokus || null,
    notizfragen: i.notizfragen,
    ris_adapter: i.ris.adapter,
    ris_quelle: i.ris.quelle || null,
  };
}

export interface FeldAenderung {
  feld: string;
  alt: unknown;
  neu: unknown;
}

export interface GremiumZeile {
  id: string;
  name: string;
  ris_kennung?: string | null;
  aktiv?: boolean | null;
}

export type GremiumAenderung =
  | { art: "anlegen"; name: string; daten: Record<string, unknown> }
  | { art: "aendern"; name: string; id: string; daten: Record<string, unknown>; aenderungen: FeldAenderung[] };

export interface Plan {
  einstellungen: FeldAenderung[];
  gremien: GremiumAenderung[];
  /** Gremien in Directus, die nicht in der instanz.yaml stehen. Sie bleiben unberührt. */
  unbekannteGremien: string[];
}

const gleich = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Vergleicht Soll (instanz.yaml) und Ist (Directus). Reine Funktion, löscht nie etwas. */
export function planen(i: Instanz, istEinstellungen: Record<string, unknown>, istGremien: GremiumZeile[]): Plan {
  const einstellungen: FeldAenderung[] = [];
  for (const [feld, neu] of Object.entries(einstellungenSoll(i))) {
    const alt = istEinstellungen[feld];
    // leere Texte und fehlende Werte gelten als gleich
    if (!gleich(alt === "" ? null : alt, neu)) einstellungen.push({ feld, alt: alt ?? null, neu });
  }

  const gremien: GremiumAenderung[] = [];
  const vorhanden = new Map(istGremien.map((g) => [g.name, g]));
  for (const soll of i.gremien) {
    const daten = { name: soll.name, ris_kennung: soll.risKennung || null, aktiv: soll.aktiv };
    const ist = vorhanden.get(soll.name);
    if (!ist) {
      gremien.push({ art: "anlegen", name: soll.name, daten });
      continue;
    }
    const aenderungen: FeldAenderung[] = [];
    if (!gleich(ist.ris_kennung === "" ? null : ist.ris_kennung, daten.ris_kennung)) aenderungen.push({ feld: "ris_kennung", alt: ist.ris_kennung ?? null, neu: daten.ris_kennung });
    if (Boolean(ist.aktiv) !== daten.aktiv) aenderungen.push({ feld: "aktiv", alt: Boolean(ist.aktiv), neu: daten.aktiv });
    if (aenderungen.length > 0) {
      gremien.push({ art: "aendern", name: soll.name, id: ist.id, daten: Object.fromEntries(aenderungen.map((a) => [a.feld, a.neu])), aenderungen });
    }
  }
  const sollNamen = new Set(i.gremien.map((g) => g.name));
  return { einstellungen, gremien, unbekannteGremien: istGremien.map((g) => g.name).filter((n) => !sollNamen.has(n)) };
}

export const planLeer = (p: Plan) => p.einstellungen.length === 0 && p.gremien.length === 0;
