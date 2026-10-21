import * as api from "./api.js";
import { el, leeren, sichereUrl } from "./dom.js";
import { countdown, datumLang, fehlerText, STATUS, tagKurz } from "./format.js";
import { markeLaden } from "./marke.js";
import { bereich, sprungleiste, sprungMarkieren } from "./bereiche.js";
import { notizFormular } from "./notizformular.js";

const inhalt = document.getElementById("inhalt");
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

async function zeigeLogin(hinweis) {
  abmelden.hidden = true;
  const name = await markeLaden();
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
    el("p", { class: "hinweis" }, `Mitgliederbereich von ${name}. Hier tragen sich die Mitglieder zu den Sitzungen ein und halten Notizen fest.`),
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
    el("p", { class: "hinweis abstand" }, "Kein Mitglied? ", el("a", { href: "oeffentlich.html" }, "Öffentliche Termine und Unterlagen ansehen")),
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

  const gremien = [...new Map([...daten.kommend, ...daten.vergangen].map((s) => [s.gremiumId, s.gremium])).entries()];
  const passt = (s) => !filter || s.gremiumId === filter;
  const kommend = daten.kommend.filter(passt);
  const vergangen = daten.vergangen.filter(passt);

  // Hinweise: dringende Sitzungen und fehlende Notizen der letzten Wochen
  const dringend = kommend.filter((s) => s.status === "dringend");
  const ohneNotiz = vergangen.filter((s) => s.status === "notiz-fehlt" && s.tageBis >= -60);
  const hinweise = [];
  if (dringend.length > 0) hinweise.push(alarm(dringend));
  if (ohneNotiz.length > 0) hinweise.push(notizHinweis(ohneNotiz));

  const bereiche = [];
  if (hinweise.length > 0) bereiche.push(bereich({ id: "hinweise", titel: "Hinweise", anzahl: dringend.length + ohneNotiz.length, art: "hinweis", knoten: hinweise }));
  bereiche.push(bereich({
    id: "anstehend", titel: "Anstehende Sitzungen", kurz: "Anstehend", anzahl: kommend.length, art: "gruen",
    knoten: kommend.length === 0 ? [el("p", { class: "leer" }, "Keine anstehenden Sitzungen.")] : nachMonat(kommend),
  }));
  bereiche.push(bereich({
    id: "vergangen", titel: "Vergangene Sitzungen", kurz: "Vergangen", anzahl: vergangen.length, art: "grau",
    knoten: vergangen.length === 0 ? [el("p", { class: "leer" }, "Noch keine vergangenen Sitzungen.")] : nachMonat(vergangen),
  }));
  bereiche.push(bereich({ id: "kalender", titel: "Kalender", art: "blau", knoten: [kalenderAbo()] }));

  inhalt.append(sprungleiste(bereiche));
  if (meldung) inhalt.append(el("p", { class: `meldung${meldung.fehler ? " fehler" : ""}`, role: "alert" }, meldung.text));
  if (gremien.length > 1) {
    const auswahl = el(
      "select",
      { id: "gremium", onchange: (e) => { filter = e.target.value; zeichnen(); } },
      el("option", { value: "" }, "Alle Gremien"),
      ...gremien.map(([id, name]) => el("option", { value: id, selected: id === filter }, name)),
    );
    inhalt.append(el("label", { class: "filter", for: "gremium" }, "Gremium", auswahl));
  }
  for (const b of bereiche) inhalt.append(b.knoten);
  sprungMarkieren(bereiche);
}

/** Karten unter Monatsüberschriften gruppieren, damit lange Listen überschaubar bleiben. */
function nachMonat(sitzungen) {
  const zone = daten.instanz.zeitzone;
  const monat = (iso) => new Intl.DateTimeFormat("de-DE", { timeZone: zone, month: "long", year: "numeric" }).format(new Date(iso));
  const ausgabe = [];
  let aktuell = null;
  for (const s of sitzungen) {
    const m = monat(s.beginn);
    if (m !== aktuell) {
      aktuell = m;
      ausgabe.push(el("h3", { class: "monat" }, m));
    }
    ausgabe.push(karte(s));
  }
  return ausgabe;
}

/** Dezenter Hinweis (gelb): Sitzungen, zu denen noch keine Notiz geschrieben wurde. */
function notizHinweis(sitzungen) {
  const zone = daten.instanz.zeitzone;
  return el(
    "div",
    { class: "hinweisbox", role: "status" },
    el("h3", {}, sitzungen.length === 1 ? "Hinweis: Die Notiz für eine Sitzung fehlt noch" : `Hinweis: Die Notizen für ${sitzungen.length} Sitzungen fehlen noch`),
    ...sitzungen.map((s) =>
      el("div", { class: "alarm-zeile" },
        el("p", {}, el("strong", {}, `${s.gremium}, ${tagKurz(s.beginn, zone)}`), ` (${countdown(s.tageBis)})`),
        s.ichTeilnehmend
          ? el("button", { type: "button", class: "primaer", onclick: () => notizDialog(s) }, "Notiz schreiben")
          : el("button", {
              type: "button",
              onclick: (e) => aktion(e.currentTarget, () => api.teilnahme(s.id, "dabei-gewesen")),
            }, "Ich war dabei"),
      ),
    ),
  );
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
          el("div", { class: "aktionen" },
            kopieren,
            el("a", { class: "knopf", href: r.daten.webcal }, "In Kalender-App öffnen"),
            el("a", { class: "knopf", href: r.daten.url, download: "sitzungen.ics" }, "Einmalig herunterladen (.ics)"),
          ),
          el("p", { class: "meta" }, "Die Abo-Funktion der Kalender-Apps verlangt meist eine https-Adresse. Wenn sie die Adresse ablehnt, hilft der einmalige Download. Er aktualisiert sich aber nicht von selbst."),
        );
      },
    },
    el("summary", {}, "Kalender abonnieren"),
    platz,
  );
  return bereich;
}

