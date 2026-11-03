// Abschnitte einer Seite mit Sprungleiste. Gemeinsam für das Dashboard und die öffentliche Seite.
import { el } from "./dom.js";

/**
 * Ein Abschnitt mit Überschrift, optionaler Anzahl und farbiger Kante.
 * `kurz` ist die kürzere Beschriftung in der Sprungleiste.
 */
export function bereich({ id, titel, kurz = titel, anzahl = null, art = "gruen", knoten }) {
  return {
    id,
    kurz,
    anzahl,
    knoten: el(
      "section",
      { class: "bereich", id, "data-art": art, "aria-labelledby": `${id}-titel` },
      el("h2", { id: `${id}-titel` }, titel, anzahl !== null ? el("span", { class: "zahl" }, anzahl) : null),
      ...knoten,
    ),
  };
}

/** Leiste zum schnellen Springen zwischen den Abschnitten. Bleibt beim Scrollen oben stehen. */
export function sprungleiste(bereiche) {
  return el(
    "nav",
    { class: "sprung", "aria-label": "Springen zu" },
    ...bereiche.map((b) =>
      el(
        "a",
        {
          href: `#${b.id}`,
          "data-ziel": b.id,
          onclick: (e) => {
            e.preventDefault();
            // Den angeklickten Eintrag sofort markieren, auch wenn der Abschnitt am Seitenende nicht ganz nach oben kommt
            markieren(b.id);
            sperreBis = Date.now() + 1500;
            document.getElementById(b.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
        },
        b.kurz,
        b.anzahl !== null ? el("span", { class: "zahl" }, b.anzahl) : null,
      ),
    ),
  );
}

let beobachter = null;
let sperreBis = 0;

function markieren(id) {
  for (const a of document.querySelectorAll(".sprung a")) {
    a.toggleAttribute("aria-current", a.dataset.ziel === id);
    if (a.dataset.ziel === id) rollen(a);
  }
}

/** Auf schmalen Bildschirmen scrollt die Leiste seitlich: den aktiven Eintrag in die Mitte holen. */
function rollen(a) {
  const leiste = a.parentElement;
  if (leiste && leiste.scrollWidth > leiste.clientWidth) {
    leiste.scrollTo({ left: a.offsetLeft - leiste.clientWidth / 2 + a.offsetWidth / 2, behavior: "smooth" });
  }
}

/** Hebt in der Sprungleiste den Abschnitt hervor, der gerade im Blick ist, und rollt ihn ins Bild. */
export function sprungMarkieren(bereiche) {
  beobachter?.disconnect();
  if (!("IntersectionObserver" in window)) return;
  const sichtbar = new Set();
  let zuletzt = null;
  beobachter = new IntersectionObserver(
    (eintraege) => {
      for (const e of eintraege) (e.isIntersecting ? sichtbar.add(e.target.id) : sichtbar.delete(e.target.id));
      if (Date.now() < sperreBis) return; // gerade angeklickt: Auswahl nicht überschreiben
      const erster = bereiche.find((b) => sichtbar.has(b.id));
      if (erster && erster.id !== zuletzt) {
        zuletzt = erster.id;
        markieren(erster.id);
      }
    },
    { rootMargin: "-20% 0px -60% 0px" },
  );
  for (const b of bereiche) beobachter.observe(b.knoten);
}
