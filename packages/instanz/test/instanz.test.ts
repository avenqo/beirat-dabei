import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { einstellungenSoll, instanzLesen, planen, planLeer, type Instanz } from "../src/index.js";

const kremmen = readFileSync(new URL("../../../examples/kremmen/instanz.yaml", import.meta.url), "utf8");
const lesen = (yaml: string) => instanzLesen(yaml);
const fehler = (yaml: string) => {
  const r = lesen(yaml);
  if (r.ok) throw new Error("hätte fehlschlagen müssen");
  return r.fehler;
};
const ok = (yaml: string): Instanz => {
  const r = lesen(yaml);
  if (!r.ok) throw new Error(r.fehler.join("; "));
  return r.instanz;
};

const MINIMAL = `
name: Test
notizfragen:
  - {schluessel: relevant, frage: "Relevant?", typ: ja-nein}
gremien:
  - name: Ausschuss
`;

describe("examples/kremmen/instanz.yaml", () => {
  it("ist gültig und enthält die erwarteten Werte", () => {
    const i = ok(kremmen);
    expect(i.name).toBe("Umweltbeirat Kremmen");
    expect(i.fristVorTage).toBe(7);
    expect(i.fristNachTage).toBe(3);
    expect(i.ris).toEqual({ adapter: "komfa", quelle: "https://ris-kremmen.komfa.de" });
    expect(i.rollen).toEqual({ mitglied: "ub", admin: "ub-admin" });
    expect(i.notizfragen.map((f) => f.schluessel)).toEqual(["relevant", "tops", "beschluesse"]);
    expect(i.notizfragen.map((f) => f.pflicht)).toEqual([true, false, false]);
    expect(i.gremien).toEqual([
      { name: "Bau-/Wirtschafts- und Umweltausschuss", risKennung: "Bau-/Wirtschafts- und Umweltausschuss", aktiv: true },
    ]);
  });
});

