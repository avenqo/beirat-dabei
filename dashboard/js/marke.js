// Kopfzeile: Name und Logo der Instanz. Funktioniert ohne Anmeldung.
const PLATZHALTER = "img/logo-platzhalter.svg";

let geladen = null;

/** Liest Name und Logo (öffentlich) und setzt sie in die Kopfzeile. Liefert den Namen. */
export function markeLaden() {
  geladen ??= (async () => {
    let name = "Beirat dabei";
    let logo = null;
    let akzent = null;
    try {
      const res = await fetch("/beirat-dabei/instanz");
      if (res.ok) {
        const d = await res.json();
        name = d.name || name;
        logo = d.logo || null;
        akzent = d.akzent || null;
      }
    } catch {
      /* ohne Verbindung bleibt der Standard */
    }
    markeSetzen(name, logo, akzent);
    return name;
  })();
  return geladen;
}

/** Name nach der Anmeldung aktualisieren (kommt aus den Einstellungen der Instanz). */
export function markeSetzen(name, logo, akzent) {
  akzentSetzen(akzent);
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
  symbolSetzen(logo);
}

/** Ist in den Einstellungen ein Logo hinterlegt, erscheint es auch als Symbol im Browser-Tab. */
function symbolSetzen(logo) {
  if (!logo) return;
  for (const link of document.querySelectorAll('link[rel="icon"]')) link.remove();
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = logo;
  document.head.append(link);
}

/**
 * Setzt die Akzentfarbe der Instanz (Hex, sechs Stellen). Das Stylesheet leitet daraus
 * Knöpfe, Kopfzeile und Markierungen ab, im hellen wie im dunklen Modus.
 * Ungültige oder fehlende Werte lassen das Standardgrün stehen.
 */
export function akzentSetzen(akzent) {
  const wurzel = document.documentElement.style;
  if (typeof akzent !== "string" || !/^#[0-9a-f]{6}$/i.test(akzent)) {
    wurzel.removeProperty("--akzent-basis");
    wurzel.removeProperty("--akzent-basis-text");
    return;
  }
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(akzent.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const hell = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  wurzel.setProperty("--akzent-basis", akzent);
  // Weiße Schrift, solange sie auf der Farbe lesbar bleibt, sonst fast schwarze
  wurzel.setProperty("--akzent-basis-text", hell > 0.4 ? "#12170f" : "#ffffff");
}
