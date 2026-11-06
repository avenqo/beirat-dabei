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

export const login = async (email, passwort) => {
  const r = await anfrage("POST", "/api/users/login", { email, password: passwort });
  // Payload meldet Fehler als { errors: [{ message }] }; gesperrte Konten kommen als 403
  if (r.status === 403) r.daten = { fehler: "konto-gesperrt" };
  return r;
};
export const logout = () => anfrage("POST", "/api/users/logout");
/** Angemeldetes Konto und Ablauf der Anmeldung ({ user, exp } mit exp in Sekunden). */
export const ich = () => anfrage("GET", "/api/users/me");
/** Anmeldung verlängern, solange jemand im Dashboard aktiv ist. Liefert ein neues exp. */
export const verlaengern = () => anfrage("POST", "/api/users/refresh-token");
export const passwortVergessen = (email) => anfrage("POST", "/api/users/forgot-password", { email });
export const passwortSetzen = (token, passwort) => anfrage("POST", "/api/users/reset-password", { token, password: passwort });

export const abo = () => anfrage("GET", `${EXT}/abo`);
export const dashboard = () => anfrage("GET", `${EXT}/dashboard`);
export const teilnahme = (sitzung, aktion) => anfrage("POST", `${EXT}/teilnahme`, { sitzung, aktion });
export const notiz = (sitzung, relevant, antworten) => anfrage("POST", `${EXT}/notiz`, { sitzung, relevant, antworten });

export const notizLoeschen = (sitzung) => anfrage("POST", `${EXT}/notiz/loeschen`, { sitzung });

export const linkInfo = (token) => anfrage("GET", `${EXT}/link/${encodeURIComponent(token)}`);
export const linkBestaetigen = (token, body = {}) => anfrage("POST", `${EXT}/link/${encodeURIComponent(token)}`, body);
