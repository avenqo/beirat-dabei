export interface IcsTermin {
  uid: string;
  summary: string;
  location: string | null;
  start: Date;
  ende: Date | null;
  abgesagt: boolean;
}

function entfalten(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function entmaskieren(wert: string): string {
  return wert.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

/** Offset der Zeitzone zu UTC in Millisekunden zu einem Zeitpunkt. */
function zonenVersatz(zeitpunkt: number, zone: string): number {
  const t = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(zeitpunkt));
  const w = (typ: string) => Number(t.find((p) => p.type === typ)?.value);
  return Date.UTC(w("year"), w("month") - 1, w("day"), w("hour"), w("minute"), w("second")) - Math.floor(zeitpunkt / 1000) * 1000;
}

function zeitLesen(wert: string, parameter: string, standardZone: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(wert.trim());
  if (!m) return null;
  const [, j, mo, t, h = "0", mi = "0", s = "0", z] = m;
  const lokal = Date.UTC(Number(j), Number(mo) - 1, Number(t), Number(h), Number(mi), Number(s));
  if (z) return new Date(lokal);
  const zone = /TZID=([^;:]+)/.exec(parameter)?.[1] ?? standardZone;
  let utc = lokal - zonenVersatz(lokal, zone);
  utc = lokal - zonenVersatz(utc, zone);
  return new Date(utc);
}

/** Liest die Termine (VEVENT) aus einer iCal-Datei. Zeiten ohne Zone gelten in `standardZone`. */
export function icsLesen(text: string, standardZone = "Europe/Berlin"): IcsTermin[] {
  const termine: IcsTermin[] = [];
  let aktuell: Record<string, { parameter: string; wert: string }> | null = null;
  for (const zeile of entfalten(text)) {
    if (zeile === "BEGIN:VEVENT") aktuell = {};
    else if (zeile === "END:VEVENT" && aktuell) {
      const start = aktuell["DTSTART"] ? zeitLesen(aktuell["DTSTART"].wert, aktuell["DTSTART"].parameter, standardZone) : null;
      if (start) {
        termine.push({
          uid: aktuell["UID"]?.wert ?? "",
          summary: entmaskieren(aktuell["SUMMARY"]?.wert ?? ""),
          location: aktuell["LOCATION"]?.wert ? entmaskieren(aktuell["LOCATION"].wert) : null,
          start,
          ende: aktuell["DTEND"] ? zeitLesen(aktuell["DTEND"].wert, aktuell["DTEND"].parameter, standardZone) : null,
          abgesagt: aktuell["STATUS"]?.wert.toUpperCase() === "CANCELLED",
        });
      }
      aktuell = null;
    } else if (aktuell) {
      const i = zeile.indexOf(":");
      if (i < 0) continue;
      const kopf = zeile.slice(0, i);
      const [name = "", ...rest] = kopf.split(";");
      aktuell[name.toUpperCase()] = { parameter: rest.join(";"), wert: zeile.slice(i + 1) };
    }
  }
  return termine;
}
