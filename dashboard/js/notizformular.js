import { el } from "./dom.js";
import { fehlerText } from "./format.js";

/**
 * Formular für die Kurznotiz, aufgebaut aus den Fragen der Instanz.
 * Die Frage mit dem Schlüssel "relevant" ist immer ja/nein und Pflicht.
 * `absenden(relevant, antworten)` liefert die API-Antwort { status, daten }.
 */
export function notizFormular({ fragen, vorbelegung, absenden, abbrechen, erfolg }) {
  const meldung = el("p", { class: "fehler", role: "alert", hidden: true });
  const felder = [];

  const ichFrage = fragen.find((f) => f.schluessel === "relevant") ?? {
    schluessel: "relevant",
    frage: "War etwas Relevantes für den Beirat dabei?",
    typ: "ja-nein",
    pflicht: true,
  };
  const relevantGruppe = jaNein(ichFrage, "relevant", vorbelegung?.relevant === undefined ? null : vorbelegung.relevant ? "ja" : "nein", true);
  felder.push(relevantGruppe.knoten);

  const weitere = fragen.filter((f) => f.schluessel !== "relevant");
  const lesen = [];
  for (const f of weitere) {
    const wert = vorbelegung?.antworten?.[f.schluessel] ?? "";
    if (f.typ === "ja-nein") {
      const g = jaNein(f, f.schluessel, wert || null, f.pflicht);
      felder.push(g.knoten);
      lesen.push([f.schluessel, g.wert]);
    } else {
      const id = `frage-${f.schluessel}`;
      const eingabe = el("textarea", { id, name: f.schluessel, required: f.pflicht, maxlength: "5000" });
      eingabe.value = wert;
      felder.push(el("label", { for: id }, el("span", { class: f.pflicht ? "pflicht" : "" }, f.frage), eingabe));
      lesen.push([f.schluessel, () => eingabe.value.trim()]);
    }
  }

  const speichern = el("button", { type: "submit", class: "primaer" }, "Speichern");
  const form = el(
    "form",
    {
      class: "fragen",
      onsubmit: async (ereignis) => {
        ereignis.preventDefault();
        meldung.hidden = true;
        const relevant = relevantGruppe.wert();
        if (relevant === null) return zeigeFehler("Bitte beantworte die erste Frage mit Ja oder Nein.");
        const antworten = {};
        for (const [schluessel, holen] of lesen) {
          const w = holen();
          if (w) antworten[schluessel] = w;
        }
        speichern.disabled = true;
        const r = await absenden(relevant === "ja", antworten);
        speichern.disabled = false;
        if (r.status === 200) return erfolg();
        const felderNamen = r.daten?.felder;
        zeigeFehler(
          felderNamen?.length
            ? `Bitte ergänze: ${felderNamen.map((n) => fragen.find((f) => f.schluessel === n)?.frage ?? n).join("; ")}`
            : fehlerText(r.daten?.fehler),
        );
      },
    },
    ...felder,
    meldung,
    el("div", { class: "aktionen" }, speichern, abbrechen && el("button", { type: "button", onclick: abbrechen }, "Abbrechen")),
  );

  function zeigeFehler(text) {
    meldung.textContent = text;
    meldung.hidden = false;
  }
  return form;
}

function jaNein(frage, name, vorgabe, pflicht) {
  const optionen = ["ja", "nein"].map((w) => {
    const eingabe = el("input", { type: "radio", name, value: w, checked: vorgabe === w, required: pflicht });
    return el("label", {}, eingabe, w === "ja" ? "Ja" : "Nein");
  });
  const knoten = el(
    "fieldset",
    {},
    el("legend", { class: pflicht ? "pflicht" : "" }, frage.frage),
    ...optionen,
  );
  return {
    knoten,
    wert: () => knoten.querySelector("input:checked")?.value ?? null,
  };
}
