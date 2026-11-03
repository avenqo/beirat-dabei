import * as api from "./api.js";
import { el, leeren } from "./dom.js";
import { markeLaden } from "./marke.js";

markeLaden();

const inhalt = document.getElementById("inhalt");

// Der Token steht im Query-String und wird sofort aus der Adressleiste entfernt.
const token = new URLSearchParams(location.search).get("token") ?? "";
history.replaceState(null, "", location.pathname);

const zumDashboard = () => el("a", { class: "knopf", href: "./" }, "Zum Dashboard");

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
              el("p", { class: "meldung", role: "status" }, "Dein Passwort ist gespeichert. Du kannst dich jetzt anmelden."),
              el("div", { class: "aktionen" }, zumDashboard()),
            );
            return;
          }
          fehler.textContent = "Der Link ist ungültig oder abgelaufen. Fordere im Dashboard über „Passwort vergessen“ einen neuen an.";
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

if (!token) {
  leeren(inhalt).append(
    el("p", { class: "meldung fehler", role: "alert" }, "Dieser Link ist ungültig."),
    el("div", { class: "aktionen" }, zumDashboard()),
  );
} else {
  formular();
}
