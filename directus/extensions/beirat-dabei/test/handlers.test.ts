import { beforeEach, describe, expect, it } from "vitest";
import {
  STANDARD_EINSTELLUNGEN,
  tokenErzeugen,
  type Notiz,
  type SitzungInfo,
  type Teilnahme,
} from "@beirat-dabei/core";
import {
  dashboard,
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

const deps = (): Abhaengigkeiten => ({ speicher, geheimnis: GEHEIM, jetzt: () => jetzt });
const link = (a: "eintragen" | "austragen" | "nicht-teilgenommen" | "notiz", m = "a", s = "s1", zeit = jetzt) =>
  tokenErzeugen({ a, m, s }, GEHEIM, zeit);

beforeEach(() => {
  teilnahmen = [];
  notizen = [];
  zaehler = 0;
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
