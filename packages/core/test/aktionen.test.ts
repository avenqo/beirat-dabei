import { describe, expect, it } from "vitest";
import {
  STANDARD_EINSTELLUNGEN,
  dashboardBauen,
  notizPruefen,
  teilnahmeAnwenden,
  type Notizfrage,
  type Sitzung,
  type Teilnahme,
} from "../src/index.js";

const d = (iso: string) => new Date(iso);
const sitzung: Sitzung = {
  id: "s1", gremiumId: "g1", start: d("2026-11-18T17:00:00Z"), abgesagt: false, toVeroeffentlicht: false,
};
const vorher = d("2026-11-10T08:00:00Z");
const nachher = d("2026-11-19T08:00:00Z");
const tn = (extra: Partial<Teilnahme> = {}): Teilnahme => ({
  id: "t1", sitzungId: "s1", mitgliedId: "a", eingetragenAm: d("2026-11-01T08:00:00Z"), nichtTeilgenommen: false, ...extra,
});
const anwenden = (aktion: Parameters<typeof teilnahmeAnwenden>[0]["aktion"], teilnahmen: Teilnahme[], jetzt = vorher, s = sitzung) =>
  teilnahmeAnwenden({ aktion, sitzung: s, teilnahmen, mitgliedId: "a", jetzt });

describe("teilnahmeAnwenden: eintragen", () => {
  it("legt eine Teilnahme an", () => {
    const r = anwenden("eintragen", []);
    expect(r).toMatchObject({ ok: true, aenderung: { art: "anlegen", daten: { sitzungId: "s1", mitgliedId: "a" } } });
  });
  it("ist wiederholbar ohne Folgen", () => {
    expect(anwenden("eintragen", [tn()])).toEqual({ ok: true, aenderung: { art: "keine" } });
  });
  it("trägt eine ausgetragene Person wieder ein und setzt eingetragenAm neu", () => {
    const r = anwenden("eintragen", [tn({ ausgetragenAm: d("2026-11-05T00:00:00Z") })]);
    expect(r).toEqual({
      ok: true,
      aenderung: { art: "aktualisieren", id: "t1", daten: { eingetragenAm: vorher, ausgetragenAm: null, nichtTeilgenommen: false } },
    });
  });
  it("nicht bei abgesagter oder vergangener Sitzung", () => {
    expect(anwenden("eintragen", [], vorher, { ...sitzung, abgesagt: true })).toEqual({ ok: false, grund: "abgesagt" });
    expect(anwenden("eintragen", [], nachher)).toEqual({ ok: false, grund: "vergangen" });
  });
  it("ignoriert Teilnahmen anderer Personen", () => {
    const r = anwenden("eintragen", [tn({ id: "t9", mitgliedId: "b" })]);
    expect(r).toMatchObject({ ok: true, aenderung: { art: "anlegen" } });
  });
});

describe("teilnahmeAnwenden: austragen", () => {
  it("setzt ausgetragenAm", () => {
    expect(anwenden("austragen", [tn()])).toEqual({
      ok: true, aenderung: { art: "aktualisieren", id: "t1", daten: { ausgetragenAm: vorher } },
    });
  });
  it("ohne Eintrag oder doppelt: keine Änderung", () => {
    expect(anwenden("austragen", [])).toEqual({ ok: true, aenderung: { art: "keine" } });
    expect(anwenden("austragen", [tn({ ausgetragenAm: d("2026-11-05T00:00:00Z") })])).toEqual({ ok: true, aenderung: { art: "keine" } });
  });
  it("nach Beginn nicht mehr", () => {
    expect(anwenden("austragen", [tn()], nachher)).toEqual({ ok: false, grund: "vergangen" });
  });
});

describe("teilnahmeAnwenden: nicht-teilgenommen", () => {
  it("erst nach Beginn und nur für Eingetragene", () => {
    expect(anwenden("nicht-teilgenommen", [tn()], vorher)).toEqual({ ok: false, grund: "nicht-vorbei" });
    expect(anwenden("nicht-teilgenommen", [], nachher)).toEqual({ ok: false, grund: "nicht-eingetragen" });
    expect(anwenden("nicht-teilgenommen", [tn()], nachher)).toEqual({
      ok: true, aenderung: { art: "aktualisieren", id: "t1", daten: { nichtTeilgenommen: true } },
    });
  });
  it("wiederholbar", () => {
    expect(anwenden("nicht-teilgenommen", [tn({ nichtTeilgenommen: true })], nachher)).toEqual({ ok: true, aenderung: { art: "keine" } });
  });
});

describe("teilnahmeAnwenden: dabei-gewesen", () => {
  it("trägt nachträglich ein, nur nach Beginn", () => {
    expect(anwenden("dabei-gewesen", [], nachher)).toMatchObject({ ok: true, aenderung: { art: "anlegen", daten: { mitgliedId: "a", sitzungId: "s1" } } });
    expect(anwenden("dabei-gewesen", [], vorher)).toEqual({ ok: false, grund: "nicht-vorbei" });
    expect(anwenden("dabei-gewesen", [], nachher, { ...sitzung, abgesagt: true })).toEqual({ ok: false, grund: "abgesagt" });
  });
  it("wiederholbar, nimmt 'doch nicht dabei' zurück und belebt Ausgetragene wieder", () => {
    expect(anwenden("dabei-gewesen", [tn()], nachher)).toEqual({ ok: true, aenderung: { art: "keine" } });
    expect(anwenden("dabei-gewesen", [tn({ nichtTeilgenommen: true })], nachher)).toEqual({
      ok: true, aenderung: { art: "aktualisieren", id: "t1", daten: { nichtTeilgenommen: false } },
    });
    expect(anwenden("dabei-gewesen", [tn({ ausgetragenAm: d("2026-11-05T00:00:00Z") })], nachher)).toEqual({
      ok: true,
      aenderung: { art: "aktualisieren", id: "t1", daten: { eingetragenAm: nachher, ausgetragenAm: null, nichtTeilgenommen: false } },
    });
  });
});

