import { tageZwischen } from "./fristen.js";
import { aktiveTeilnahmen } from "./status.js";
import type { Nachricht, RegelId, Versand, Zustand } from "./types.js";

/**
 * Prüft alle Benachrichtigungsregeln gegen den Zustand und liefert die fälligen
 * Nachrichten. Reine Funktion: kein Versand, keine Uhr, keine Datenbank.
 * Was bereits im Versandprotokoll steht, wird nicht noch einmal geliefert.
 */
export function faelligeNachrichten(z: Zustand): Nachricht[] {
  const { jetzt, einstellungen: einst } = z;
  const aktiveMitglieder = z.mitglieder.filter((m) => m.aktiv).map((m) => m.id);
  const gesendet = new Set(z.versand.map(schluessel));
  const ergebnis = new Map<string, Nachricht>();

  const hinzufuegen = (
    regel: RegelId,
    sitzungId: string,
    empfaengerId: string,
    bezug: string,
    ausloeserId?: string,
  ) => {
    const eintrag: Versand = { regel, sitzungId, empfaengerId, bezug };
    if (gesendet.has(schluessel(eintrag))) return;
    const key = `${sitzungId}|${empfaengerId}|${ausloeserId ?? ""}`;
    const vorhanden = ergebnis.get(key);
    if (vorhanden) {
      if (!vorhanden.regeln.includes(regel)) vorhanden.regeln.push(regel);
      vorhanden.protokoll.push(eintrag);
    } else {
      ergebnis.set(key, {
        empfaengerId,
        sitzungId,
        regeln: [regel],
        ...(ausloeserId ? { ausloeserId } : {}),
        protokoll: [eintrag],
      });
    }
  };

  for (const sitzung of z.sitzungen) {
    const bevorstehend = sitzung.start.getTime() > jetzt.getTime();
    const aktive = aktiveTeilnahmen(z.teilnahmen, sitzung.id).filter((t) =>
      aktiveMitglieder.includes(t.mitgliedId),
    );
    const startIso = sitzung.start.toISOString();

    if (sitzung.abgesagt) {
      // Absage: einmalige Info an die Eingetragenen, danach nichts mehr.
      if (bevorstehend) {
        for (const t of aktive) hinzufuegen("abgesagt", sitzung.id, t.mitgliedId, "abgesagt");
      }
      continue;
    }

    if (bevorstehend) {
      const tageBis = tageZwischen(jetzt, sitzung.start, einst.zeitzone);
      const imFristfenster = tageBis <= einst.fristVorTage;
      const niemand = aktive.length === 0;

      // Verschiebung: Eingetragene informieren. Fristen ergeben sich neu aus dem Beginn.
      if (sitzung.verschobenVon) {
        for (const t of aktive) hinzufuegen("verschoben", sitzung.id, t.mitgliedId, startIso);
      }

      // R1: Tagesordnung veröffentlicht -> alle Mitglieder
      if (sitzung.toVeroeffentlicht) {
        for (const id of aktiveMitglieder) hinzufuegen("R1", sitzung.id, id, "to");
      }

      // R2: Jemand trägt sich ein -> alle anderen Mitglieder
      for (const t of aktive) {
        const bezug = `${t.id}:${t.eingetragenAm.toISOString()}`;
        for (const id of aktiveMitglieder) {
          if (id !== t.mitgliedId) hinzufuegen("R2", sitzung.id, id, bezug, t.mitgliedId);
        }
      }

      // Letzte Austragung innerhalb der Frist (Grundlage für R4)
      const austragung = z.teilnahmen
        .filter(
          (t) =>
            t.sitzungId === sitzung.id &&
            t.ausgetragenAm &&
            tageZwischen(t.ausgetragenAm, sitzung.start, einst.zeitzone) <= einst.fristVorTage,
        )
        .sort((a, b) => b.ausgetragenAm!.getTime() - a.ausgetragenAm!.getTime())[0];

      if (niemand && imFristfenster) {
        // R3: niemand eingetragen. Nachholen, falls die Frist schon angebrochen ist.
        const r3Offen = aktiveMitglieder.some(
          (id) => !gesendet.has(schluessel({ regel: "R3", sitzungId: sitzung.id, empfaengerId: id, bezug: startIso })),
        );
        if (r3Offen) {
          for (const id of aktiveMitglieder) {
            hinzufuegen("R3", sitzung.id, id, startIso);
            // R4 in derselben Mail abgedeckt, damit sie nicht am Folgetag nachläuft.
            if (austragung) hinzufuegen("R4", sitzung.id, id, schluesselAustragung(austragung));
          }
        } else if (austragung) {
          // R4: letzte Person hat sich ausgetragen, R3 ging schon raus.
          for (const id of aktiveMitglieder) {
            hinzufuegen("R4", sitzung.id, id, schluesselAustragung(austragung));
          }
        }
      }
      continue;
    }

    // R5: Notiz fehlt n Tage nach der Sitzung -> die Teilnehmenden
    const tageSeit = tageZwischen(sitzung.start, jetzt, einst.zeitzone);
    const hatNotiz = z.notizen.some((n) => n.sitzungId === sitzung.id);
    if (!hatNotiz && tageSeit >= einst.fristNachTage) {
      for (const t of aktive) {
        if (!t.nichtTeilgenommen) hinzufuegen("R5", sitzung.id, t.mitgliedId, "notiz");
      }
    }
  }

  return [...ergebnis.values()];
}

function schluessel(v: Versand): string {
  return `${v.regel}|${v.sitzungId}|${v.empfaengerId}|${v.bezug}`;
}

function schluesselAustragung(t: { id: string; ausgetragenAm?: Date | null }): string {
  return `${t.id}:${t.ausgetragenAm!.toISOString()}`;
}
