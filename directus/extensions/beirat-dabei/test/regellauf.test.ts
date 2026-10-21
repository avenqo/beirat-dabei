import { beforeEach, describe, expect, it } from "vitest";
import { STANDARD_EINSTELLUNGEN, tokenPruefen, type Notiz, type SitzungInfo, type Teilnahme, type Versand } from "@beirat-dabei/core";
import { regellaufAusfuehren, type Empfaenger, type Mailer, type Modus, type RegelSpeicher } from "../src/regellauf.js";
import type { Mail } from "../src/mail.js";

const d = (iso: string) => new Date(iso);
const GEHEIM = "geheim";

let teilnahmen: Teilnahme[];
let notizen: Notiz[];
let versand: Versand[];
let gesendet: (Mail & { an: string })[];
let sitzungen: SitzungInfo[];
let fehlerBei: string | null;

const leute: Empfaenger[] = [
  { id: "a", aktiv: true, name: "Anna", email: "anna@example.com" },
  { id: "b", aktiv: true, name: "Bernd", email: "bernd@example.com" },
];

const speicher: RegelSpeicher = {
  einstellungen: async () => ({ einstellungen: STANDARD_EINSTELLUNGEN, notizfragen: [], name: "Umweltbeirat Kremmen" }),
  mitglieder: async () => leute,
  empfaenger: async () => leute,
  sitzungen: async () => sitzungen,
  sitzung: async (id) => sitzungen.find((s) => s.id === id) ?? null,
  teilnahmen: async () => teilnahmen,
  teilnahmeAnlegen: async () => {},
  teilnahmeAendern: async () => {},
  notizen: async () => notizen,
  notizSpeichern: async () => {},
  notizLoeschen: async () => false,
  versand: async () => versand,
  versandSchreiben: async (e) => void versand.push(...e),
};
const mailer: Mailer = {
  async senden(m) {
    if (fehlerBei === m.an) throw new Error("SMTP down");
    gesendet.push(m);
  },
};

const lauf = (jetzt: string, modus: Modus = "scharf") =>
  regellaufAusfuehren({
    speicher, mailer, modus,
    jetzt: () => d(jetzt),
    mail: { dashboardUrl: "https://beirat.example/dashboard", geheimnis: GEHEIM, nachlaufTage: 14, dauerStunden: 3 },
    log: { info: () => {}, error: () => {} },
  });

beforeEach(() => {
  teilnahmen = [];
  notizen = [];
  versand = [];
  gesendet = [];
  fehlerBei = null;
  sitzungen = [{
    id: "s1", gremiumId: "g", gremiumName: "Bau- und Umweltausschuss", ort: "Rathaus",
    start: d("2026-11-18T17:00:00Z"), abgesagt: false, toVeroeffentlicht: true, toLink: "https://ris.example/to/1",
  }];
});

