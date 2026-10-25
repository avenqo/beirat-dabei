import {
  faelligeNachrichten,
  type Notiz,
  type Nachricht,
  type Teilnahme,
  type Versand,
  type Zustand,
} from "@beirat-dabei/core";
import { mailRendern, type Mail, type MailKontext } from "./mail.js";
import type { Speicher } from "./handlers.js";

export interface Empfaenger {
  id: string;
  aktiv: boolean;
  name: string;
  email: string;
}

/** Zusätzliche Zugriffe, die nur der Regellauf braucht. Enthält E-Mail-Adressen. */
export interface RegelSpeicher extends Speicher {
  empfaenger(): Promise<Empfaenger[]>;
  versand(): Promise<Versand[]>;
  versandSchreiben(eintraege: Versand[]): Promise<void>;
}

export interface Mailer {
  senden(mail: Mail & { an: string }): Promise<void>;
}

export type Modus = "aus" | "trocken" | "scharf";

export interface RegellaufOptionen {
  speicher: RegelSpeicher;
  mailer: Mailer;
  jetzt: () => Date;
  modus: Modus;
  /** Sitzungen, die länger zurückliegen, werden nicht mehr bewertet. */
  maxAlterTage?: number;
  mail: Omit<MailKontext, "instanzName" | "zeitzone">;
  log: { info(msg: string): void; error(err: unknown, msg: string): void };
}

export interface Ergebnis {
  faellig: number;
  gesendet: number;
  fehlgeschlagen: number;
}

let laeuft = false;

/**
 * Prüft die Regeln und verschickt die fälligen Mails. Ein Eintrag im Versandprotokoll
 * entsteht erst nach erfolgreichem Versand. Schlägt ein Versand fehl, wird er beim
 * nächsten Lauf wiederholt. Im Modus "trocken" wird nur geloggt.
 */
export async function regellaufAusfuehren(o: RegellaufOptionen): Promise<Ergebnis> {
  const leer: Ergebnis = { faellig: 0, gesendet: 0, fehlgeschlagen: 0 };
  if (o.modus === "aus" || laeuft) return leer;
  laeuft = true;
  try {
    const jetzt = o.jetzt();
    const { einstellungen, notizfragen: _f, name } = await o.speicher.einstellungen();
    const [empfaenger, alleSitzungen, teilnahmen, notizen, versand] = await Promise.all([
      o.speicher.empfaenger(),
      o.speicher.sitzungen(),
      o.speicher.teilnahmen(),
      o.speicher.notizen(),
      o.speicher.versand(),
    ]);
    const grenze = jetzt.getTime() - (o.maxAlterTage ?? 60) * 86_400_000;
    const sitzungen = alleSitzungen.filter((s) => s.start.getTime() >= grenze);

    const zustand: Zustand = {
      jetzt,
      einstellungen,
      mitglieder: empfaenger.map(({ id, aktiv }) => ({ id, aktiv })),
      sitzungen,
      teilnahmen: teilnahmen as Teilnahme[],
      notizen: notizen as Notiz[],
      versand,
    };
    const nachrichten = faelligeNachrichten(zustand);
    const ergebnis = { ...leer, faellig: nachrichten.length };
    const kontext: MailKontext = { ...o.mail, instanzName: name ?? "Beirat dabei", zeitzone: einstellungen.zeitzone };
    const person = new Map(empfaenger.map((e) => [e.id, e]));

    for (const n of nachrichten) {
      const an = person.get(n.empfaengerId);
      const sitzung = sitzungen.find((s) => s.id === n.sitzungId);
      if (!an || !sitzung || !an.email) continue;
      const mail = mailRendern(
        {
          nachricht: n,
          empfaengerName: an.name,
          sitzung,
          bereitsEingetragen: teilnahmen.some(
            (t) => t.sitzungId === sitzung.id && t.mitgliedId === n.empfaengerId && !t.ausgetragenAm,
          ),
          ...(n.ausloeserId ? { ausloeserName: person.get(n.ausloeserId)?.name ?? "Jemand" } : {}),
        },
        kontext,
      );
      if (o.modus === "trocken") {
        o.log.info(`[trocken] ${n.regeln.join("+")} an ${an.name} (${sitzung.id}): ${mail.betreff}`);
        continue;
      }
      try {
        await o.mailer.senden({ ...mail, an: an.email });
        await o.speicher.versandSchreiben(n.protokoll);
        ergebnis.gesendet++;
      } catch (e) {
        ergebnis.fehlgeschlagen++;
        o.log.error(e, `Versand ${n.regeln.join("+")} an ${an.name} fehlgeschlagen`);
      }
    }
    o.log.info(`Regellauf (${o.modus}): ${ergebnis.faellig} fällig, ${ergebnis.gesendet} gesendet, ${ergebnis.fehlgeschlagen} fehlgeschlagen`);
    return ergebnis;
  } finally {
    laeuft = false;
  }
}

export type { Nachricht };
