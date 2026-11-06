import { Readable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import { STANDARD_EINSTELLUNGEN, type SitzungInfo } from "@beirat-dabei/core";
import { datei, instanz, oeffentlich, rechtliches, type DokumentZeile, type OeffentlichAbhaengigkeiten, type OeffentlichSpeicher } from "../src/oeffentlich.js";
import type { Speicher } from "../src/handlers.js";

const d = (iso: string) => new Date(iso);
const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ID3 = "33333333-3333-4333-8333-333333333333";
const ID4 = "44444444-4444-4444-8444-444444444444";

let akzent: string | undefined;
let logo: string | null;
let dokumente: DokumentZeile[];
let geliefert: string[];
let rechtstexte: { impressum: string; datenschutz: string };

const sitzungen: SitzungInfo[] = [
  { id: "alt", gremiumId: "g", gremiumName: "BUA", start: d("2026-09-17T17:00:00Z"), abgesagt: false, toVeroeffentlicht: true, toLink: "https://ris.example/alt" },
  { id: "s2", gremiumId: "g", gremiumName: "BUA", start: d("2026-12-03T18:00:00Z"), abgesagt: false, toVeroeffentlicht: false },
  { id: "s1", gremiumId: "g", gremiumName: "BUA", start: d("2026-11-12T18:00:00Z"), abgesagt: false, toVeroeffentlicht: true, toLink: "https://ris.example/s1", ort: "Rathaus" },
  { id: "s3", gremiumId: "g", gremiumName: "BUA", start: d("2026-12-20T18:00:00Z"), abgesagt: true, toVeroeffentlicht: true, toLink: "javascript:alert(1)" },
];

const dok = (extra: Partial<DokumentZeile>): DokumentZeile => ({
  id: ID1, titel: "Geschäftsordnung", kategorie: "geschaeftsordnung", datum: "2025-03-01", beschreibung: null,
  veroeffentlicht: true, hatDatei: true, dateiName: "go.pdf", dateiTyp: "application/pdf", dateiGroesse: 1234, ...extra,
});

const speicher = {
  einstellungen: async () => ({ einstellungen: STANDARD_EINSTELLUNGEN, notizfragen: [], name: "Beirat Musterstadt", akzent }),
  mitglieder: async () => [],
  sitzungen: async () => sitzungen,
  logoUrl: async () => logo,
  dokumente: async () => dokumente,
  rechtstexte: async () => rechtstexte,
  dateiVonDokument: async (id: string) => {
    geliefert.push(id);
    return { stream: Readable.from(["x"]), typ: "application/pdf", name: "go.pdf", groesse: 1 };
  },
} as unknown as Speicher & OeffentlichSpeicher;

const deps = (): OeffentlichAbhaengigkeiten => ({
  speicher, geheimnis: "g", jetzt: () => d("2026-10-21T08:00:00Z"),
});

beforeEach(() => {
  logo = null;
  akzent = undefined;
  geliefert = [];
  dokumente = [];
  rechtstexte = { impressum: "# Impressum\n\nMuster", datenschutz: "# Datenschutz\n\nText" };
});

describe("instanz", () => {
  it("liefert Namen, ohne Logo null", async () => {
    const r = await instanz(deps());
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ name: "Beirat Musterstadt", logo: null, akzent: null });
  });
  it("liefert die Adresse des Projektlogos", async () => {
    logo = "/api/medien/file/logo.png";
    expect((await instanz(deps())).body).toMatchObject({ logo: "/api/medien/file/logo.png" });
  });
});

describe("Akzentfarbe", () => {
  it("wird als Hex-Wert geliefert", async () => {
    akzent = "#1f4a2e";
    expect((await instanz(deps())).body).toMatchObject({ akzent: "#1f4a2e" });
  });
  it("ungültige Werte werden nicht ausgeliefert", async () => {
    akzent = "red; background:url(x)";
    expect((await instanz(deps())).body).toMatchObject({ akzent: null });
  });
});

