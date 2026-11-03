import assert from "node:assert/strict";
import { test } from "node:test";
import { bloecke, erlaubteAdresse, inline, platzhalter } from "../js/markdown.js";

test("Überschriften, Absätze und Listen", () => {
  const b = bloecke("# Titel\n\nErster Satz\nzweite Zeile.\n\n## Unterpunkt\n\n- eins\n- zwei\n\nSchluss");
  assert.deepEqual(b.map((x) => x.typ), ["h2", "p", "h3", "ul", "p"]);
  assert.equal(b[1].inhalt[0].text, "Erster Satz zweite Zeile.");
  assert.equal(b[3].items.length, 2);
});

test("fett, code und Links", () => {
  const s = inline("Das ist **wichtig**, siehe `cookie` und [Seite](https://example.org/x).");
  assert.deepEqual(s.map((x) => x.art), ["text", "fett", "text", "code", "text", "link", "text"]);
  assert.equal(s[5].href, "https://example.org/x");
});

test("gefährliche Adressen werden nicht zu Links", () => {
  for (const schlecht of ["javascript:alert(1)", "data:text/html,x", "//evil.example", "ftp://x"]) {
    const s = inline(`[Klick](${schlecht})`);
    assert.equal(s.some((x) => x.art === "link"), false, schlecht);
    assert.match(s[0].text, /Klick/);
  }
  assert.equal(erlaubteAdresse("mailto:a@example.org"), true);
  assert.equal(erlaubteAdresse("HTTPS://example.org"), true);
  assert.equal(erlaubteAdresse("javascript:alert(1)"), false);
});

test("HTML bleibt Text", () => {
  const s = inline("<script>alert(1)</script> und <b>fett</b>");
  assert.equal(s.length, 1);
  assert.equal(s[0].art, "text");
  assert.match(s[0].text, /<script>/);
});

test("Platzhalter in eckigen Klammern werden erkannt und gezählt", () => {
  const s = inline("E-Mail: [E-Mail-Adresse] oder [Link](https://example.org)");
  assert.deepEqual(s.map((x) => x.art), ["text", "platzhalter", "text", "link"]);
  assert.equal(platzhalter("# T\n\n[A] und [B]\n\n- [C]"), 3);
  assert.equal(platzhalter("alles ausgefüllt"), 0);
});

test("leere und fehlende Texte", () => {
  assert.deepEqual(bloecke(""), []);
  assert.deepEqual(bloecke(null), []);
  assert.equal(platzhalter(undefined), 0);
});

test("Windows-Zeilenenden", () => {
  assert.equal(bloecke("# A\r\n\r\nText\r\n").length, 2);
});
