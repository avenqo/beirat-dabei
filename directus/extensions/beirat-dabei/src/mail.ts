import {
  mailLinkAblauf,
  tokenErzeugenBis,
  type Nachricht,
  type RegelId,
  type SitzungInfo,
} from "@beirat-dabei/core";

export interface MailKontext {
  instanzName: string;
  /** Basisadresse des Dashboards ohne Schrägstrich am Ende */
  dashboardUrl: string;
  geheimnis: string;
  zeitzone: string;
  nachlaufTage: number;
  dauerStunden: number;
}

export interface MailDaten {
  nachricht: Nachricht;
  empfaengerName: string;
  sitzung: SitzungInfo;
  ausloeserName?: string;
  /** Empfänger ist für diese Sitzung schon eingetragen: dann kein "Ich nehme teil". */
  bereitsEingetragen?: boolean;
}

export interface Mail {
  betreff: string;
  text: string;
  html: string;
}

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wann(start: Date, zeitzone: string): { kurz: string; lang: string } {
  const f = (opt: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("de-DE", { timeZone: zeitzone, ...opt }).format(start);
  return {
    kurz: f({ weekday: "short", day: "2-digit", month: "2-digit" }),
    lang: `${f({ weekday: "long", day: "numeric", month: "long", year: "numeric" })}, ${f({ hour: "2-digit", minute: "2-digit" })} Uhr`,
  };
}

interface Absatz {
  text: string;
}
interface Knopf {
  beschriftung: string;
  url: string;
}

/** Rangfolge für den Betreff, wenn eine Mail mehrere Regeln trägt. */
const RANG: RegelId[] = ["abgesagt", "verschoben", "R4", "R3", "R1", "R5", "R2"];

export function mailRendern(daten: MailDaten, k: MailKontext): Mail {
  const { nachricht, sitzung } = daten;
  const regeln = new Set(nachricht.regeln);
  const { kurz, lang } = wann(sitzung.start, k.zeitzone);
  const titel = `${sitzung.gremiumName} am ${kurz}`;
  const ort = sitzung.ort ? `, ${sitzung.ort}` : "";

  const linkFuer = (a: "eintragen" | "nicht-teilgenommen" | "notiz") =>
    `${k.dashboardUrl}/link.html?token=${tokenErzeugenBis(
      { a, m: nachricht.empfaengerId, s: sitzung.id },
      k.geheimnis,
      mailLinkAblauf(sitzung.start, { nachlaufTage: k.nachlaufTage, dauerStunden: k.dauerStunden }),
    )}`;

  const absaetze: Absatz[] = [];
  const knoepfe: Knopf[] = [];
  const hat = (r: RegelId) => regeln.has(r);

  if (hat("abgesagt")) {
    absaetze.push({ text: `Die Sitzung ${titel} (${lang}) wurde abgesagt. Du musst nichts weiter tun.` });
  }
  if (hat("verschoben")) {
    absaetze.push({ text: `Die Sitzung wurde verschoben. Neuer Termin: ${lang}${ort}. Dein Eintrag bleibt bestehen.` });
  }
  if (hat("R1")) {
    absaetze.push({
      text: sitzung.toLink
        ? `Die Tagesordnung für ${titel} (${lang}${ort}) ist veröffentlicht: ${sitzung.toLink}`
        : `Die Tagesordnung für ${titel} (${lang}${ort}) ist veröffentlicht.`,
    });
  }
  if (hat("R3") || hat("R4")) {
    absaetze.push({
      text: hat("R4")
        ? `Für ${titel} (${lang}${ort}) hat sich zuletzt jemand ausgetragen. Damit ist niemand mehr eingetragen.`
        : `Für ${titel} (${lang}${ort}) hat sich noch niemand eingetragen.`,
    });
  }
  if (hat("R1") || hat("R3") || hat("R4")) {
    if (!daten.bereitsEingetragen || hat("R3") || hat("R4")) {
      knoepfe.push({ beschriftung: "Ich nehme teil", url: linkFuer("eintragen") });
    }
  }
  if (hat("R2")) {
    absaetze.push({
      text: `${daten.ausloeserName ?? "Jemand"} nimmt an ${titel} (${lang}${ort}) teil.`,
    });
  }
  if (hat("R5")) {
    absaetze.push({
      text: `${titel} ist vorbei. Bitte halte kurz fest, ob etwas Relevantes für den Beirat dabei war.`,
    });
    knoepfe.push({ beschriftung: "Notiz schreiben", url: linkFuer("notiz") });
    knoepfe.push({ beschriftung: "Ich war doch nicht dabei", url: linkFuer("nicht-teilgenommen") });
  }

  const rang = (r: RegelId) => RANG.indexOf(r);
  const haupt = [...nachricht.regeln].sort((a, b) => rang(a) - rang(b))[0] ?? "R2";
  const betreffZusatz: Record<RegelId, string> = {
    abgesagt: "abgesagt",
    verschoben: "verschoben",
    R4: "niemand mehr eingetragen",
    R3: "noch niemand eingetragen",
    R1: "Tagesordnung veröffentlicht",
    R5: "Notiz fehlt noch",
    R2: "neue Teilnahme",
  };
  const betreff = `${k.instanzName}: ${titel}, ${betreffZusatz[haupt]}`;

  const gruss = `Hallo ${daten.empfaengerName},`;
  const fuss = `Alle Sitzungen im Überblick: ${k.dashboardUrl}/\nImpressum: ${k.dashboardUrl}/impressum.html · Datenschutz: ${k.dashboardUrl}/datenschutz.html`;
  const text = [
    gruss,
    "",
    ...absaetze.map((a) => a.text + "\n"),
    ...knoepfe.map((b) => `${b.beschriftung}: ${b.url}`),
    "",
    fuss,
    "",
    k.instanzName,
  ].join("\n");

  const html = `<!doctype html><html lang="de"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1b1b1b;max-width:36em">
<p>${esc(gruss)}</p>
${absaetze.map((a) => `<p>${esc(a.text)}</p>`).join("\n")}
${knoepfe
  .map(
    (b) =>
      `<p><a href="${esc(b.url)}" style="display:inline-block;padding:.6em 1.2em;background:#2e7d32;color:#fff;border-radius:6px;text-decoration:none">${esc(b.beschriftung)}</a></p>`,
  )
  .join("\n")}
<p style="color:#555"><a href="${esc(k.dashboardUrl)}/">Alle Sitzungen im Überblick</a><br>${esc(k.instanzName)}<br><a href="${esc(k.dashboardUrl)}/impressum.html">Impressum</a> · <a href="${esc(k.dashboardUrl)}/datenschutz.html">Datenschutz</a></p>
</body></html>`;

  return { betreff, text, html };
}
