// Alle Aufrufe laufen über dieselbe Adresse wie die Seite (Reverse Proxy), mit Sitzungs-Cookie.
const EXT = "/beirat-dabei";

async function anfrage(methode, pfad, body) {
  let res;
  try {
    res = await fetch(pfad, {
      method: methode,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { status: 0, daten: { fehler: "serverfehler" } };
  }
  let daten = null;
  try {
    daten = await res.json();
  } catch {
    /* leere oder keine JSON-Antwort */
  }
  return { status: res.status, daten };
}

export const login = (email, passwort) => anfrage("POST", "/auth/login", { email, password: passwort, mode: "session" });
export const logout = () => anfrage("POST", "/auth/logout", { mode: "session" });
export const passwortVergessen = (email) =>
  anfrage("POST", "/auth/password/request", { email, reset_url: `${location.origin}/admin/reset-password` });

export const dashboard = () => anfrage("GET", `${EXT}/dashboard`);
export const teilnahme = (sitzung, aktion) => anfrage("POST", `${EXT}/teilnahme`, { sitzung, aktion });
export const notiz = (sitzung, relevant, antworten) => anfrage("POST", `${EXT}/notiz`, { sitzung, relevant, antworten });

export const linkInfo = (token) => anfrage("GET", `${EXT}/link/${encodeURIComponent(token)}`);
export const linkBestaetigen = (token, body = {}) => anfrage("POST", `${EXT}/link/${encodeURIComponent(token)}`, body);
