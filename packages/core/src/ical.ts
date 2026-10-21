export interface KalenderSitzung {
  id: string;
  start: Date;
  /** Standard: 120 Minuten */
  dauerMinuten?: number;
  titel: string;
  ort?: string;
  beschreibung?: string;
  url?: string;
  abgesagt?: boolean;
}

export interface KalenderOptionen {
  /** Anzeigename des Kalenders */
  name: string;
  /** Domain für die UIDs, z. B. "umweltbeirat.kremmen.de" */
  domain: string;
  /** Zeitstempel der Erzeugung (DTSTAMP) */
  jetzt: Date;
}

const CRLF = "\r\n";

function zeit(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function maskieren(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Zeilen länger als 75 Oktette umbrechen (RFC 5545, 3.1), ohne Zeichen zu zerteilen. */
function umbrechen(zeile: string): string {
  const teile: string[] = [];
  let aktuell = "";
  let bytes = 0;
  let grenze = 75;
  for (const zeichen of zeile) {
    const laenge = Buffer.byteLength(zeichen);
    if (bytes + laenge > grenze) {
      teile.push(aktuell);
      aktuell = "";
      bytes = 0;
      grenze = 74; // Fortsetzungszeilen beginnen mit einem Leerzeichen
    }
    aktuell += zeichen;
    bytes += laenge;
  }
  teile.push(aktuell);
  return teile.join(CRLF + " ");
}

export function kalenderErzeugen(sitzungen: KalenderSitzung[], opt: KalenderOptionen): string {
  const zeilen: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//beirat-dabei//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${maskieren(opt.name)}`,
    // Hinweis an Kalender-Apps, wie oft sie nachladen sollen
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const s of sitzungen) {
    const ende = new Date(s.start.getTime() + (s.dauerMinuten ?? 120) * 60_000);
    zeilen.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@${opt.domain}`,
      `DTSTAMP:${zeit(opt.jetzt)}`,
      `DTSTART:${zeit(s.start)}`,
      `DTEND:${zeit(ende)}`,
      `SUMMARY:${maskieren(s.titel)}`,
    );
    if (s.ort) zeilen.push(`LOCATION:${maskieren(s.ort)}`);
    if (s.beschreibung) zeilen.push(`DESCRIPTION:${maskieren(s.beschreibung)}`);
    if (s.url) zeilen.push(`URL:${s.url}`);
    zeilen.push(`STATUS:${s.abgesagt ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT");
  }
  zeilen.push("END:VCALENDAR");
  return zeilen.map(umbrechen).join(CRLF) + CRLF;
}
