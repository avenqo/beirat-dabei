import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type TokenAktion = "eintragen" | "austragen" | "nicht-teilgenommen" | "notiz";

export interface TokenInhalt {
  /** Aktion */
  a: TokenAktion;
  /** Mitglied */
  m: string;
  /** Sitzung */
  s: string;
}

export interface Token extends TokenInhalt {
  /** Ablaufzeitpunkt, Unix-Sekunden */
  exp: number;
  /** Zufallswert; Grundlage, um Token serverseitig als verbraucht zu markieren */
  n: string;
}

export const TOKEN_GUELTIGKEIT_SEKUNDEN = 30 * 60;

export type TokenPruefung =
  | { ok: true; token: Token }
  | { ok: false; grund: "format" | "signatur" | "abgelaufen" };

const b64 = (daten: Buffer | string) => Buffer.from(daten).toString("base64url");

function signatur(nutzlast: string, geheimnis: string): Buffer {
  return createHmac("sha256", geheimnis).update(nutzlast).digest();
}

export function tokenErzeugen(
  inhalt: TokenInhalt,
  geheimnis: string,
  jetzt: Date,
  gueltigkeitSekunden: number = TOKEN_GUELTIGKEIT_SEKUNDEN,
): string {
  const token: Token = {
    ...inhalt,
    exp: Math.floor(jetzt.getTime() / 1000) + gueltigkeitSekunden,
    n: randomBytes(8).toString("base64url"),
  };
  const nutzlast = b64(JSON.stringify(token));
  return `${nutzlast}.${b64(signatur(nutzlast, geheimnis))}`;
}

export function tokenPruefen(wert: string, geheimnis: string, jetzt: Date): TokenPruefung {
  const teile = wert.split(".");
  if (teile.length !== 2 || !teile[0] || !teile[1]) return { ok: false, grund: "format" };
  const [nutzlast, sig] = teile as [string, string];

  const erwartet = signatur(nutzlast, geheimnis);
  const erhalten = Buffer.from(sig, "base64url");
  if (erhalten.length !== erwartet.length || !timingSafeEqual(erhalten, erwartet)) {
    return { ok: false, grund: "signatur" };
  }

  let token: Token;
  try {
    token = JSON.parse(Buffer.from(nutzlast, "base64url").toString("utf8")) as Token;
  } catch {
    return { ok: false, grund: "format" };
  }
  if (
    typeof token.a !== "string" ||
    typeof token.m !== "string" ||
    typeof token.s !== "string" ||
    typeof token.exp !== "number"
  ) {
    return { ok: false, grund: "format" };
  }
  if (Math.floor(jetzt.getTime() / 1000) >= token.exp) return { ok: false, grund: "abgelaufen" };
  return { ok: true, token };
}
