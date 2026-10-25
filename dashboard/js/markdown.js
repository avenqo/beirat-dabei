// Kleiner, sicherer Markdown-Teil für Impressum und Datenschutzerklärung.
// Erlaubt: # und ## Überschriften, Absätze, - Listen, **fett**, `code`, [Text](https://…) und mailto:.
// Kein HTML: alles andere bleibt Text. [Eckige Klammern] ohne Adresse gelten als Platzhalter.
// Dieses Modul ist reine Logik (ohne DOM) und wird mit node --test geprüft.

const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\[([^\]]+)\]/g;

export function erlaubteAdresse(adresse) {
  return /^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(adresse);
}

/** Zerlegt eine Zeile in Stücke: { art: "text" | "fett" | "code" | "link" | "platzhalter", text, href? } */
export function inline(zeile) {
  const stuecke = [];
  let letzte = 0;
  for (const m of zeile.matchAll(INLINE)) {
    if (m.index > letzte) stuecke.push({ art: "text", text: zeile.slice(letzte, m.index) });
    if (m[1] !== undefined) stuecke.push({ art: "fett", text: m[1] });
    else if (m[2] !== undefined) stuecke.push({ art: "code", text: m[2] });
    else if (m[3] !== undefined) {
      // Links nur mit erlaubter Adresse, sonst als Text mit der Adresse in Klammern
      if (erlaubteAdresse(m[4])) stuecke.push({ art: "link", text: m[3], href: m[4] });
      else stuecke.push({ art: "text", text: `${m[3]} (${m[4]})` });
    } else stuecke.push({ art: "platzhalter", text: `[${m[5]}]` });
    letzte = m.index + m[0].length;
  }
  if (letzte < zeile.length) stuecke.push({ art: "text", text: zeile.slice(letzte) });
  return stuecke;
}

/** Zerlegt den Text in Blöcke: h2, h3, p, ul (mit items). */
export function bloecke(text) {
  const ausgabe = [];
  let absatz = [];
  let liste = null;
  const absatzBeenden = () => {
    if (absatz.length) ausgabe.push({ typ: "p", inhalt: inline(absatz.join(" ")) });
    absatz = [];
  };
  const listeBeenden = () => {
    if (liste) ausgabe.push({ typ: "ul", items: liste });
    liste = null;
  };
  for (const roh of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const zeile = roh.trim();
    if (zeile === "") {
      absatzBeenden();
      listeBeenden();
    } else if (/^##\s+/.test(zeile)) {
      absatzBeenden();
      listeBeenden();
      ausgabe.push({ typ: "h3", inhalt: inline(zeile.replace(/^##\s+/, "")) });
    } else if (/^#\s+/.test(zeile)) {
      absatzBeenden();
      listeBeenden();
      ausgabe.push({ typ: "h2", inhalt: inline(zeile.replace(/^#\s+/, "")) });
    } else if (/^[-*]\s+/.test(zeile)) {
      absatzBeenden();
      (liste ??= []).push(inline(zeile.replace(/^[-*]\s+/, "")));
    } else {
      listeBeenden();
      absatz.push(zeile);
    }
  }
  absatzBeenden();
  listeBeenden();
  return ausgabe;
}

/** Anzahl offener Platzhalter, damit Administrierende sehen, was noch auszufüllen ist. */
export function platzhalter(text) {
  return bloecke(text).flatMap((b) => (b.items ?? [b.inhalt]).flat()).filter((s) => s.art === "platzhalter").length;
}