describe("instanzLesen", () => {
  it("setzt Standardwerte", () => {
    const i = ok(MINIMAL);
    expect(i).toMatchObject({
      zeitzone: "Europe/Berlin", fristVorTage: 7, fristNachTage: 3,
      ris: { adapter: "manuell", quelle: "" }, rollen: { mitglied: "mitglied", admin: "admin" },
    });
    expect(i.gremien[0]).toEqual({ name: "Ausschuss", risKennung: "", aktiv: true });
  });

  it("meldet kaputtes YAML und falsche Wurzel", () => {
    expect(fehler("name: [")[0]).toMatch(/kein gültiges YAML/);
    expect(fehler("- a\n- b")[0]).toMatch(/muss mit Schlüsseln/);
  });

  it("meldet alle Fehler auf einmal", () => {
    const f = fehler("zeitzone: Mars/Olympus\nfristen: {vor_sitzung_tage: -1}\n");
    expect(f.join("\n")).toMatch(/name: fehlt/);
    expect(f.join("\n")).toMatch(/zeitzone: „Mars\/Olympus“/);
    expect(f.join("\n")).toMatch(/fristen.vor_sitzung_tage/);
    expect(f.join("\n")).toMatch(/notizfragen/);
    expect(f.join("\n")).toMatch(/gremien/);
  });

  it("erkennt Tippfehler bei Schlüsseln", () => {
    expect(fehler(MINIMAL + "fristn: {}\n").join()).toMatch(/fristn: unbekannter Schlüssel/);
    expect(fehler(MINIMAL.replace("name: Ausschuss", "name: Ausschuss\n    ris_kenung: x")).join()).toMatch(/ris_kenung/);
  });

  it("prüft Notizfragen", () => {
    const ohneRelevant = MINIMAL.replace("relevant", "andere");
    expect(fehler(ohneRelevant).join()).toMatch(/„relevant“ fehlt/);
    const falscherTyp = MINIMAL.replace("typ: ja-nein", "typ: text");
    expect(fehler(falscherTyp).join()).toMatch(/„relevant“ muss den Typ „ja-nein“/);
    const doppelt = MINIMAL.replace("gremien:", "  - {schluessel: relevant, frage: x, typ: ja-nein}\ngremien:");
    expect(fehler(doppelt).join()).toMatch(/doppelt/);
    const schlecht = MINIMAL.replace("gremien:", "  - {schluessel: 'Große Frage', frage: x}\ngremien:");
    expect(fehler(schlecht).join()).toMatch(/schluessel: nur Kleinbuchstaben/);
  });

  it("verlangt bei komfa eine Adresse", () => {
    expect(fehler(MINIMAL + "ris: {adapter: komfa}\n").join()).toMatch(/ris.quelle: für den Adapter „komfa“ nötig/);
    expect(fehler(MINIMAL + "ris: {adapter: komfa, quelle: ris-kremmen.komfa.de}\n").join()).toMatch(/https:\/\//);
    expect(fehler(MINIMAL + "ris: {adapter: oparl}\n").join()).toMatch(/unbekannt/);
    expect(ok(MINIMAL + "ris: {adapter: manuell}\n").ris.adapter).toBe("manuell");
  });

  it("prüft Rollen und Gremien", () => {
    expect(fehler(MINIMAL + "rollen: {mitglied: x, admin: x}\n").join()).toMatch(/verschiedene Namen/);
    expect(fehler(MINIMAL.replace("  - name: Ausschuss", "  - name: A\n  - name: A")).join()).toMatch(/doppelt/);
    expect(fehler(MINIMAL.replace("  - name: Ausschuss", "  - name: A\n    aktiv: ja")).join()).toMatch(/aktiv: muss true oder false/);
  });
});

describe("planen", () => {
  const soll = ok(kremmen);
  const istGleich = () => ({ ...einstellungenSoll(soll) });

  it("nichts zu tun, wenn alles gleich ist", () => {
    const p = planen(soll, istGleich(), [
      { id: "g1", name: "Bau-/Wirtschafts- und Umweltausschuss", ris_kennung: "Bau-/Wirtschafts- und Umweltausschuss", aktiv: true },
    ]);
    expect(planLeer(p)).toBe(true);
    expect(p.unbekannteGremien).toEqual([]);
  });

  it("zeigt geänderte Einstellungen mit altem und neuem Wert", () => {
    const ist = { ...istGleich(), name: "Beirat dabei", frist_vor_tage: 5, ris_quelle: "" , themenfokus: null };
    const p = planen(soll, ist, [{ id: "g1", name: soll.gremien[0]!.name, ris_kennung: soll.gremien[0]!.risKennung, aktiv: true }]);
    expect(p.einstellungen.map((a) => a.feld).sort()).toEqual(["frist_vor_tage", "name", "ris_quelle", "themenfokus"]);
    expect(p.einstellungen.find((a) => a.feld === "name")).toEqual({ feld: "name", alt: "Beirat dabei", neu: "Umweltbeirat Kremmen" });
  });

  it("leere Texte und fehlende Werte gelten als gleich", () => {
    const i = ok(MINIMAL);
    const p = planen(i, { ...einstellungenSoll(i), themenfokus: "", ris_quelle: undefined }, [{ id: "g", name: "Ausschuss", ris_kennung: "", aktiv: true }]);
    expect(planLeer(p)).toBe(true);
  });

  it("legt fehlende Gremien an, ändert vorhandene, fasst fremde nicht an", () => {
    const mehr = ok(`
name: T
notizfragen:
  - {schluessel: relevant, frage: R, typ: ja-nein}
gremien:
  - {name: Neu, ris_kennung: Neu im RIS}
  - {name: Alt, ris_kennung: Anders, aktiv: false}
`);
    const p = planen(mehr, einstellungenSoll(mehr), [
      { id: "g1", name: "Alt", ris_kennung: "Alt", aktiv: true },
      { id: "g2", name: "Fremd", ris_kennung: "", aktiv: true },
    ]);
    expect(p.gremien).toEqual([
      { art: "anlegen", name: "Neu", daten: { name: "Neu", ris_kennung: "Neu im RIS", aktiv: true } },
      {
        art: "aendern", name: "Alt", id: "g1", daten: { ris_kennung: "Anders", aktiv: false },
        aenderungen: [{ feld: "ris_kennung", alt: "Alt", neu: "Anders" }, { feld: "aktiv", alt: true, neu: false }],
      },
    ]);
    expect(p.unbekannteGremien).toEqual(["Fremd"]);
  });
});
