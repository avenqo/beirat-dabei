import * as api from "./api.js";
import { el, leeren } from "./dom.js";
import { datumLang, fehlerText } from "./format.js";
import { notizFormular } from "./notizformular.js";

const inhalt = document.getElementById("inhalt");
const titel = document.getElementById("titel");

// Der Token steht im Query-String und wird sofort aus der Adressleiste entfernt.
const token = new URLSearchParams(location.search).get("token") ?? "";
history.replaceState(null, "", location.pathname);

const zumDashboard = () => el("a", { class: "knopf", href: "./" }, "Zum Dashboard");

function fehlerAnzeige(daten) {
  leeren(inhalt).append(
    el("p", { class: "meldung fehler", role: "alert" }, fehlerText(daten?.fehler)),
    el("div", { class: "aktionen" }, zumDashboard()),
  );
}

function sitzungKopf(info) {
  return [
    el("h2", {}, info.sitzung.gremium),
    el("p", {}, datumLang(info.sitzung.beginn)),
    info.sitzung.ort ? el("p", { class: "meta" }, info.sitzung.ort) : null,
  ];
}

const FRAGE = {
  eintragen: "Möchtest du an dieser Sitzung teilnehmen?",
  austragen: "Möchtest du dich für diese Sitzung austragen?",
  "nicht-teilgenommen": "Warst du bei dieser Sitzung doch nicht dabei?",
};
const KNOPF = {
  eintragen: "Ja, ich nehme teil",
  austragen: "Ja, austragen",
  "nicht-teilgenommen": "Ja, ich war nicht dabei",
};
const ERGEBNIS = {
  eintragen: "Du bist eingetragen. Danke!",
  austragen: "Du bist ausgetragen.",
  "nicht-teilgenommen": "Danke, wir haben es vermerkt.",
};

async function start() {
  if (!token) return fehlerAnzeige({ fehler: "link-format" });
  const r = await api.linkInfo(token);
  if (r.status !== 200) return fehlerAnzeige(r.daten);
  const info = r.daten;
  titel.textContent = info.instanz;
  document.title = info.instanz;

  if (info.sitzung.abgesagt) {
    return leeren(inhalt).append(...sitzungKopf(info), el("p", { class: "meldung" }, "Diese Sitzung ist abgesagt."), el("div", { class: "aktionen" }, zumDashboard()));
  }
  if (info.aktion === "notiz") return notiz(info);
  bestaetigung(info);
}

function bestaetigung(info) {
  const bereits = info.aktion === "eintragen" && info.bereitsEingetragen;
  const knopf = el("button", {
    type: "button",
    class: "primaer",
    onclick: async () => {
      knopf.disabled = true;
      const r = await api.linkBestaetigen(token);
      if (r.status !== 200) return fehlerAnzeige(r.daten);
      fertig(info, r.daten);
    },
  }, KNOPF[info.aktion]);
  leeren(inhalt).append(
    ...sitzungKopf(info),
    el("p", {}, `Hallo ${info.mitglied}.`),
    bereits ? el("p", { class: "meldung" }, "Du bist für diese Sitzung bereits eingetragen.") : el("p", {}, FRAGE[info.aktion]),
    el("div", { class: "aktionen" }, bereits ? null : knopf, zumDashboard()),
  );
}

function fertig(info, antwort) {
  const rueckgaengig = antwort.rueckgaengig
    ? el("button", {
        type: "button",
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          const r = await api.linkBestaetigen(antwort.rueckgaengig);
          if (r.status !== 200) return fehlerAnzeige(r.daten);
          leeren(inhalt).append(
            ...sitzungKopf(info),
            el("p", { class: "meldung", role: "status" }, info.aktion === "eintragen" ? "Du bist wieder ausgetragen." : "Du bist wieder eingetragen."),
            el("div", { class: "aktionen" }, zumDashboard()),
          );
        },
      }, "Rückgängig machen")
    : null;
  leeren(inhalt).append(
    ...sitzungKopf(info),
    el("p", { class: "meldung", role: "status" }, ERGEBNIS[info.aktion]),
    el("div", { class: "aktionen" }, rueckgaengig, zumDashboard()),
    rueckgaengig ? el("p", { class: "meta" }, "Rückgängig machen geht 30 Minuten lang.") : null,
  );
}

function notiz(info) {
  leeren(inhalt).append(
    ...sitzungKopf(info),
    el("p", {}, `Hallo ${info.mitglied}, bitte halte kurz fest, was für den Beirat wichtig war.`),
    notizFormular({
      fragen: info.notizfragen,
      absenden: (relevant, antworten) => api.linkBestaetigen(token, { relevant, antworten }),
      erfolg: () =>
        leeren(inhalt).append(
          ...sitzungKopf(info),
          el("p", { class: "meldung", role: "status" }, "Danke, die Notiz ist gespeichert."),
          el("div", { class: "aktionen" }, zumDashboard()),
        ),
    }),
  );
}

start();
