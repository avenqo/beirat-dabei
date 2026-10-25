// Kopfzeile: Name und Logo der Instanz. Funktioniert ohne Anmeldung.
const PLATZHALTER = "img/logo-platzhalter.svg";

let geladen = null;

/** Liest Name und Logo (öffentlich) und setzt sie in die Kopfzeile. Liefert den Namen. */
export function markeLaden() {
  geladen ??= (async () => {
    let name = "Beirat dabei";
    let logo = null;
    try {
      const res = await fetch("/beirat-dabei/instanz");
      if (res.ok) {
        const d = await res.json();
        name = d.name || name;
        logo = d.logo || null;
      }
    } catch {
      /* ohne Verbindung bleibt der Standard */
    }
    markeSetzen(name, logo);
    return name;
  })();
  return geladen;
}

/** Name nach der Anmeldung aktualisieren (kommt aus den Einstellungen der Instanz). */
export function markeSetzen(name, logo) {
  const titel = document.getElementById("titel");
  const bild = document.getElementById("logo");
  if (titel) titel.textContent = name;
  document.title = name;
  if (bild) {
    bild.onerror = () => {
      bild.onerror = null;
      bild.src = PLATZHALTER;
    };
    if (logo) bild.src = logo;
    else bild.src = PLATZHALTER;
  }
}
