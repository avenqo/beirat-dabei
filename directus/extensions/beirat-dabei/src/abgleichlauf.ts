import {
  abgleichBerechnen,
  adapterErzeugen,
  type BekannteSitzung,
  type Http,
  type NeueSitzung,
  type RisTagesordnung,
  type SitzungsAenderung,
} from "@beirat-dabei/ris-adapter";
import type { Modus } from "./regellauf.js";

export interface GremiumZeile {
  id: string;
  name: string;
  /** Name des Gremiums im RIS */
  risKennung: string;
  aktiv: boolean;
}

export interface AbgleichSpeicher {
  risEinstellungen(): Promise<{ adapter: string; quelle: string; zeitzone?: string }>;
  gremien(): Promise<GremiumZeile[]>;
  sitzungenBekannt(gremiumId: string): Promise<BekannteSitzung[]>;
  sitzungAnlegen(gremiumId: string, daten: NeueSitzung): Promise<void>;
  sitzungAendern(id: string, daten: Partial<SitzungsAenderung>): Promise<void>;
}

export interface AbgleichOptionen {
  speicher: AbgleichSpeicher;
  http: Http;
  jetzt: () => Date;
  modus: Modus;
  /** Wie weit der Abgleich in die Zukunft schaut, in Tagen */
  vorschauTage?: number;
  /** Wie weit er zurückschaut, in Tagen. So erscheint auch die letzte Sitzung für nachträgliche Notizen. */
  rueckblickTage?: number;
  log: { info(msg: string): void; error(err: unknown, msg: string): void };
}

export interface AbgleichErgebnis {
  angelegt: number;
  geaendert: number;
}

let laeuft = false;

/** Gleicht die Sitzungen der aktiven Gremien mit dem RIS ab. Fehler eines Gremiums stoppen die anderen nicht. */
export async function abgleichAusfuehren(o: AbgleichOptionen): Promise<AbgleichErgebnis> {
  const ergebnis: AbgleichErgebnis = { angelegt: 0, geaendert: 0 };
  if (o.modus === "aus" || laeuft) return ergebnis;
  laeuft = true;
  try {
    const { adapter: name, quelle, zeitzone } = await o.speicher.risEinstellungen();
    const adapter = adapterErzeugen(name, quelle, o.http, zeitzone);
    if (!adapter) {
      o.log.info(`RIS-Abgleich übersprungen (Adapter "${name}" ohne Abgleich)`);
      return ergebnis;
    }
    const jetzt = o.jetzt();
    const zeitraum = {
      von: new Date(jetzt.getTime() - (o.rueckblickTage ?? 45) * 86_400_000),
      bis: new Date(jetzt.getTime() + (o.vorschauTage ?? 90) * 86_400_000),
    };

    for (const g of (await o.speicher.gremien()).filter((x) => x.aktiv && x.risKennung)) {
      try {
        const { sitzungen, vollstaendig } = await adapter.sitzungen(g.risKennung, zeitraum);
        const bekannt = await o.speicher.sitzungenBekannt(g.id);

        // Tagesordnung nur abrufen, wo sie noch nicht als veröffentlicht gilt
        const tagesordnungen = new Map<string, RisTagesordnung>();
        for (const s of sitzungen) {
          if (bekannt.some((b) => b.risId === s.risId && b.toVeroeffentlicht)) continue;
          try {
            tagesordnungen.set(s.risId, await adapter.tagesordnung(s.risId));
          } catch (e) {
            o.log.error(e, `Tagesordnung ${s.risId} nicht abrufbar`);
          }
        }

        const aenderungen = abgleichBerechnen({ bekannt, ris: sitzungen, tagesordnungen, jetzt, zeitraum, vollstaendig });
        for (const a of aenderungen) {
          const text =
            a.art === "anlegen"
              ? `neue Sitzung ${a.daten.start.toISOString()} (${g.name})`
              : `Sitzung ${a.id} (${g.name}): ${a.gruende.join(", ")}`;
          if (o.modus === "trocken") {
            o.log.info(`[trocken] RIS-Abgleich: ${text}`);
            continue;
          }
          if (a.art === "anlegen") {
            await o.speicher.sitzungAnlegen(g.id, a.daten);
            ergebnis.angelegt++;
          } else {
            await o.speicher.sitzungAendern(a.id, a.daten);
            ergebnis.geaendert++;
          }
          o.log.info(`RIS-Abgleich: ${text}`);
        }
      } catch (e) {
        o.log.error(e, `RIS-Abgleich für ${g.name} fehlgeschlagen`);
      }
    }
    o.log.info(`RIS-Abgleich (${o.modus}): ${ergebnis.angelegt} angelegt, ${ergebnis.geaendert} geändert`);
    return ergebnis;
  } finally {
    laeuft = false;
  }
}
