import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KomfaAdapter, icsLesen, kalenderLesen, tagesordnungLesen, type Http } from "../src/index.js";

const fx = (name: string) => readFileSync(new URL(`./fixtures/komfa/${name}`, import.meta.url), "utf8");
const GREMIUM = "Bau-/Wirtschafts- und Umweltausschuss";
const ID_SEP = "EC7315859A41F585E714CB583C8D82B2";
const ID_NOV = "EC7315859A41F585E714D258948A4DB8";
const ID_DEZ = "EC7315859A41F585E714D658A80C8B4A";

describe("kalenderLesen", () => {
  it("liest alle Sitzungen mit Kennung und Titel", () => {
    const e = kalenderLesen(fx("kalender-2026-11.html"));
    expect(e.length).toBeGreaterThan(3);
    expect(e).toContainEqual({ risId: ID_NOV, titel: `Stadt Kremmen, ${GREMIUM}` });
    expect(e.every((x) => /^[0-9A-F]{32}$/.test(x.risId))).toBe(true);
  });
});

describe("icsLesen", () => {
  it("liest Beginn, Ende und Ort (UTC)", () => {
    const [t] = icsLesen(fx("ic-nov.ics"));
    expect(t).toMatchObject({
      uid: ID_NOV,
      summary: GREMIUM,
      location: "Rathaus Ratssaal, Am Markt 1 Eingang Mühlenstraße",
      abgesagt: false,
    });
    expect(t!.start.toISOString()).toBe("2026-11-12T18:00:00.000Z");
    expect(t!.ende!.toISOString()).toBe("2026-11-12T20:30:00.000Z");
  });

  it("versteht Zeiten mit Zone, ganztägige Termine und Status CANCELLED", () => {
    const text = [
      "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:a", "SUMMARY:A\\, B",
      "DTSTART;TZID=Europe/Berlin:20260715T190000", "STATUS:CANCELLED", "END:VEVENT",
      "BEGIN:VEVENT", "UID:b", "SUMMARY:Lang", " er Titel", "DTSTART;VALUE=DATE:20261201", "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const [a, b] = icsLesen(text);
    expect(a!.start.toISOString()).toBe("2026-07-15T17:00:00.000Z"); // Sommerzeit
    expect(a!.summary).toBe("A, B");
    expect(a!.abgesagt).toBe(true);
    expect(b!.summary).toBe("Langer Titel");
    expect(b!.start.toISOString()).toBe("2026-11-30T23:00:00.000Z");
  });
});

describe("tagesordnungLesen", () => {
  it("Seite ohne Tagesordnung: nicht veröffentlicht", () => {
    const to = tagesordnungLesen(fx("to-nov.html"), "link");
    expect(to).toMatchObject({ veroeffentlicht: false, tops: [], abgesagt: false, link: "link" });
  });

  it("Seite mit Tagesordnung: nummerierte TOPs mit Vorlagen", () => {
    const to = tagesordnungLesen(fx("to-sep.html"), "link");
    expect(to.veroeffentlicht).toBe(true);
    expect(to.abgesagt).toBe(false);
    expect(to.tops.length).toBeGreaterThanOrEqual(8);
    expect(to.tops[0]).toEqual({ nummer: "1.", titel: "Eröffnung", vorlage: null });
    expect(to.tops[4]).toMatchObject({
      nummer: "5.",
      vorlage: "01-78-2026",
      titel: expect.stringContaining("Flächennutzungsplans der Stadt Kremmen"),
    });
    // keine Zeilen aus den Dokumentlisten
    expect(to.tops.some((t) => /Dokument|Download/.test(t.titel))).toBe(false);
  });

  it("nur Einladung zum Download genügt", () => {
    const html = `<section id="mpc"><div class="center"><table class="w00 center"><tr><td>1.Dokument</td><td>Einladung Kremmen-1</td>
      <td><a href="index.php?module=komfaris&amp;action=dlg&amp;id=1">Download</a></td></tr></table></div>
      <div class="center"><h1>TAGESORDNUNG</h1></div>Die Tagesordnung ist nicht verfügbar.</section>`;
    expect(tagesordnungLesen(html, "l").veroeffentlicht).toBe(true);
  });

  it("erkennt eine Absage im Kopf, nicht in TOP-Titeln", () => {
    const kopf = `<section id="mpc"><p>Die Sitzung ist abgesagt.</p></section>`;
    expect(tagesordnungLesen(kopf, "l").abgesagt).toBe(true);
    const top = `<section id="mpc"><table class="table-hover"><tr><td class="w05 right">1.</td><td>Antrag entfällt nicht</td><td></td></tr></table></section>`;
    expect(tagesordnungLesen(top, "l").abgesagt).toBe(false);
  });
});

/** Attrappe, die gespeicherte Antworten ausliefert. */
function attrappe(antworten: Record<string, string | number>) {
  const abrufe: string[] = [];
  const http: Http = {
    async holen(url) {
      abrufe.push(url);
      const treffer = Object.entries(antworten).find(([teil]) => url.includes(teil));
      if (!treffer) return { status: 404, text: "" };
      return typeof treffer[1] === "number" ? { status: treffer[1], text: "" } : { status: 200, text: treffer[1] };
    },
  };
  return { http, abrufe };
}

const zeitraum = { von: new Date("2026-10-20T00:00:00Z"), bis: new Date("2027-01-31T00:00:00Z") };
const alle = () => ({
  "FilterValue=2026-10-01": fx("kalender-2026-09.html"), // Oktober nicht gespeichert, nur Struktur
  "FilterValue=2026-11-01": fx("kalender-2026-11.html"),
  "FilterValue=2026-12-01": fx("kalender-2026-12.html"),
  "FilterValue=2027-01-01": fx("kalender-2026-12.html"),
  [`action=ic&id=${ID_NOV}`]: fx("ic-nov.ics"),
  [`action=ic&id=${ID_DEZ}`]: fx("ic-dez.ics"),
  [`action=ic&id=${ID_SEP}`]: fx("ic-sep.ics"),
});

describe("KomfaAdapter", () => {
  it("liefert die Sitzungen des Gremiums im Zeitraum, sortiert", async () => {
    const { http } = attrappe(alle());
    const a = new KomfaAdapter({ basisUrl: "https://ris-kremmen.komfa.de/", http });
    const r = await a.sitzungen(GREMIUM, zeitraum);
    expect(r.vollstaendig).toBe(true);
    expect(r.sitzungen.map((s) => s.risId)).toEqual([ID_NOV, ID_DEZ]);
    expect(r.sitzungen[0]).toMatchObject({
      gremium: GREMIUM,
      ort: "Rathaus Ratssaal, Am Markt 1 Eingang Mühlenstraße",
      abgesagt: false,
      risLink: `https://ris-kremmen.komfa.de/index.php?module=komfaris&action=to&id=${ID_NOV}`,
    });
    expect(r.sitzungen[0]!.start.toISOString()).toBe("2026-11-12T18:00:00.000Z");
  });

  it("andere Gremien werden nicht berücksichtigt", async () => {
    const { http, abrufe } = attrappe(alle());
    const a = new KomfaAdapter({ basisUrl: "https://ris-kremmen.komfa.de", http });
    const r = await a.sitzungen("Hauptausschusssitzung", zeitraum);
    expect(r.sitzungen.every((s) => s.gremium === "Hauptausschusssitzung")).toBe(true);
    expect(abrufe.some((u) => u.includes(ID_NOV))).toBe(false);
  });

  it("ein fehlgeschlagener Abruf macht das Ergebnis unvollständig", async () => {
    const { http } = attrappe({ ...alle(), [`action=ic&id=${ID_DEZ}`]: 500 });
    const r = await new KomfaAdapter({ basisUrl: "https://x", http }).sitzungen(GREMIUM, zeitraum);
    expect(r.vollstaendig).toBe(false);
    expect(r.sitzungen.map((s) => s.risId)).toEqual([ID_NOV]);
  });

  it("Tagesordnung abrufen", async () => {
    const { http } = attrappe({ [`action=to&id=${ID_SEP}`]: fx("to-sep.html") });
    const to = await new KomfaAdapter({ basisUrl: "https://x", http }).tagesordnung(ID_SEP);
    expect(to.veroeffentlicht).toBe(true);
    expect(to.link).toBe(`https://x/index.php?module=komfaris&action=to&id=${ID_SEP}`);
  });

  it("Tagesordnung: HTTP-Fehler wird gemeldet", async () => {
    const { http } = attrappe({ "action=to": 503 });
    await expect(new KomfaAdapter({ basisUrl: "https://x", http }).tagesordnung(ID_SEP)).rejects.toThrow(/503/);
  });
});
