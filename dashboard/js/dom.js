/** Kleiner Helfer zum Aufbau von DOM-Knoten. Texte werden nie als HTML interpretiert. */
export function el(tag, attribute = {}, ...kinder) {
  const knoten = document.createElement(tag);
  for (const [name, wert] of Object.entries(attribute)) {
    if (wert === false || wert == null) continue;
    if (name === "class") knoten.className = wert;
    else if (name.startsWith("on") && typeof wert === "function") knoten.addEventListener(name.slice(2), wert);
    else if (wert === true) knoten.setAttribute(name, "");
    else knoten.setAttribute(name, wert);
  }
  for (const k of kinder.flat(Infinity)) {
    if (k == null || k === false) continue;
    knoten.append(typeof k === "string" || typeof k === "number" ? document.createTextNode(String(k)) : k);
  }
  return knoten;
}

export function leeren(knoten) {
  knoten.replaceChildren();
  return knoten;
}

/** Nur http(s)-Adressen als Link zulassen. */
export function sichereUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}
