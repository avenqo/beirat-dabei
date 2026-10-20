import { describe, expect, it } from "vitest";
import { tokenErzeugen, tokenPruefen, TOKEN_GUELTIGKEIT_SEKUNDEN } from "../src/index.js";

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
});
