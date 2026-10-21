import { beforeEach, describe, expect, it } from "vitest";
import {
  STANDARD_EINSTELLUNGEN,
  aboTokenErzeugen,
  tokenErzeugen,
  type Notiz,
  type SitzungInfo,
  type Teilnahme,
} from "@beirat-dabei/core";
import {
  abo,
  dashboard,
  ical,
  linkBestaetigen,
  linkInfo,
  notiz,
  teilnahme,
  type Abhaengigkeiten,
  type Speicher,
} from "../src/handlers.js";

const d = (iso: string) => new Date(iso);
const GEHEIM = "geheim";

let teilnahmen: Teilnahme[];
let notizen: Notiz[];
let jetzt: Date;
let zaehler: number;
let aboVersion: number;

const sitzungen: SitzungInfo[] = [
  { id: "s1", gremiumId: "g", gremiumName: "BUA", start: d("2026-11-18T17:00:00Z"), abgesagt: false, toVeroeffentlicht: false },
  { id: "abg", gremiumId: "g", gremiumName: "BUA", start: d("2026-12-02T17:00:00Z"), abgesagt: true, toVeroeffentlicht: false },
];
const mitglieder = [
  { id: "a", aktiv: true, name: "Anna" },
  { id: "b", aktiv: true, name: "Bernd" },
  { id: "x", aktiv: false, name: "Xaver" },
];

const speicher: Speicher = {
  einstellungen: async () => ({
    einstellungen: STANDARD_EINSTELLUNGEN,
    name: "Umweltbeirat Kremmen",
    aboVersion,
    notizfragen: [
      { schluessel: "relevant", frage: "Relevant?", typ: "ja-nein", pflicht: true },
      { schluessel: "beschluesse", frage: "Beschlüsse?", typ: "text", pflicht: true },
    ],
  }),
  mitglieder: async () => mitglieder,
  sitzungen: async () => sitzungen,
  sitzung: async (id) => sitzungen.find((s) => s.id === id) ?? null,
  teilnahmen: async (id) => teilnahmen.filter((t) => !id || t.sitzungId === id),
  teilnahmeAnlegen: async (daten) => void teilnahmen.push({ id: `t${++zaehler}`, ...daten }),
  teilnahmeAendern: async (id, daten) => {
    const t = teilnahmen.find((x) => x.id === id)!;
    Object.assign(t, daten);
  },
  notizen: async () => notizen,
  notizSpeichern: async (sitzungId, wert) => {
    notizen = notizen.filter((n) => n.sitzungId !== sitzungId);
    notizen.push({ sitzungId, ...wert });
  },
};

const deps = (): Abhaengigkeiten => ({
  speicher, geheimnis: GEHEIM, jetzt: () => jetzt, publicUrl: "https://beirat.example/", sitzungsdauerStunden: 3,
});
const link = (a: "eintragen" | "austragen" | "nicht-teilgenommen" | "notiz", m = "a", s = "s1", zeit = jetzt) =>
  tokenErzeugen({ a, m, s }, GEHEIM, zeit);

beforeEach(() => {
  teilnahmen = [];
  notizen = [];
  zaehler = 0;
  aboVersion = 1;
  jetzt = d("2026-11-10T08:00:00Z");
});

describe("Zugriffsschutz", () => {
  it("ohne Anmeldung 401", async () => {
    expect((await dashboard(deps(), null)).status).toBe(401);
    expect((await teilnahme(deps(), null, { sitzung: "s1", aktion: "eintragen" })).status).toBe(401);
    expect((await notiz(deps(), null, {})).status).toBe(401);
  });
  it("Nutzer ohne Mitgliedsrolle oder inaktive: 403", async () => {
    expect((await dashboard(deps(), "fremd")).status).toBe(403);
    expect((await teilnahme(deps(), "x", { sitzung: "s1", aktion: "eintragen" })).status).toBe(403);
  });
});

describe("teilnahme", () => {
  it("trägt eigene Person ein und aus", async () => {
    expect((await teilnahme(deps(), "a", { sitzung: "s1", aktion: "eintragen" })).status).toBe(200);
    expect(teilnahmen).toHaveLength(1);
    expect(teilnahmen[0]).toMatchObject({ mitgliedId: "a", sitzungId: "s1" });
    expect((await teilnahme(deps(), "a", { sitzung: "s1", aktion: "austragen" })).status).toBe(200);
    expect(teilnahmen[0]!.ausgetragenAm).toEqual(jetzt);
  });
  it("die Person kommt aus der Anmeldung, nicht aus der Eingabe", async () => {
    await teilnahme(deps(), "a", { sitzung: "s1", aktion: "eintragen", mitglied: "b" } as never);
    expect(teilnahmen.map((t) => t.mitgliedId)).toEqual(["a"]);
  });
  it("ungültige Eingabe 400, unbekannte Sitzung 404, abgesagt 409", async () => {
    expect((await teilnahme(deps(), "a", { sitzung: "s1", aktion: "löschen" })).status).toBe(400);
    expect((await teilnahme(deps(), "a", { sitzung: "nix", aktion: "eintragen" })).status).toBe(404);
    expect(await teilnahme(deps(), "a", { sitzung: "abg", aktion: "eintragen" })).toEqual({
      status: 409, body: { fehler: "abgesagt" },
    });
  });
});

