import * as api from "./api.js";
import { el, leeren } from "./dom.js";
import { markeLaden } from "./marke.js";

const marke = markeLaden();

const inhalt = document.getElementById("inhalt");

// Der Token steht im Query-String und wird sofort aus der Adressleiste entfernt.
const token = new URLSearchParams(location.search).get("token") ?? "";
history.replaceState(null, "", location.pathname);

const zurAnmeldung = () => el("a", { class: "knopf", href: "./" }, "Zurück zur Anmeldung");

/** Ohne Token: Link zum Zurücksetzen per E-Mail anfordern. */
function anfordern() {
  const email = el("input", { id: "email", type: "email", autocomplete: "username", required: true });
  const fehler = el("p", { class: "fehler", role: "alert", hidden: true });
  const knopf = el("button", { type: "submit", class: "primaer" }, "Link anfordern");
  marke.then((name) => { document.title = `Passwort vergessen · ${name}`; });
  leeren(inhalt).append(
    el("h2", {}, "Passwort vergessen"),
    el("p", { class: "hinweis" }, "Gib die E-Mail-Adresse deines Kontos ein. Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst. So vergibst du auch bei der ersten Anmeldung dein Passwort."),
    el(
      "form",
      {
        class: "login",
        onsubmit: async (e) => {
          e.preventDefault();
          fehler.hidden = true;
          knopf.disabled = true;
          const r = await api.passwortVergessen(email.value.trim());
          knopf.disabled = false;
          if (r.status === 200) {
            leeren(inhalt).append(
              el("h2", {}, "E-Mail ist unterwegs"),
              el("p", { class: "meldung", role: "status" },
                "Wenn es ein Konto mit dieser Adresse gibt, bekommst du gleich eine E-Mail mit einem Link. Er gilt eine Stunde. Findest du sie nicht, sieh bitte im Spam-Ordner nach."),
              el("div", { class: "aktionen" }, zurAnmeldung()),
            );
            return;
          }
          fehler.textContent = r.status === 429 || r.status === 503
            ? "Zu viele Anfragen. Bitte warte eine Minute und versuche es dann noch einmal."
            : "Das hat nicht geklappt. Bitte versuche es später noch einmal.";
          fehler.hidden = false;
        },
      },
      el("label", { for: "email" }, "E-Mail-Adresse", email),
      fehler,
      el("div", { class: "aktionen" }, knopf, el("a", { href: "./" }, "Zurück zur Anmeldung")),
    ),
  );
  email.focus();
}

function formular() {
  const neu = el("input", { id: "neu", type: "password", autocomplete: "new-password", minlength: 10, required: true });
  const wiederholung = el("input", { id: "wiederholung", type: "password", autocomplete: "new-password", minlength: 10, required: true });
  const fehler = el("p", { class: "fehler", role: "alert", hidden: true });
  const knopf = el("button", { type: "submit", class: "primaer" }, "Passwort speichern");
  leeren(inhalt).append(
    el("h2", {}, "Neues Passwort festlegen"),
    el("p", { class: "hinweis" }, "Mindestens 10 Zeichen."),
    el(
      "form",
      {
        class: "login",
        onsubmit: async (e) => {
          e.preventDefault();
          fehler.hidden = true;
          if (neu.value !== wiederholung.value) {
            fehler.textContent = "Die beiden Passwörter stimmen nicht überein.";
            fehler.hidden = false;
            return;
          }
          knopf.disabled = true;
          const r = await api.passwortSetzen(token, neu.value);
          knopf.disabled = false;
          if (r.status === 200) {
            leeren(inhalt).append(
              el("p", { class: "meldung", role: "status" }, "Dein Passwort ist gespeichert. Aus Sicherheitsgründen bist du jetzt auf allen Geräten abgemeldet. Melde dich mit dem neuen Passwort an."),
              el("div", { class: "aktionen" }, el("a", { class: "knopf primaer", href: "./" }, "Zur Anmeldung")),
            );
            return;
          }
          fehler.replaceChildren("Der Link ist ungültig oder abgelaufen. ", el("a", { href: "passwort.html" }, "Neuen Link anfordern"));
          fehler.hidden = false;
        },
      },
      el("label", { for: "neu" }, "Neues Passwort", neu),
      el("label", { for: "wiederholung" }, "Passwort wiederholen", wiederholung),
      fehler,
      el("div", { class: "aktionen" }, knopf),
    ),
  );
  neu.focus();
}

if (!token) anfordern();
else formular();
