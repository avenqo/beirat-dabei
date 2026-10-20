import { describe, expect, it } from "vitest";
import { kalenderErzeugen } from "../src/index.js";

const opt = { name: "Beirat dabei", domain: "beirat.example", jetzt: new Date("2026-11-01T08:00:00Z") };

describe("kalenderErzeugen", () => {
  it("erzeugt gültige Struktur mit CRLF", () => {
    const ics = kalenderErzeugen(
      [{ id: "s1", start: new Date("2026-11-18T17:00:00Z"), titel: "Bau- und Umweltausschuss", ort: "Rathaus, Saal 1" }],
      opt,
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:s1@beirat.example");
    expect(ics).toContain("DTSTART:20261118T170000Z");
    expect(ics).toContain("DTEND:20261118T190000Z");
    expect(ics).toContain("LOCATION:Rathaus\\, Saal 1");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("markiert Absagen", () => {
    const ics = kalenderErzeugen(
      [{ id: "s1", start: new Date("2026-11-18T17:00:00Z"), titel: "X", abgesagt: true }],
      opt,
    );
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("bricht lange Zeilen bei 75 Oktetten, auch mit Umlauten", () => {
    const ics = kalenderErzeugen(
      [{ id: "s1", start: new Date("2026-11-18T17:00:00Z"), titel: "Ä".repeat(100) }],
      opt,
    );
    for (const zeile of ics.split("\r\n")) expect(Buffer.byteLength(zeile)).toBeLessThanOrEqual(75);
    const entfaltet = ics.replace(/\r\n /g, "");
    expect(entfaltet).toContain(`SUMMARY:${"Ä".repeat(100)}`);
  });

  it("maskiert Semikolon, Backslash und Zeilenumbruch", () => {
    const ics = kalenderErzeugen(
      [{ id: "s1", start: new Date("2026-11-18T17:00:00Z"), titel: "a;b\\c", beschreibung: "x\ny" }],
      opt,
    );
    expect(ics).toContain("SUMMARY:a\;b\\\\c");
    expect(ics).toContain("DESCRIPTION:x\\ny");
  });
});
