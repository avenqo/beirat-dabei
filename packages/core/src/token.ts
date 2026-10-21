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
  return tokenErzeugenBis(inhalt, geheimnis, new Date(jetzt.getTime() + gueltigkeitSekunden * 1000));
}

/** Token mit festem Ablaufzeitpunkt. */
export function tokenErzeugenBis(inhalt: TokenInhalt, geheimnis: string, ablauf: Date): string {
  const token: Token = {
    ...inhalt,
    exp: Math.floor(ablauf.getTime() / 1000),
    n: randomBytes(8).toString("base64url"),
  };
  const nutzlast = b64(JSON.stringify(token));
  return `${nutzlast}.${b64(signatur(nutzlast, geheimnis))}`;
}

/**
 * Ablauf für Links in Mails: Ende der Sitzung plus Nachlauf. Das Ende ist nicht
 * bekannt, daher Beginn plus angenommene Dauer.
 */
export function mailLinkAblauf(
  sitzungStart: Date,
  { nachlaufTage = 14, dauerStunden = 3 }: { nachlaufTage?: number; dauerStunden?: number } = {},
): Date {
  return new Date(sitzungStart.getTime() + (dauerStunden + nachlaufTage * 24) * 3_600_000);
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

// --- Abo-Token für den Kalender-Feed ----------------------------------------
// Dauerhaft gültig, pro Mitglied, ohne Speicherung abgeleitet. Alle Abo-Adressen
// einer Instanz lassen sich durch Erhöhen der Version widerrufen. Inaktive
// Mitglieder prüft der Aufrufer.

function aboSignatur(mitgliedId: string, geheimnis: string, version: number): Buffer {
  return createHmac("sha256", geheimnis).update(`abo:${version}:${mitgliedId}`).digest();
}

export function aboTokenErzeugen(mitgliedId: string, geheimnis: string, version: number): string {
  return `${b64(mitgliedId)}.${b64(aboSignatur(mitgliedId, geheimnis, version))}`;
}

/** Liefert die Mitglieds-ID, wenn der Token zur Version und zum Geheimnis passt, sonst null. */
export function aboTokenPruefen(token: string, geheimnis: string, version: number): string | null {
  const teile = token.split(".");
  if (teile.length !== 2 || !teile[0] || !teile[1]) return null;
  const mitgliedId = Buffer.from(teile[0], "base64url").toString("utf8");
  if (!mitgliedId || b64(mitgliedId) !== teile[0]) return null;
  const erwartet = aboSignatur(mitgliedId, geheimnis, version);
  const erhalten = Buffer.from(teile[1], "base64url");
  if (erhalten.length !== erwartet.length || !timingSafeEqual(erhalten, erwartet)) return null;
  return mitgliedId;
}
