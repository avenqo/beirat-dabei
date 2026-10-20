export function datumLang(iso, zeitzone = "Europe/Berlin") {
  const d = new Date(iso);
  const f = (opt) => new Intl.DateTimeFormat("de-DE", { timeZone: zeitzone, ...opt }).format(d);
  return `${f({ weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${f({ hour: "2-digit", minute: "2-digit" })} Uhr`;
}

export function countdown(tage) {
  if (tage === 0) return "heute";
  if (tage === 1) return "morgen";
  if (tage > 1) return `in ${tage} Tagen`;
  if (tage === -1) return "gestern";
  return `vor ${-tage} Tagen`;
}

export const STATUS = {
  besetzt: "Besetzt",
  offen: "Noch offen",
  dringend: "Dringend",
  "notiz-fehlt": "Notiz fehlt",
  dokumentiert: "Dokumentiert",
  abgesagt: "Abgesagt",
};

export const FEHLER = {
  "nicht-angemeldet": "Bitte melde dich an.",
  "kein-mitglied": "Dieses Konto ist kein aktives Mitglied.",
  abgesagt: "Die Sitzung ist abgesagt.",
  vergangen: "Die Sitzung hat schon begonnen.",
  "nicht-vorbei": "Die Sitzung hat noch nicht begonnen.",
  "nicht-eingetragen": "Du bist für diese Sitzung nicht eingetragen.",
  "nicht-teilnehmend": "Nur Teilnehmende können die Notiz schreiben.",
  "sitzung-unbekannt": "Diese Sitzung gibt es nicht mehr.",
  "ungueltige-eingabe": "Bitte prüfe deine Eingaben.",
  "link-abgelaufen": "Dieser Link ist abgelaufen. Du kannst dich im Dashboard anmelden und dort eintragen.",
  "link-signatur": "Dieser Link ist ungültig.",
  "link-format": "Dieser Link ist ungültig.",
  serverfehler: "Das hat leider nicht geklappt. Bitte versuche es später noch einmal.",
};

export const fehlerText = (code) => FEHLER[code] ?? FEHLER.serverfehler;
