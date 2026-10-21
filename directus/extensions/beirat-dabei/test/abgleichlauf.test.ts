import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import type { BekannteSitzung, Http, NeueSitzung, SitzungsAenderung } from "@beirat-dabei/ris-adapter";
import { abgleichAusfuehren, type AbgleichSpeicher } from "../src/abgleichlauf.js";
import type { Modus } from "../src/regellauf.js";

const fx = (n: string) => readFileSync(new URL(`../../../../packages/ris-adapter/test/fixtures/komfa/${n}`, import.meta.url), "utf8");
const GREMIUM = "Bau-/Wirtschafts- und Umweltausschuss";
const ID_SEP = "EC7315859A41F585E714CB583C8D82B2";
const ID_NOV = "EC7315859A41F585E714D258948A4DB8";
const ID_DEZ = "EC7315859A41F585E714D658A80C8B4A";

const antworten: Record<string, string> = {
  "FilterValue=2026-10-01": fx("kalender-2026-09.html"),
  "FilterValue=2026-11-01": fx("kalender-2026-11.html"),
  "FilterValue=2026-12-01": fx("kalender-2026-12.html"),
  "FilterValue=2027-01-01": fx("kalender-2026-12.html"),
  [`action=ic&id=${ID_NOV}`]: fx("ic-nov.ics"),
  [`action=ic&id=${ID_DEZ}`]: fx("ic-dez.ics"),
  [`action=ic&id=${ID_SEP}`]: fx("ic-sep.ics"),
  [`action=to&id=${ID_SEP}`]: fx("to-sep.html"),
  [`action=to&id=${ID_NOV}`]: fx("to-nov.html"),
  [`action=to&id=${ID_DEZ}`]: fx("to-sep.html"), // hier als Seite mit Tagesordnung
};
const http: Http = {
  async holen(url) {
    const t = Object.entries(antworten).find(([k]) => url.includes(k));
    return t ? { status: 200, text: t[1] } : { status: 404, text: "" };
  },
};

let bekannt: BekannteSitzung[];
let angelegt: NeueSitzung[];
let geaendert: { id: string; daten: Partial<SitzungsAenderung> }[];
let adapter: string;

const speicher: AbgleichSpeicher = {
  risEinstellungen: async () => ({ adapter, quelle: "https://ris.example" }),
  gremien: async () => [
    { id: "g1", name: "BUA", risKennung: GREMIUM, aktiv: true },
    { id: "g2", name: "ohne Kennung", risKennung: "", aktiv: true },
  ],
  sitzungenBekannt: async () => bekannt,
  sitzungAnlegen: async (_g, d) => void angelegt.push(d),
  sitzungAendern: async (id, daten) => void geaendert.push({ id, daten }),
};

const lauf = (modus: Modus = "scharf") =>
  abgleichAusfuehren({
    speicher, http, modus,
    jetzt: () => new Date("2026-10-20T08:00:00Z"),
    log: { info: () => {}, error: () => {} },
  });

beforeEach(() => {
  bekannt = [];
  angelegt = [];
  geaendert = [];
  adapter = "komfa";
});

describe("abgleichAusfuehren", () => {
  it("legt die Sitzungen aus dem RIS an, mit Stand der Tagesordnung", async () => {
    expect(await lauf()).toEqual({ angelegt: 3, geaendert: 0 });
    const nov = angelegt.find((s) => s.risId === ID_NOV)!;
    expect(nov).toMatchObject({ toVeroeffentlicht: false, abgesagt: false, ort: expect.stringContaining("Ratssaal") });
    expect(angelegt.find((s) => s.risId === ID_DEZ)).toMatchObject({ toVeroeffentlicht: true });
    // Die letzte Sitzung liegt 33 Tage zurück und erscheint, damit man nachträglich Notizen schreiben kann
    expect(angelegt.find((s) => s.risId === ID_SEP)).toMatchObject({ toVeroeffentlicht: true });
  });

  it("zweiter Lauf nach dem Anlegen ändert nichts", async () => {
    await lauf();
    bekannt = angelegt.map((a, i) => ({ id: `s${i}`, ...a }));
    angelegt = [];
    expect(await lauf()).toEqual({ angelegt: 0, geaendert: 0 });
  });

  it("erkennt Verschiebung und neue Tagesordnung", async () => {
    await lauf();
    bekannt = angelegt.map((a, i) => ({ id: `s${i}`, ...a }));
    const nov = bekannt.find((b) => b.risId === ID_NOV)!;
    const dez = bekannt.find((b) => b.risId === ID_DEZ)!;
    nov.start = new Date("2026-11-05T18:00:00Z"); // lokal anders gespeichert
    dez.toVeroeffentlicht = false;
    dez.toLink = null;
    angelegt = [];
    const r = await lauf();
    expect(r.geaendert).toBe(2);
    expect(geaendert.find((g) => g.id === nov.id)!.daten).toMatchObject({ verschobenVon: new Date("2026-11-05T18:00:00Z") });
    expect(geaendert.find((g) => g.id === dez.id)!.daten).toMatchObject({ toVeroeffentlicht: true });
  });

  it("Trockenmodus schreibt nichts", async () => {
    expect(await lauf("trocken")).toEqual({ angelegt: 0, geaendert: 0 });
    expect(angelegt).toHaveLength(0);
  });

  it("Adapter ohne Abgleich (manuell) und Modus aus tun nichts", async () => {
    adapter = "manuell";
    expect(await lauf()).toEqual({ angelegt: 0, geaendert: 0 });
    adapter = "komfa";
    expect(await lauf("aus")).toEqual({ angelegt: 0, geaendert: 0 });
  });
});