describe("dashboard", () => {
  it("liefert Sitzungen mit Namen und eigenem Status, keine E-Mails", async () => {
    await teilnahme(deps(), "b", { sitzung: "s1", aktion: "eintragen" });
    const r = await dashboard(deps(), "a");
    expect(r.status).toBe(200);
    const body = r.body as { kommend: { id: string; teilnehmer: { name: string }[]; ichTeilnehmend: boolean }[]; notizfragen: unknown[] };
    expect(body.kommend[0]).toMatchObject({ id: "s1", ichTeilnehmend: false, teilnehmer: [{ name: "Bernd" }] });
    expect(body.notizfragen).toHaveLength(2);
    expect(r.body).toMatchObject({ instanz: { name: "Umweltbeirat Kremmen", zeitzone: "Europe/Berlin" }, ich: "a" });
  });
});

describe("notiz", () => {
  const eingabe = { sitzung: "s1", relevant: true, antworten: { beschluesse: "vertagt" } };
  beforeEach(() => {
    teilnahmen = [{ id: "t1", sitzungId: "s1", mitgliedId: "a", eingetragenAm: d("2026-11-01T00:00:00Z"), nichtTeilgenommen: false }];
  });

  it("vor der Sitzung 409", async () => {
    expect((await notiz(deps(), "a", eingabe)).status).toBe(409);
  });
  it("nach der Sitzung speichert Teilnehmende, andere nicht", async () => {
    jetzt = d("2026-11-19T08:00:00Z");
    expect((await notiz(deps(), "b", eingabe)).status).toBe(403);
    expect((await notiz(deps(), "a", eingabe)).status).toBe(200);
    expect(notizen[0]).toMatchObject({ sitzungId: "s1", relevant: true, antworten: { beschluesse: "vertagt" } });
  });
  it("Pflichtfeld fehlt: 400 mit Feldnamen", async () => {
    jetzt = d("2026-11-19T08:00:00Z");
    const r = await notiz(deps(), "a", { sitzung: "s1", relevant: true, antworten: {} });
    expect(r).toEqual({ status: 400, body: { fehler: "ungueltige-eingabe", felder: ["beschluesse"] } });
  });
});

describe("Magic Links", () => {
  it("Info ändert nichts", async () => {
    const r = await linkInfo(deps(), link("eintragen"));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ aktion: "eintragen", mitglied: "Anna", bereitsEingetragen: false, sitzung: { gremium: "BUA" } });
    expect(teilnahmen).toHaveLength(0);
  });
  it("Bestätigen trägt ein und liefert Rückgängig-Link, der austrägt", async () => {
    const r = await linkBestaetigen(deps(), link("eintragen"));
    expect(r.status).toBe(200);
    expect(teilnahmen).toHaveLength(1);
    const undo = (r.body as { rueckgaengig: string }).rueckgaengig;
    expect((await linkBestaetigen(deps(), undo)).status).toBe(200);
    expect(teilnahmen[0]!.ausgetragenAm).toBeTruthy();
  });
  it("doppelter Klick ist folgenlos", async () => {
    const t = link("eintragen");
    await linkBestaetigen(deps(), t);
    const zweiter = await linkBestaetigen(deps(), t);
    expect(zweiter.status).toBe(200);
    expect(teilnahmen).toHaveLength(1);
  });
  it("abgelaufen 410, manipuliert 400, inaktives Mitglied 403", async () => {
    const alt = link("eintragen", "a", "s1", d("2026-11-10T07:00:00Z"));
    expect((await linkBestaetigen(deps(), alt)).status).toBe(410);
    expect((await linkBestaetigen(deps(), link("eintragen") + "x")).status).toBe(400);
    expect((await linkBestaetigen(deps(), link("eintragen", "x"))).status).toBe(403);
    expect(teilnahmen).toHaveLength(0);
  });
  it("Notiz-Link schreibt die Notiz", async () => {
    jetzt = d("2026-11-19T08:00:00Z");
    teilnahmen = [{ id: "t1", sitzungId: "s1", mitgliedId: "a", eingetragenAm: d("2026-11-01T00:00:00Z"), nichtTeilgenommen: false }];
    const t = link("notiz");
    const info = await linkInfo(deps(), t);
    expect((info.body as { notizfragen: unknown[] }).notizfragen).toHaveLength(2);
    const r = await linkBestaetigen(deps(), t, { relevant: false, antworten: { beschluesse: "nichts" } });
    expect(r.status).toBe(200);
    expect(notizen).toHaveLength(1);
  });
  it("'nicht teilgenommen' per Link", async () => {
    teilnahmen = [{ id: "t1", sitzungId: "s1", mitgliedId: "a", eingetragenAm: d("2026-11-01T00:00:00Z"), nichtTeilgenommen: false }];
    jetzt = d("2026-11-19T08:00:00Z");
    const r = await linkBestaetigen(deps(), link("nicht-teilgenommen", "a", "s1", jetzt));
    expect(r.status).toBe(200);
    expect(teilnahmen[0]!.nichtTeilgenommen).toBe(true);
    expect((r.body as { rueckgaengig: unknown }).rueckgaengig).toBeNull();
  });
});

