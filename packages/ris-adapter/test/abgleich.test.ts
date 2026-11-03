import { describe, expect, it } from "vitest";
import { abgleichBerechnen, type BekannteSitzung, type RisSitzung, type RisTagesordnung } from "../src/index.js";

const d = (iso: string) => new Date(iso);
const jetzt = d("2026-10-20T08:00:00Z");
const zeitraum = { von: d("2026-10-13T00:00:00Z"), bis: d("2027-01-18T00:00:00Z") };

const ris = (extra: Partial<RisSitzung> = {}): RisSitzung => ({
  risId: "R1", gremium: "BUA", start: d("2026-11-12T18:00:00Z"), ende: null, ort: "Rathaus", risLink: "l1", abgesagt: false, ...extra,
});
const bekannt = (extra: Partial<BekannteSitzung> = {}): BekannteSitzung => ({
  id: "s1", risId: "R1", start: d("2026-11-12T18:00:00Z"), ort: "Rathaus", abgesagt: false, toVeroeffentlicht: false, toLink: null, risLink: "l1", ...extra,
});
const to = (extra: Partial<RisTagesordnung> = {}): RisTagesordnung => ({ veroeffentlicht: false, link: "to-link", tops: [], abgesagt: false, ...extra });

const lauf = (b: BekannteSitzung[], r: RisSitzung[], tos: Record<string, RisTagesordnung> = {}, vollstaendig = true) =>
  abgleichBerechnen({ bekannt: b, ris: r, tagesordnungen: new Map(Object.entries(tos)), jetzt, zeitraum, vollstaendig });

describe("abgleichBerechnen", () => {
  it("legt neue Sitzungen an, mit TO-Stand", () => {
    expect(lauf([], [ris()], { R1: to({ veroeffentlicht: true }) })).toEqual([
      {
        art: "anlegen", risId: "R1",
        daten: { risId: "R1", start: ris().start, ort: "Rathaus", risLink: "l1", abgesagt: false, toVeroeffentlicht: true, toLink: "to-link" },
      },
    ]);
  });

  it("keine Änderung, wenn alles gleich ist", () => {
    expect(lauf([bekannt()], [ris()])).toEqual([]);
  });

  it("erkennt eine Verschiebung und merkt sich den alten Beginn", () => {
    const neu = d("2026-11-19T18:00:00Z");
    expect(lauf([bekannt()], [ris({ start: neu })])).toEqual([
      { art: "aendern", id: "s1", risId: "R1", daten: { start: neu, verschobenVon: bekannt().start }, gruende: ["Beginn geändert"] },
    ]);
  });

  it("vergangene Sitzung: Beginn wird korrigiert, aber nicht als verschoben markiert", () => {
    const alt = bekannt({ start: d("2026-10-01T18:00:00Z") });
    const [a] = lauf([alt], [ris({ start: d("2026-10-02T18:00:00Z") })]);
    expect(a).toMatchObject({ art: "aendern", daten: { start: d("2026-10-02T18:00:00Z") } });
    expect((a as { daten: object }).daten).not.toHaveProperty("verschobenVon");
  });

  it("Sekundenunterschiede zählen nicht als Verschiebung", () => {
    expect(lauf([bekannt()], [ris({ start: d("2026-11-12T18:00:30Z") })])).toEqual([]);
  });

  it("Absage im RIS, auch durch die Tagesordnungsseite", () => {
    expect(lauf([bekannt()], [ris({ abgesagt: true })])[0]).toMatchObject({ daten: { abgesagt: true } });
    expect(lauf([bekannt()], [ris()], { R1: to({ abgesagt: true }) })[0]).toMatchObject({ daten: { abgesagt: true } });
  });

  it("Tagesordnung erscheint: veröffentlicht und verlinkt, nur einmal", () => {
    const a = lauf([bekannt()], [ris()], { R1: to({ veroeffentlicht: true }) });
    expect(a).toEqual([
      { art: "aendern", id: "s1", risId: "R1", daten: { toVeroeffentlicht: true, toLink: "to-link" }, gruende: ["Tagesordnung veröffentlicht"] },
    ]);
    expect(lauf([bekannt({ toVeroeffentlicht: true, toLink: "to-link" })], [ris()], { R1: to({ veroeffentlicht: true }) })).toEqual([]);
  });

  it("nimmt nichts zurück: TO verschwindet, Absage verschwindet", () => {
    const b = bekannt({ toVeroeffentlicht: true, toLink: "to-link", abgesagt: true });
    expect(lauf([b], [ris()], { R1: to({ veroeffentlicht: false }) })).toEqual([]);
  });

  it("fehlende kommende Sitzung bei vollständigem Abruf: abgesagt", () => {
    const andere = ris({ risId: "R2" });
    expect(lauf([bekannt()], [andere])).toEqual(expect.arrayContaining([
      { art: "aendern", id: "s1", risId: "R1", daten: { abgesagt: true }, gruende: ["im RIS nicht mehr aufgeführt"] },
    ]));
  });

  it("fehlende Sitzung bei unvollständigem Abruf oder leerem RIS: nichts tun", () => {
    expect(lauf([bekannt()], [ris({ risId: "R2" })], {}, false).some((a) => a.art === "aendern" && a.id === "s1")).toBe(false);
    expect(lauf([bekannt()], [])).toEqual([]);
  });

  it("fehlende Sitzung außerhalb des Zeitraums oder in der Vergangenheit bleibt unberührt", () => {
    const spaet = bekannt({ start: d("2027-06-01T18:00:00Z") });
    const alt = bekannt({ id: "s2", risId: "R3", start: d("2026-10-05T18:00:00Z") });
    expect(lauf([spaet, alt], [ris({ risId: "R2" })]).some((a) => a.art === "aendern" && a.id !== undefined && (a.id === "s1" || a.id === "s2"))).toBe(false);
  });

  it("von Hand angelegte Sitzungen ohne RIS-Kennung bleiben unberührt", () => {
    expect(lauf([bekannt({ risId: null })], [ris({ risId: "R2" })]).filter((a) => a.art === "aendern")).toEqual([]);
  });
});
