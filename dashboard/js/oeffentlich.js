import { el, leeren, sichereUrl } from "./dom.js";
import { datumLang } from "./format.js";
import { markeLaden, markeSetzen } from "./marke.js";
import { bereich, sprungleiste, sprungMarkieren } from "./bereiche.js";

const inhalt = document.getElementById("inhalt");
markeLaden();

function groesse(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function endung(typ, name) {
  if (typ === "application/pdf") return "PDF";
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(name ?? "");
  return m ? m[1].toUpperCase() : "";
}

function datumKurz(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

async function laden() {
  let daten;
  try {
    const res = await fetch("/beirat-dabei/oeffentlich");
    if (!res.ok) throw new Error(String(res.status));
    daten = await res.json();
  } catch {
    return void leeren(inhalt).append(el("p", { class: "fehler", role: "alert" }, "Die Unterlagen konnten nicht geladen werden. Bitte versuche es später noch einmal."));
  }
  markeSetzen(daten.instanz.name, daten.instanz.logo);
  document.title = `Öffentliche Unterlagen – ${daten.instanz.name}`;
  leeren(inhalt);

  // Abschnitt 1: Termine
  const termine = daten.sitzungen.length === 0
    ? [el("p", { class: "leer" }, "Zurzeit sind keine Sitzungen bekannt.")]
    : daten.sitzungen.map((s) => {
        const to = sichereUrl(s.tagesordnung);
        return el("article", { class: `karte${s.abgesagt ? " abgesagt" : ""}` },
          el("div", { class: "zeile" },
            el("h3", {}, s.gremium),
            s.abgesagt ? el("span", { class: "chip abgesagt" }, "Abgesagt") : null,
          ),
          el("p", { class: "meta" }, datumLang(s.beginn)),
          s.ort ? el("p", { class: "meta" }, s.ort) : null,
          !s.abgesagt ? el("p", { class: "abschnitt" }, to ? el("a", { href: to, target: "_blank", rel: "noopener noreferrer" }, "Tagesordnung ansehen") : "Tagesordnung: noch nicht veröffentlicht") : null,
        );
      });
  const bereiche = [bereich({ id: "termine", titel: "Nächste Sitzungen", kurz: "Termine", anzahl: daten.sitzungen.length, art: "gruen", knoten: termine })];

  // Weitere Abschnitte: je eine Kategorie von Unterlagen
  for (const k of daten.kategorien) {
    const liste = el("ul", { class: "dokumente" },
      ...k.dokumente.map((x) => {
        const art = [endung(x.typ, x.dateiname), groesse(x.groesse)].filter(Boolean).join(", ");
        return el("li", { class: "karte" },
          el("a", { href: x.url, target: "_blank", rel: "noopener" }, x.titel),
          el("p", { class: "meta" }, [datumKurz(x.datum), art ? `(${art})` : ""].filter(Boolean).join(" ")),
          x.beschreibung ? el("p", {}, x.beschreibung) : null,
        );
      }),
    );
    bereiche.push(bereich({ id: `kat-${k.id}`, titel: k.titel, anzahl: k.dokumente.length, art: "blau", knoten: [liste] }));
  }
  if (daten.kategorien.length === 0) {
    bereiche.push(bereich({ id: "kat-leer", titel: "Unterlagen", art: "blau", knoten: [el("p", { class: "leer" }, "Noch keine Unterlagen veröffentlicht.")] }));
  }

  if (bereiche.length > 2) inhalt.append(sprungleiste(bereiche));
  inhalt.append(el("p", { class: "hinweis" }, "Öffentliche Termine und Unterlagen. Die Teilnahme und Notizen der Mitglieder sind nicht öffentlich."));
  for (const b of bereiche) inhalt.append(b.knoten);
  if (bereiche.length > 2) sprungMarkieren(bereiche);
}

laden();