describe("Kalender-Abo", () => {
  const abosUrl = async (nutzer: string) => {
    const r = await abo(deps(), nutzer);
    return (r.body as { url: string }).url;
  };
  const tokenAusUrl = (u: string) => u.split("/ical/")[1]!;

  it("/abo nur für angemeldete Mitglieder", async () => {
    expect((await abo(deps(), null)).status).toBe(401);
    expect((await abo(deps(), "x")).status).toBe(403);
    const r = await abo(deps(), "a");
    expect(r.status).toBe(200);
    const b = r.body as { url: string; webcal: string };
    expect(b.url).toMatch(/^https:\/\/beirat\.example\/beirat-dabei\/ical\/.+\.ics$/);
    expect(b.webcal).toBe(b.url.replace("https:", "webcal:"));
  });

  it("liefert den Feed mit Terminen, Teilnehmenden und Tagesordnung", async () => {
    teilnahmen = [{ id: "t1", sitzungId: "s1", mitgliedId: "a", eingetragenAm: d("2026-11-01T00:00:00Z"), nichtTeilgenommen: false }];
    const r = await ical(deps(), tokenAusUrl(await abosUrl("a")));
    expect(r.status).toBe(200);
    expect(r.typ).toContain("text/calendar");
    expect(r.kopf?.["cache-control"]).toContain("private");
    const t = r.body as string;
    expect(t).toContain("BEGIN:VCALENDAR");
    expect(t).toContain("X-WR-CALNAME:Umweltbeirat Kremmen");
    expect(t).toContain("UID:s1@beirat.example");
    expect(t).toContain("DTSTART:20261118T170000Z");
    expect(t).toContain("DTEND:20261118T200000Z");
    expect(t).toContain("SUMMARY:BUA");
    const entfaltet = t.replace(/\r\n /g, "");
    expect(entfaltet).toContain("Dabei: Anna (du bist eingetragen)");
    expect(entfaltet).toContain("Tagesordnung: noch nicht veröffentlicht");
    // Für andere Mitglieder fehlt der Zusatz
    const fuerBernd = (await ical(deps(), tokenAusUrl(await abosUrl("b")))).body as string;
    expect(fuerBernd.replace(/\r\n /g, "")).toContain("Dabei: Anna\\n");
    expect(fuerBernd).not.toContain("du bist eingetragen");
  });

  it("abgesagte Sitzungen sind markiert", async () => {
    const t = (await ical(deps(), tokenAusUrl(await abosUrl("a")))).body as string;
    expect(t).toContain("SUMMARY:ABGESAGT: BUA");
    expect(t).toContain("STATUS:CANCELLED");
  });

  it("keine E-Mail-Adressen und keine Token im Feed", async () => {
    const u = await abosUrl("a");
    const t = (await ical(deps(), tokenAusUrl(u))).body as string;
    expect(t).not.toContain("@example.com");
    expect(t).not.toContain(tokenAusUrl(u));
  });

  it("sehr alte Sitzungen fehlen", async () => {
    jetzt = d("2027-03-01T00:00:00Z");
    const t = (await ical(deps(), tokenAusUrl(await abosUrl("a")))).body as string;
    expect(t).not.toContain("BEGIN:VEVENT");
  });

  it("falscher Token, inaktives Mitglied und neue Version: 404", async () => {
    const u = await abosUrl("a");
    expect((await ical(deps(), "quatsch.ics")).status).toBe(404);
    expect((await ical(deps(), tokenAusUrl(u) + "x")).status).toBe(404);
    const inaktiv = aboTokenErzeugen("x", GEHEIM, 1) + ".ics";
    expect((await ical(deps(), inaktiv)).status).toBe(404);
    const unbekannt = aboTokenErzeugen("niemand", GEHEIM, 1) + ".ics";
    expect((await ical(deps(), unbekannt)).status).toBe(404);
    aboVersion = 2;
    expect((await ical(deps(), tokenAusUrl(u))).status).toBe(404);
    expect((await ical(deps(), tokenAusUrl(await abosUrl("a")))).status).toBe(200);
  });

  it("ein Magic-Link-Token öffnet den Feed nicht", async () => {
    expect((await ical(deps(), link("eintragen"))).status).toBe(404);
  });
});