describe("Regellauf", () => {
  it("verschickt fällige Mails und schreibt das Protokoll", async () => {
    const r = await lauf("2026-11-01T06:00:00Z");
    expect(r).toEqual({ faellig: 2, gesendet: 2, fehlgeschlagen: 0 });
    expect(gesendet.map((m) => m.an).sort()).toEqual(["anna@example.com", "bernd@example.com"]);
    expect(versand).toHaveLength(2);
  });

  it("zweiter Lauf schickt nichts mehr", async () => {
    await lauf("2026-11-01T06:00:00Z");
    expect(await lauf("2026-11-01T06:05:00Z")).toMatchObject({ faellig: 0, gesendet: 0 });
    expect(gesendet).toHaveLength(2);
  });

  it("Trockenmodus versendet nichts und schreibt kein Protokoll", async () => {
    const r = await lauf("2026-11-01T06:00:00Z", "trocken");
    expect(r.faellig).toBe(2);
    expect(gesendet).toHaveLength(0);
    expect(versand).toHaveLength(0);
  });

  it("Modus aus tut nichts", async () => {
    expect(await lauf("2026-11-01T06:00:00Z", "aus")).toEqual({ faellig: 0, gesendet: 0, fehlgeschlagen: 0 });
  });

  it("fehlgeschlagener Versand bleibt ohne Protokoll und wird wiederholt", async () => {
    fehlerBei = "bernd@example.com";
    expect(await lauf("2026-11-01T06:00:00Z")).toEqual({ faellig: 2, gesendet: 1, fehlgeschlagen: 1 });
    expect(versand).toHaveLength(1);
    fehlerBei = null;
    expect(await lauf("2026-11-01T07:00:00Z")).toMatchObject({ faellig: 1, gesendet: 1 });
    expect(gesendet).toHaveLength(2);
  });

  it("sehr alte Sitzungen werden ignoriert", async () => {
    expect((await lauf("2027-03-01T06:00:00Z")).faellig).toBe(0);
  });

  it("späte TO: R1 und R3 in einer Mail mit Magic Link, der bis 14 Tage nach der Sitzung gilt", async () => {
    await lauf("2026-11-14T06:00:00Z");
    const m = gesendet.find((x) => x.an === "anna@example.com")!;
    expect(m.betreff).toContain("noch niemand eingetragen");
    expect(m.text).toContain("https://ris.example/to/1");
    const token = new URL(m.text.match(/https:\/\/beirat\.example\/dashboard\/link\.html\?token=\S+/)![0]).searchParams.get("token")!;
    const spaet = tokenPruefen(token, GEHEIM, d("2026-12-02T19:00:00Z"));
    expect(spaet.ok && spaet.token).toMatchObject({ a: "eintragen", m: "a", s: "s1" });
    expect(tokenPruefen(token, GEHEIM, d("2026-12-02T21:00:00Z"))).toEqual({ ok: false, grund: "abgelaufen" });
  });

  it("R2 nennt den Namen der Person, die sich eingetragen hat", async () => {
    sitzungen[0]!.toVeroeffentlicht = false;
    teilnahmen = [{ id: "t1", sitzungId: "s1", mitgliedId: "a", eingetragenAm: d("2026-11-01T05:00:00Z"), nichtTeilgenommen: false }];
    await lauf("2026-11-01T06:00:00Z");
    expect(gesendet).toHaveLength(1);
    expect(gesendet[0]!.an).toBe("bernd@example.com");
    expect(gesendet[0]!.text).toContain("Anna nimmt an");
  });

  it("R1 an bereits Eingetragene ohne Teilnahme-Knopf", async () => {
    teilnahmen = [{ id: "t1", sitzungId: "s1", mitgliedId: "a", eingetragenAm: d("2026-11-01T05:00:00Z"), nichtTeilgenommen: false }];
    versand = [{ regel: "R2", sitzungId: "s1", empfaengerId: "b", bezug: "t1:2026-11-01T05:00:00.000Z" }];
    await lauf("2026-11-01T06:00:00Z");
    expect(gesendet.find((m) => m.an === "anna@example.com")!.text).not.toContain("Ich nehme teil");
    expect(gesendet.find((m) => m.an === "bernd@example.com")!.text).toContain("Ich nehme teil");
  });

  it("R5: Notiz-Link und 'nicht dabei'-Link an Teilnehmende", async () => {
    sitzungen[0]!.toVeroeffentlicht = false;
    teilnahmen = [{ id: "t1", sitzungId: "s1", mitgliedId: "a", eingetragenAm: d("2026-11-01T05:00:00Z"), nichtTeilgenommen: false }];
    versand = [{ regel: "R2", sitzungId: "s1", empfaengerId: "b", bezug: "t1:2026-11-01T05:00:00.000Z" }];
    await lauf("2026-11-21T06:00:00Z");
    expect(gesendet).toHaveLength(1);
    expect(gesendet[0]!.an).toBe("anna@example.com");
    expect(gesendet[0]!.text).toContain("Notiz schreiben");
    expect(gesendet[0]!.text).toContain("Ich war doch nicht dabei");
  });

  it("maskiert HTML in Namen und Orten", async () => {
    sitzungen[0]!.ort = "<b>Saal</b>";
    sitzungen[0]!.toVeroeffentlicht = false;
    await lauf("2026-11-11T06:00:00Z");
    expect(gesendet[0]!.html).not.toContain("<b>Saal</b>");
    expect(gesendet[0]!.html).toContain("&lt;b&gt;Saal&lt;/b&gt;");
  });
});