const fragen: Notizfrage[] = [
  { schluessel: "relevant", frage: "Relevant?", typ: "ja-nein", pflicht: true },
  { schluessel: "tops", frage: "TOPs?", typ: "text", pflicht: false },
  { schluessel: "beschluesse", frage: "Beschlüsse?", typ: "text", pflicht: true },
];

describe("notizPruefen", () => {
  it("nimmt gültige Eingabe an und trimmt", () => {
    expect(notizPruefen({ relevant: true, antworten: { beschluesse: " ja ", tops: "", x: "weg" } }, fragen)).toEqual({
      ok: true, wert: { relevant: true, antworten: { beschluesse: "ja" } },
    });
  });
  it("meldet fehlendes relevant und fehlende Pflichtfelder", () => {
    expect(notizPruefen({ antworten: {} }, fragen)).toEqual({ ok: false, fehler: ["relevant", "beschluesse"] });
  });
  it("lehnt Müll und überlange Texte ab", () => {
    expect(notizPruefen(null, fragen)).toMatchObject({ ok: false });
    expect(notizPruefen({ relevant: false, antworten: { beschluesse: "x".repeat(5001) } }, fragen)).toEqual({ ok: false, fehler: ["beschluesse"] });
  });
  it("relevant als Text reicht nicht", () => {
    expect(notizPruefen({ relevant: "ja", antworten: { beschluesse: "x" } }, fragen)).toEqual({ ok: false, fehler: ["relevant"] });
  });
});

describe("dashboardBauen", () => {
  const info = (id: string, start: string, extra = {}) => ({ ...sitzung, id, start: d(start), gremiumName: "BUA", ...extra });
  const z = {
    jetzt: d("2026-11-10T08:00:00Z"),
    einstellungen: STANDARD_EINSTELLUNGEN,
    mitglieder: [{ id: "a", aktiv: true }, { id: "b", aktiv: true }, { id: "x", aktiv: false }],
    sitzungen: [
      info("s2", "2026-12-16T17:00:00Z"),
      info("s1", "2026-11-18T17:00:00Z"),
      info("alt", "2026-10-14T17:00:00Z"),
      info("alt2", "2026-09-09T17:00:00Z"),
    ],
    teilnahmen: [
      tn({ id: "t1", sitzungId: "s1", mitgliedId: "b" }),
      tn({ id: "t2", sitzungId: "s1", mitgliedId: "a" }),
      tn({ id: "t3", sitzungId: "s1", mitgliedId: "x" }),
    ],
    notizen: [{ sitzungId: "alt", relevant: true, antworten: {} }],
    versand: [],
  };
  const namen = new Map([["a", "Anna"], ["b", "Bernd"], ["x", "Xaver"]]);

  it("trennt kommende und vergangene und sortiert", () => {
    const v = dashboardBauen(z, namen, "a");
    expect(v.kommend.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(v.vergangen.map((s) => s.id)).toEqual(["alt", "alt2"]);
  });
  it("zeigt aktive Teilnehmende mit Namen, markiert die eigene Teilnahme", () => {
    const s1 = dashboardBauen(z, namen, "a").kommend[0]!;
    expect(s1.teilnehmer.map((t) => t.name)).toEqual(["Anna", "Bernd"]);
    expect(s1.ichTeilnehmend).toBe(true);
    expect(s1.status).toBe("besetzt");
    expect(dashboardBauen(z, namen, "b").kommend[1]!.ichTeilnehmend).toBe(false);
  });
  it("Notiz nur bei vergangenen Sitzungen", () => {
    const v = dashboardBauen(z, namen, "a");
    expect(v.vergangen[0]!.notiz).toMatchObject({ relevant: true });
    expect(v.vergangen[0]!.status).toBe("dokumentiert");
    expect(v.vergangen[1]!.status).toBe("notiz-fehlt");
    expect(v.kommend[0]!.notiz).toBeNull();
  });
  it("wer 'doch nicht dabei' gemeldet hat, steht nicht mehr bei den Teilnehmenden", () => {
    const z2 = { ...z, jetzt: d("2026-11-19T08:00:00Z"), teilnahmen: [tn({ id: "t1", sitzungId: "s1", mitgliedId: "a", nichtTeilgenommen: true })] };
    const s1 = dashboardBauen(z2, namen, "a").vergangen.find((s) => s.id === "s1")!;
    expect(s1.teilnehmer).toEqual([]);
    expect(s1.ichTeilnehmend).toBe(false);
  });
  it("gibt keine E-Mail-Adressen heraus", () => {
    expect(JSON.stringify(dashboardBauen(z, namen, "a"))).not.toContain("@");
  });
});
