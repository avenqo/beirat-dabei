import * as api from "./api.js";
import { el, leeren, sichereUrl } from "./dom.js";
import { countdown, datumLang, fehlerText, STATUS } from "./format.js";
import { notizFormular } from "./notizformular.js";

const inhalt = document.getElementById("inhalt");
const titel = document.getElementById("titel");
const abmelden = document.getElementById("abmelden");

let daten = null; // letzte Antwort des Dashboards
let filter = ""; // gewähltes Gremium
let meldung = null; // { text, fehler }

abmelden.addEventListener("click", async () => {
  await api.logout();
  daten = null;
  zeigeLogin();
});

// --- Anmeldung ---------------------------------------------------------

function zeigeLogin(hinweis) {
  abmelden.hidden = true;
  leeren(inhalt);
  const fehler = el("p", { class: "fehler", role: "alert", hidden: !hinweis }, hinweis ?? "");
  const email = el("input", { id: "email", type: "email", autocomplete: "username", required: true });
  const passwort = el("input", { id: "passwort", type: "password", autocomplete: "current-password", required: true });
  const knopf = el("button", { type: "submit", class: "primaer" }, "Anmelden");
  const vergessen = el("button", {
    type: "button",
    class: "link",
    onclick: async () => {
      if (!email.value) {
        fehler.textContent = "Bitte trage zuerst deine E-Mail-Adresse ein.";
        fehler.hidden = false;
        return;
      }
      await api.passwortVergessen(email.value.trim());
      fehler.hidden = true;
      inhalt.prepend(el("p", { class: "meldung" }, "Falls die Adresse bekannt ist, haben wir dir einen Link zum Zurücksetzen geschickt."));
    },
  }, "Passwort vergessen");

  inhalt.append(
    el("h2", {}, "Anmelden"),
    el(
      "form",
      {
        class: "login",
        onsubmit: async (e) => {
          e.preventDefault();
          knopf.disabled = true;
          const r = await api.login(email.value.trim(), passwort.value);
          knopf.disabled = false;
          if (r.status === 200) return laden();
          fehler.textContent = r.status === 401 ? "E-Mail-Adresse oder Passwort stimmen nicht." : fehlerText(r.daten?.fehler);
          fehler.hidden = false;
        },
      },
      el("label", { for: "email" }, "E-Mail-Adresse", email),
      el("label", { for: "passwort" }, "Passwort", passwort),
      fehler,
      el("div", { class: "aktionen" }, knopf, vergessen),
    ),
  );
  email.focus();
}

// --- Daten laden und anzeigen -------------------------------------------

async function laden() {
  const r = await api.dashboard();
  if (r.status === 401) return zeigeLogin();
  if (r.status === 403) {
    await api.logout();
    return zeigeLogin(fehlerText(r.daten?.fehler));
  }
  if (r.status !== 200) {
    leeren(inhalt).append(el("p", { class: "fehler", role: "alert" }, fehlerText(r.daten?.fehler)));
    return;
  }
  daten = r.daten;
  titel.textContent = daten.instanz.name;
  document.title = daten.instanz.name;
  abmelden.hidden = false;
  zeichnen();
}

async function aktion(knopf, aufruf) {
  knopf.disabled = true;
  const r = await aufruf();
  if (r.status === 401) return zeigeLogin();
  meldung = r.status === 200 ? null : { text: fehlerText(r.daten?.fehler), fehler: true };
  await laden();
}

function zeichnen() {
  leeren(inhalt);
  if (meldung) inhalt.append(el("p", { class: `meldung${meldung.fehler ? " fehler" : ""}`, role: "alert" }, meldung.text));

  const gremien = [...new Map([...daten.kommend, ...daten.vergangen].map((s) => [s.gremiumId, s.gremium])).entries()];
  if (gremien.length > 1) {
    const auswahl = el(
      "select",
      { id: "gremium", onchange: (e) => { filter = e.target.value; zeichnen(); } },
      el("option", { value: "" }, "Alle Gremien"),
      ...gremien.map(([id, name]) => el("option", { value: id, selected: id === filter }, name)),
    );
    inhalt.append(el("label", { class: "filter", for: "gremium" }, "Gremium", auswahl));
  }

  const passt = (s) => !filter || s.gremiumId === filter;
  const kommend = daten.kommend.filter(passt);
  const vergangen = daten.vergangen.filter(passt);

  inhalt.append(el("h2", {}, "Anstehende Sitzungen"));
  if (kommend.length === 0) inhalt.append(el("p", { class: "leer" }, "Keine anstehenden Sitzungen."));
  for (const s of kommend) inhalt.append(karte(s));

  inhalt.append(el("h2", {}, "Vergangene Sitzungen"));
  if (vergangen.length === 0) inhalt.append(el("p", { class: "leer" }, "Noch keine vergangenen Sitzungen."));
  for (const s of vergangen) inhalt.append(karte(s));

  inhalt.append(kalenderAbo());
}

