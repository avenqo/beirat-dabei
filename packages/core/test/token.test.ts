import { describe, expect, it } from "vitest";
import { aboTokenErzeugen, aboTokenPruefen, mailLinkAblauf, tokenErzeugen, tokenErzeugenBis, tokenPruefen, TOKEN_GUELTIGKEIT_SEKUNDEN } from "../src/index.js";

const jetzt = new Date("2026-11-01T08:00:00Z");
const inhalt = { a: "eintragen", m: "mitglied-1", s: "sitzung-1" } as const;
const geheimnis = "test-geheimnis";

describe("Magic-Link-Token", () => {
  it("round trip", () => {
    const t = tokenErzeugen(inhalt, geheimnis, jetzt);
    const r = tokenPruefen(t, geheimnis, jetzt);
    expect(r.ok && r.token).toMatchObject(inhalt);
  });

  it("gültig 30 Minuten, danach abgelaufen", () => {
    expect(TOKEN_GUELTIGKEIT_SEKUNDEN).toBe(1800);
    const t = tokenErzeugen(inhalt, geheimnis, jetzt);
    const knapp = new Date(jetzt.getTime() + 1799_000);
    const spaet = new Date(jetzt.getTime() + 1800_000);
    expect(tokenPruefen(t, geheimnis, knapp).ok).toBe(true);
    expect(tokenPruefen(t, geheimnis, spaet)).toEqual({ ok: false, grund: "abgelaufen" });
  });

  it("falsches Geheimnis", () => {
    const t = tokenErzeugen(inhalt, geheimnis, jetzt);
    expect(tokenPruefen(t, "anderes", jetzt)).toEqual({ ok: false, grund: "signatur" });
  });

  it("manipulierte Nutzlast", () => {
    const t = tokenErzeugen(inhalt, geheimnis, jetzt);
    const [nutzlast, sig] = t.split(".") as [string, string];
    const fremd = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(nutzlast, "base64url").toString()), m: "mitglied-2" }),
    ).toString("base64url");
    expect(tokenPruefen(`${fremd}.${sig}`, geheimnis, jetzt)).toEqual({ ok: false, grund: "signatur" });
  });

  it("Müll", () => {
    expect(tokenPruefen("", geheimnis, jetzt)).toEqual({ ok: false, grund: "format" });
    expect(tokenPruefen("a.b.c", geheimnis, jetzt)).toEqual({ ok: false, grund: "format" });
  });

  it("zwei Token für dieselbe Aktion unterscheiden sich (Nonce)", () => {
    expect(tokenErzeugen(inhalt, geheimnis, jetzt)).not.toBe(tokenErzeugen(inhalt, geheimnis, jetzt));
  });

  it("Mail-Link gilt bis Sitzungsende plus 14 Tage", () => {
    const start = new Date("2026-11-18T17:00:00Z");
    const ablauf = mailLinkAblauf(start);
    expect(ablauf.toISOString()).toBe("2026-12-02T20:00:00.000Z");
    const t = tokenErzeugenBis(inhalt, geheimnis, ablauf);
    expect(tokenPruefen(t, geheimnis, new Date("2026-12-02T19:59:59Z")).ok).toBe(true);
    expect(tokenPruefen(t, geheimnis, ablauf)).toEqual({ ok: false, grund: "abgelaufen" });
  });

  it("Nachlauf und Dauer sind einstellbar", () => {
    const start = new Date("2026-11-18T17:00:00Z");
    expect(mailLinkAblauf(start, { nachlaufTage: 1, dauerStunden: 1 }).toISOString()).toBe("2026-11-19T18:00:00.000Z");
  });
});

describe("Abo-Token", () => {
  it("ist pro Mitglied stabil und lässt sich prüfen", () => {
    const t = aboTokenErzeugen("mitglied-1", geheimnis, 1);
    expect(aboTokenErzeugen("mitglied-1", geheimnis, 1)).toBe(t);
    expect(aboTokenPruefen(t, geheimnis, 1)).toBe("mitglied-1");
    expect(aboTokenErzeugen("mitglied-2", geheimnis, 1)).not.toBe(t);
  });

  it("falsches Geheimnis oder neue Version machen ihn ungültig", () => {
    const t = aboTokenErzeugen("mitglied-1", geheimnis, 1);
    expect(aboTokenPruefen(t, "anderes", 1)).toBeNull();
    expect(aboTokenPruefen(t, geheimnis, 2)).toBeNull();
  });

  it("lässt sich nicht auf ein anderes Mitglied umbiegen", () => {
    const t = aboTokenErzeugen("mitglied-1", geheimnis, 1);
    const sig = t.split(".")[1];
    const fremd = `${Buffer.from("mitglied-2").toString("base64url")}.${sig}`;
    expect(aboTokenPruefen(fremd, geheimnis, 1)).toBeNull();
  });

  it("Müll", () => {
    for (const x of ["", "a", "a.b.c", ".x", "x.", "!!.!!"]) expect(aboTokenPruefen(x, geheimnis, 1)).toBeNull();
  });

  it("ist kein Magic-Link-Token", () => {
    expect(tokenPruefen(aboTokenErzeugen("m", geheimnis, 1), geheimnis, jetzt).ok).toBe(false);
  });
});
