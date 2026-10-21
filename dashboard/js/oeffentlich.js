import { el, leeren, sichereUrl } from "./dom.js";
import { datumLang } from "./format.js";
import { markeLaden, markeSetzen } from "./marke.js";

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

  inhalt.append(el("h2", {}, "Nächste Sitzungen"));
  if (daten.sitzungen.length === 0) inhalt.append(el("p", { class: "leer" }, "Zurzeit sind keine Sitzungen bekannt."));
  for (const s of daten.sitzungen) {
    const to = sichereUrl(s.tagesordnung);
    inhalt.append(
      el("article", { class: `karte${s.abgesagt ? " abgesagt" : ""}` },
        el("div", { class: "zeile" },
          el("h3", {}, s.gremium),
          s.abgesagt ? el("span", { class: "chip abgesagt" }, "Abgesagt") : null,
        ),
        el("p", { class: "meta" }, datumLang(s.beginn)),
        s.ort ? el("p", { class: "meta" }, s.ort) : null,
        !s.abgesagt ? el("p", { class: "abschnitt" }, to ? el("a", { href: to, target: "_blank", rel: "noopener noreferrer" }, "Tagesordnung ansehen") : "Tagesordnung: noch nicht veröffentlicht") : null,
      ),
    );
  }

  inhalt.append(el("h2", {}, "Unterlagen"));
  if (daten.kategorien.length === 0) inhalt.append(el("p", { class: "leer" }, "Noch keine Unterlagen veröffentlicht."));
  for (const k of daten.kategorien) {
    inhalt.append(el("h3", { class: "kategorie" }, k.titel));
    const liste = el("ul", { class: "dokumente" });
    for (const x of k.dokumente) {
      const art = [endung(x.typ, x.dateiname), groesse(x.groesse)].filter(Boolean).join(", ");
      liste.append(
        el("li", { class: "karte" },
          el("a", { href: x.url, target: "_blank", rel: "noopener" }, x.titel),
          el("p", { class: "meta" }, [datumKurz(x.datum), art ? `(${art})` : ""].filter(Boolean).join(" ")),
          x.beschreibung ? el("p", {}, x.beschreibung) : null,
        ),
      );
    }
    inhalt.append(liste);
  }
}

laden();