/** Persönliche Abo-Adresse für den eigenen Kalender, wird erst beim Aufklappen geladen. */
function kalenderAbo() {
  const platz = el("div", { class: "abschnitt" }, el("p", { class: "meta" }, "Lade …"));
  const bereich = el(
    "details",
    {
      class: "karte abo",
      ontoggle: async (e) => {
        if (!e.target.open || platz.dataset.geladen) return;
        platz.dataset.geladen = "1";
        const r = await api.abo();
        if (r.status !== 200) {
          delete platz.dataset.geladen;
          return void platz.replaceChildren(el("p", { class: "fehler" }, fehlerText(r.daten?.fehler)));
        }
        const feld = el("input", { type: "text", readonly: true, value: r.daten.url, "aria-label": "Abo-Adresse", onfocus: (ev) => ev.target.select() });
        const kopieren = el("button", {
          type: "button",
          onclick: async (ev) => {
            try {
              await navigator.clipboard.writeText(r.daten.url);
              ev.target.textContent = "Kopiert";
            } catch {
              feld.select();
            }
          },
        }, "Kopieren");
        platz.replaceChildren(
          el("p", { class: "meta" }, "Alle Sitzungstermine in deinem Kalender, aktualisiert sich von selbst. Die Adresse gehört nur dir, bitte nicht weitergeben."),
          feld,
          el("div", { class: "aktionen" }, kopieren, el("a", { class: "knopf", href: r.daten.webcal }, "In Kalender-App öffnen")),
        );
      },
    },
    el("summary", {}, "Kalender abonnieren"),
    platz,
  );
  return bereich;
}

function karte(s) {
  const zone = daten.instanz.zeitzone;
  const vorbei = s.status === "notiz-fehlt" || s.status === "dokumentiert" || (s.abgesagt && s.tageBis < 0);

  const kopf = el(
    "div",
    { class: "zeile" },
    el("h3", {}, s.gremium),
    el("span", {},
      s.verschoben && !vorbei ? el("span", { class: "chip verschoben" }, "Verschoben") : null,
      " ",
      el("span", { class: `chip ${s.status}` }, STATUS[s.status] ?? s.status),
    ),
  );
  const wann = el("p", { class: "meta" }, `${datumLang(s.beginn, zone)} · ${countdown(s.tageBis)}`);
  const ort = s.ort ? el("p", { class: "meta" }, s.ort) : null;

  const teile = [kopf, wann, ort];
  if (!s.abgesagt) teile.push(tagesordnung(s));
  if (!s.abgesagt && !vorbei) teile.push(teilnahme(s));
  if (vorbei && !s.abgesagt) teile.push(ergebnis(s));

  return el("article", { class: `karte${s.abgesagt ? " abgesagt" : ""}` }, ...teile);
}

function tagesordnung(s) {
  const to = s.toVeroeffentlicht ? sichereUrl(s.toLink) : null;
  const ris = sichereUrl(s.risLink);
  let inhaltZeile;
  if (s.toVeroeffentlicht && to) inhaltZeile = el("a", { href: to, target: "_blank", rel: "noopener noreferrer" }, "Tagesordnung ansehen");
  else if (s.toVeroeffentlicht) inhaltZeile = "veröffentlicht";
  else inhaltZeile = ["noch nicht veröffentlicht", ris ? [" · ", el("a", { href: ris, target: "_blank", rel: "noopener noreferrer" }, "im Ratsinformationssystem")] : null];
  return el("div", { class: "abschnitt" }, el("span", { class: "label" }, "Tagesordnung"), inhaltZeile);
}

function teilnahme(s) {
  const namen = s.teilnehmer.map((t) => t.name).join(", ");
  const knopf = el("button", {
    type: "button",
    class: s.ichTeilnehmend ? "" : "primaer",
    onclick: (e) => aktion(e.currentTarget, () => api.teilnahme(s.id, s.ichTeilnehmend ? "austragen" : "eintragen")),
  }, s.ichTeilnehmend ? "Austragen" : "Ich nehme teil");
  return el(
    "div",
    { class: "abschnitt" },
    el("span", { class: "label" }, "Teilnahme"),
    namen || "Noch niemand eingetragen.",
    el("div", { class: "aktionen" }, knopf),
  );
}

function ergebnis(s) {
  const teile = [el("span", { class: "label" }, "Ergebnis")];
  if (s.notiz) {
    const liste = el("dl", { class: "notiz" }, el("dt", {}, "Relevant für den Beirat?"), el("dd", {}, s.notiz.relevant ? "Ja" : "Nein"));
    for (const frage of daten.notizfragen.filter((f) => f.schluessel !== "relevant")) {
      const antwort = s.notiz.antworten?.[frage.schluessel];
      if (antwort) liste.append(el("dt", {}, frage.frage), el("dd", {}, antwort));
    }
    teile.push(liste);
  } else {
    teile.push(el("p", { class: "meta" }, "Noch keine Notiz."));
  }
  if (s.ichTeilnehmend) {
    teile.push(
      el("div", { class: "aktionen" },
        el("button", { type: "button", class: s.notiz ? "" : "primaer", onclick: () => notizDialog(s) }, s.notiz ? "Notiz ergänzen" : "Notiz schreiben"),
        el("button", {
          type: "button",
          onclick: (e) => aktion(e.currentTarget, () => api.teilnahme(s.id, "nicht-teilgenommen")),
        }, "Ich war doch nicht dabei"),
      ),
    );
  }
  return el("div", { class: "abschnitt" }, ...teile);
}

function notizDialog(s) {
  const dialog = el("dialog", { "aria-labelledby": "notiz-titel" });
  const schliessen = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.append(
    el("h3", { id: "notiz-titel" }, `Notiz: ${s.gremium}`),
    el("p", { class: "meta" }, datumLang(s.beginn, daten.instanz.zeitzone)),
    notizFormular({
      fragen: daten.notizfragen,
      vorbelegung: s.notiz,
      absenden: (relevant, antworten) => api.notiz(s.id, relevant, antworten),
      abbrechen: schliessen,
      erfolg: async () => {
        schliessen();
        meldung = null;
        await laden();
      },
    }),
  );
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

laden();
