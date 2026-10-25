import { el, leeren } from "./dom.js";
import { bloecke, platzhalter } from "./markdown.js";
import { markeLaden, markeSetzen } from "./marke.js";

const inhalt = document.getElementById("inhalt");
const seite = inhalt.dataset.seite; // "impressum" oder "datenschutz"
markeLaden();

function inlineKnoten(stuecke) {
  return stuecke.map((s) => {
    if (s.art === "fett") return el("strong", {}, s.text);
    if (s.art === "code") return el("code", {}, s.text);
    if (s.art === "link") return el("a", { href: s.href, rel: "noopener noreferrer", target: s.href.startsWith("mailto:") ? null : "_blank" }, s.text);
    if (s.art === "platzhalter") return el("mark", { class: "platzhalter" }, s.text);
    return s.text;
  });
}

function darstellen(text) {
  return bloecke(text).map((b) => {
    if (b.typ === "h2") return el("h2", { class: "recht-titel" }, ...inlineKnoten(b.inhalt));
    if (b.typ === "h3") return el("h3", { class: "recht-abschnitt" }, ...inlineKnoten(b.inhalt));
    if (b.typ === "ul") return el("ul", { class: "recht-liste" }, ...b.items.map((i) => el("li", {}, ...inlineKnoten(i))));
    return el("p", { class: "recht-text" }, ...inlineKnoten(b.inhalt));
  });
}

async function laden() {
  let daten;
  try {
    const res = await fetch("/beirat-dabei/rechtliches");
    if (!res.ok) throw new Error(String(res.status));
    daten = await res.json();
  } catch {
    return void leeren(inhalt).append(el("p", { class: "fehler", role: "alert" }, "Die Seite konnte nicht geladen werden. Bitte versuche es später noch einmal."));
  }
  markeSetzen(daten.instanz, null);
  const text = daten[seite] ?? "";
  document.title = `${seite === "impressum" ? "Impressum" : "Datenschutzerklärung"} – ${daten.instanz}`;
  leeren(inhalt);
  if (!text.trim()) {
    return void inhalt.append(el("p", { class: "meldung" }, "Dieser Text ist noch nicht hinterlegt. Er wird in der Verwaltung unter Einstellungen gepflegt."));
  }
  inhalt.append(el("article", { class: "recht" }, ...darstellen(text)));
}

laden();
