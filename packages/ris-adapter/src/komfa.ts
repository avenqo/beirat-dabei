import { parse, type HTMLElement } from "node-html-parser";
import type { Http } from "./http.js";
import { icsLesen } from "./ics.js";
import type { RisAdapter, RisSitzung, RisTagesordnung, RisTop, SitzungenErgebnis, Zeitraum } from "./types.js";

const ABSAGE = /abgesagt|entf[aä]llt|f[aä]llt aus|findet nicht statt/i;

const norm = (t: string) => t.replace(/ /g, " ").replace(/\s+/g, " ").trim();

export interface KalenderEintrag {
  risId: string;
  /** Voller Titel, z. B. "Stadt Musterstadt, Bauausschuss" */
  titel: string;
}

/** Sitzungen aus der Monatsansicht des KOMFA-Kalenders (action=cal). */
export function kalenderLesen(html: string): KalenderEintrag[] {
  const eintraege: KalenderEintrag[] = [];
  for (const ev of parse(html).querySelectorAll("div.cal_event")) {
    // Die Kennung steht an der iCal-Verknüpfung; der Titel ist nur bei vorhandener
    // Tagesordnung verlinkt.
    const href = ev.querySelectorAll("a").map((a) => a.getAttribute("href") ?? "").find((h) => /[?&;]id=/.test(h)) ?? "";
    const id = /[?&;]id=([0-9A-Fa-f]+)/.exec(href)?.[1];
    const titelKnoten = ev.querySelector(".cal_eventtitle");
    const titel = norm(titelKnoten?.querySelector("a")?.getAttribute("title") ?? titelKnoten?.text ?? "");
    if (id && titel) eintraege.push({ risId: id, titel });
  }
  return eintraege;
}

/** Gremiumsname aus dem Kalendertitel ("Gemeinde, Gremium"). */
function passtZuGremium(titel: string, gremium: string): boolean {
  return titel === gremium || titel.endsWith(`, ${gremium}`);
}

/** Tagesordnungsseite (action=to). */
export function tagesordnungLesen(html: string, link: string): RisTagesordnung {
  const root = parse(html);
  const inhalt = root.querySelector("#mpc") ?? root;

  const tops: RisTop[] = [];
  const topTabelle = inhalt.querySelector("table.table-hover");
  for (const zeile of topTabelle?.querySelectorAll("tr") ?? []) {
    // Zeilen der Dokumentlisten stecken in verschachtelten Tabellen
    if (zeile.closest("table") !== topTabelle) continue;
    const zellen = zeile.childNodes.filter((n): n is HTMLElement => "tagName" in n && n.tagName === "TD");
    const nummer = norm(zellen[0]?.text ?? "");
    if (!/^\d+\.?$/.test(nummer)) continue;
    const titel = norm(zellen[1]?.text ?? "");
    if (!titel) continue;
    tops.push({ nummer, titel, vorlage: norm(zellen[2]?.text ?? "") || null });
  }

  const einladung = inhalt
    .querySelectorAll("tr")
    .some((tr) => /action=dlg/.test(tr.innerHTML) && /einladung/i.test(tr.text));

  // Absage nur in Kopf und Anschreiben suchen, nicht in TOP-Titeln und Dateinamen
  const kopf = parse(inhalt.innerHTML);
  for (const t of kopf.querySelectorAll("table.table-hover, table.w00")) t.remove();
  const abgesagt = ABSAGE.test(norm(kopf.text));

  return { veroeffentlicht: tops.length > 0 || einladung, link, tops, abgesagt };
}

export interface KomfaOptionen {
  /** z. B. https://ris-musterstadt.komfa.de */
  basisUrl: string;
  http: Http;
  jetzt?: () => Date;
  /** Obergrenze für abgerufene Monate pro Aufruf */
  maxMonate?: number;
  /** Zeitzone der Instanz, für Zeiten ohne Zone in der iCal-Datei */
  zeitzone?: string;
}

/**
 * Adapter für das KOMFA RIS: Monatskalender (action=cal) liefert die Sitzungen,
 * die iCal-Datei (action=ic) Beginn, Ende und Ort, die Tagesordnungsseite
 * (action=to) die TOPs und die Einladung.
 */
export class KomfaAdapter implements RisAdapter {
  private readonly basis: string;
  constructor(private readonly o: KomfaOptionen) {
    this.basis = o.basisUrl.replace(/\/$/, "");
  }

  private url(action: string, extra = ""): string {
    return `${this.basis}/index.php?module=komfaris&action=${action}${extra}`;
  }

  seitenLink(risId: string): string {
    return this.url("to", `&id=${risId}`);
  }

  async sitzungen(gremium: string, zeitraum: Zeitraum): Promise<SitzungenErgebnis> {
    let vollstaendig = true;
    const gefunden = new Map<string, KalenderEintrag>();

    const monate: string[] = [];
    const lauf = new Date(Date.UTC(zeitraum.von.getUTCFullYear(), zeitraum.von.getUTCMonth(), 1));
    while (lauf <= zeitraum.bis && monate.length < (this.o.maxMonate ?? 6)) {
      monate.push(`${lauf.getUTCFullYear()}-${String(lauf.getUTCMonth() + 1).padStart(2, "0")}-01`);
      lauf.setUTCMonth(lauf.getUTCMonth() + 1);
    }

    for (const monat of monate) {
      try {
        const r = await this.o.http.holen(this.url("cal", `&SetFilter=calstartdate&FilterValue=${monat}`));
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
        for (const e of kalenderLesen(r.text)) {
          if (passtZuGremium(e.titel, gremium)) gefunden.set(e.risId, e);
        }
      } catch {
        vollstaendig = false;
      }
    }

    const sitzungen: RisSitzung[] = [];
    for (const e of gefunden.values()) {
      try {
        const r = await this.o.http.holen(this.url("ic", `&id=${e.risId}`));
        if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
        const t = icsLesen(r.text, this.o.zeitzone)[0];
        if (!t) throw new Error("keine Termine in iCal");
        if (t.start < zeitraum.von || t.start > zeitraum.bis) continue;
        sitzungen.push({
          risId: e.risId,
          gremium,
          start: t.start,
          ende: t.ende,
          ort: t.location,
          risLink: this.seitenLink(e.risId),
          abgesagt: t.abgesagt || ABSAGE.test(`${t.summary} ${e.titel}`),
        });
      } catch {
        vollstaendig = false;
      }
    }
    sitzungen.sort((a, b) => a.start.getTime() - b.start.getTime());
    return { sitzungen, vollstaendig };
  }

  async tagesordnung(risId: string): Promise<RisTagesordnung> {
    const link = this.seitenLink(risId);
    const r = await this.o.http.holen(link);
    if (r.status !== 200) throw new Error(`Tagesordnung ${risId}: HTTP ${r.status}`);
    return tagesordnungLesen(r.text, link);
  }
}