/** Auffälliger Hinweis oben: Sitzungen in der Frist, zu denen sich noch niemand eingetragen hat. */
function alarm(sitzungen) {
  return el(
    "section",
    { class: "alarm", role: "alert", "aria-label": "Dringend" },
    el("h3", {}, sitzungen.length === 1 ? "Dringend: Für eine Sitzung fehlt noch jemand" : `Dringend: Für ${sitzungen.length} Sitzungen fehlt noch jemand`),
    ...sitzungen.map((s) =>
      el("div", { class: "alarm-zeile" },
        el("p", {}, el("strong", {}, `${s.gremium}, ${tagKurz(s.beginn, daten.instanz.zeitzone)}`), ` (${countdown(s.tageBis)}): noch niemand eingetragen.`),
        el("button", {
          type: "button",
          class: "primaer",
          onclick: (e) => aktion(e.currentTarget, () => api.teilnahme(s.id, "eintragen")),
        }, "Ich nehme teil"),
      ),
    ),
  );
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
      el("span", { class: `chip ${s.status}` }, s.status === "dringend" ? "⚠ " : null, STATUS[s.status] ?? s.status),
    ),
  );
  const wann = el("p", { class: "meta" }, `${datumLang(s.beginn, zone)} · ${countdown(s.tageBis)}`);
  const ort = s.ort ? el("p", { class: "meta" }, s.ort) : null;

  const teile = [kopf, wann, ort];
  if (!s.abgesagt) teile.push(tagesordnung(s));
  if (!s.abgesagt && !vorbei) teile.push(teilnahme(s));
  if (vorbei && !s.abgesagt) teile.push(ergebnis(s));

  return el("article", { class: `karte${s.abgesagt ? " abgesagt" : ""}${s.status === "dringend" ? " dringend" : ""}` }, ...teile);
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
  if (!s.ichTeilnehmend) {
    teile.push(
      el("p", { class: "meta" }, "Notizen können alle schreiben, die bei der Sitzung dabei waren."),
      el("div", { class: "aktionen" },
        el("button", {
          type: "button",
          class: s.notiz ? "" : "primaer",
          onclick: (e) => aktion(e.currentTarget, () => api.teilnahme(s.id, "dabei-gewesen")),
        }, "Ich war dabei"),
      ),
    );
  }
  if (s.ichTeilnehmend) {
    teile.push(
      el("div", { class: "aktionen" },
        el("button", { type: "button", class: s.notiz ? "" : "primaer", onclick: () => notizDialog(s) }, s.notiz ? "Notiz ergänzen" : "Notiz schreiben"),
        s.notiz ? el("button", { type: "button", class: "gefahr", onclick: () => loeschenDialog(s) }, "Notiz löschen") : null,
        el("button", {
          type: "button",
          onclick: (e) => aktion(e.currentTarget, () => api.teilnahme(s.id, "nicht-teilgenommen")),
        }, "Ich war doch nicht dabei"),
      ),
    );
  }
  return el("div", { class: "abschnitt" }, ...teile);
}

/** Sicherheitsabfrage vor dem Löschen. Die Notiz gehört allen Teilnehmenden und ist danach weg. */
function loeschenDialog(s) {
  const dialog = el("dialog", { "aria-labelledby": "loeschen-titel" });
  const schliessen = () => {
    dialog.close();
    dialog.remove();
  };
  const meldung = el("p", { class: "fehler", role: "alert", hidden: true });
  const ja = el("button", {
    type: "button",
    class: "gefahr primaer",
    onclick: async () => {
      ja.disabled = true;
      const r = await api.notizLoeschen(s.id);
      if (r.status !== 200) {
        ja.disabled = false;
        meldung.textContent = fehlerText(r.daten?.fehler);
        meldung.hidden = false;
        return;
      }
      schliessen();
      meldung_zuruecksetzen();
      await laden();
    },
  }, "Notiz endgültig löschen");
  dialog.append(
    el("h3", { id: "loeschen-titel" }, "Notiz löschen?"),
    el("p", {}, `Die Notiz zur Sitzung am ${datumLang(s.beginn, daten.instanz.zeitzone)} wird für alle gelöscht. Das lässt sich nicht rückgängig machen.`),
    meldung,
    el("div", { class: "aktionen" }, ja, el("button", { type: "button", onclick: schliessen }, "Abbrechen")),
  );
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

function meldung_zuruecksetzen() {
  meldung = null;
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

markeLaden(); // Name und Logo, auch wenn man schon angemeldet ist
laden();
