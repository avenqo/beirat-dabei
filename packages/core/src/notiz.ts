import type { Notizfrage } from "./types.js";

export const MAX_ANTWORT_ZEICHEN = 5000;

export type NotizPruefung =
  | { ok: true; wert: { relevant: boolean; antworten: Record<string, string> } }
  | { ok: false; fehler: string[] };

/**
 * Prüft die Eingabe aus dem Notizformular gegen die Fragen der Instanz.
 * `relevant` (ja/nein) ist immer Pflicht. Die Frage mit dem Schlüssel "relevant"
 * wird dadurch beantwortet und kommt nicht in `antworten`. Unbekannte Schlüssel
 * werden verworfen.
 */
export function notizPruefen(eingabe: unknown, fragen: Notizfrage[]): NotizPruefung {
  const fehler: string[] = [];
  const e = (typeof eingabe === "object" && eingabe !== null ? eingabe : {}) as Record<string, unknown>;

  if (typeof e["relevant"] !== "boolean") fehler.push("relevant");

  const roh =
    typeof e["antworten"] === "object" && e["antworten"] !== null
      ? (e["antworten"] as Record<string, unknown>)
      : {};
  const antworten: Record<string, string> = {};
  for (const frage of fragen) {
    if (frage.schluessel === "relevant") continue;
    const wert = roh[frage.schluessel];
    const text = typeof wert === "string" ? wert.trim() : "";
    if (text.length > MAX_ANTWORT_ZEICHEN) {
      fehler.push(frage.schluessel);
      continue;
    }
    if (frage.pflicht && text === "") fehler.push(frage.schluessel);
    else if (text !== "") antworten[frage.schluessel] = text;
  }

  if (fehler.length > 0) return { ok: false, fehler };
  return { ok: true, wert: { relevant: e["relevant"] as boolean, antworten } };
}