describe("oeffentlich", () => {
  it("liefert die Zeitzone der Instanz mit", async () => {
    const b = (await oeffentlich(deps())).body as { instanz: { name: string; zeitzone: string } };
    expect(b.instanz).toMatchObject({ name: "Beirat Musterstadt", zeitzone: "Europe/Berlin" });
  });

  it("nennt nur kommende Sitzungen, sortiert, ohne gefährliche Links", async () => {
    const b = (await oeffentlich(deps())).body as { sitzungen: { beginn: string; tagesordnung: string | null; abgesagt: boolean }[] };
    expect(b.sitzungen.map((s) => s.beginn)).toEqual(["2026-11-12T18:00:00.000Z", "2026-12-03T18:00:00.000Z", "2026-12-20T18:00:00.000Z"]);
    expect(b.sitzungen[0]!.tagesordnung).toBe("https://ris.example/s1");
    expect(b.sitzungen[1]!.tagesordnung).toBeNull();
    expect(b.sitzungen[2]).toMatchObject({ abgesagt: true, tagesordnung: null });
  });

  it("gruppiert veröffentlichte Dokumente nach Kategorie, neueste zuerst; Entwürfe und leere Kategorien fehlen", async () => {
    dokumente = [
      dok({ id: ID1 }),
      dok({ id: ID2, titel: "Stellungnahme B-Plan", kategorie: "stellungnahme", datum: "2026-06-01" }),
      dok({ id: ID3, titel: "Stellungnahme Solarpark", kategorie: "stellungnahme", datum: "2026-09-01" }),
      dok({ id: ID4, titel: "Entwurf", kategorie: "stellungnahme", veroeffentlicht: false }),
      dok({ id: "55555555-5555-4555-8555-555555555555", titel: "Ohne Datei", hatDatei: false }),
      dok({ id: "66666666-6666-4666-8666-666666666666", titel: "Unbekannte Kategorie", kategorie: "xyz", datum: null }),
      dok({ id: "77777777-7777-4777-8777-777777777777", titel: "Protokoll Oktober", kategorie: "protokoll", datum: "2026-10-19" }),
    ];
    const b = (await oeffentlich(deps())).body as { kategorien: { id: string; dokumente: { titel: string; url: string }[] }[] };
    expect(b.kategorien.map((k) => k.id)).toEqual(["geschaeftsordnung", "stellungnahme", "protokoll", "sonstiges"]);
    expect(b.kategorien[1]!.dokumente.map((x) => x.titel)).toEqual(["Stellungnahme Solarpark", "Stellungnahme B-Plan"]);
    expect(b.kategorien[2]!.dokumente.map((x) => x.titel)).toEqual(["Protokoll Oktober"]);
    expect(b.kategorien[3]!.dokumente.map((x) => x.titel)).toEqual(["Unbekannte Kategorie"]);
    expect(b.kategorien[0]!.dokumente[0]!.url).toBe(`/beirat-dabei/datei/${ID1}`);
  });

  it("gibt keine Mitglieder, Notizen oder Entwürfe heraus", async () => {
    dokumente = [dok({ id: ID1 }), dok({ id: ID4, titel: "GEHEIMER ENTWURF", veroeffentlicht: false })];
    const text = JSON.stringify((await oeffentlich(deps())).body);
    expect(text).not.toContain("GEHEIMER ENTWURF");
    expect(text).not.toContain("@");
  });
});

describe("datei", () => {
  it("liefert die Datei eines veröffentlichten Dokuments", async () => {
    dokumente = [dok({ id: ID1 })];
    const r = await datei(deps(), ID1);
    expect(r.status).toBe(200);
    expect(r.datei?.name).toBe("go.pdf");
    expect(geliefert).toEqual([ID1]);
  });
  it("Entwurf, fehlende Datei, unbekannte und ungültige IDs: 404 ohne die Datei anzufassen", async () => {
    dokumente = [dok({ id: ID1, veroeffentlicht: false }), dok({ id: ID2, hatDatei: false })];
    for (const id of [ID1, ID2, ID3, "../../etc/passwd", "x"]) expect((await datei(deps(), id)).status).toBe(404);
    expect(geliefert).toEqual([]);
  });
});

describe("rechtliches", () => {
  it("liefert Impressum und Datenschutzerklärung aus den Einstellungen, ohne Anmeldung", async () => {
    const r = await rechtliches(deps());
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ instanz: "Beirat Musterstadt", impressum: "# Impressum\n\nMuster", datenschutz: "# Datenschutz\n\nText" });
  });
  it("leere Texte bleiben leer (die Seite zeigt dann einen Hinweis)", async () => {
    rechtstexte = { impressum: "", datenschutz: "" };
    expect((await rechtliches(deps())).body).toMatchObject({ impressum: "", datenschutz: "" });
  });
});
