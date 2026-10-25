import type { Sitzung, Teilnahme } from "./types.js";

export type TeilnahmeAktion = "eintragen" | "austragen" | "nicht-teilgenommen" | "dabei-gewesen";

export type TeilnahmeFehler = "abgesagt" | "vergangen" | "nicht-vorbei" | "nicht-eingetragen";

export type TeilnahmeAenderung =
  | { art: "anlegen"; daten: Omit<Teilnahme, "id"> }
  | { art: "aktualisieren"; id: string; daten: Partial<Omit<Teilnahme, "id">> }
  | { art: "keine" };

export type TeilnahmeErgebnis =
  | { ok: true; aenderung: TeilnahmeAenderung }
  | { ok: false; grund: TeilnahmeFehler };

/**
 * Entscheidet, was eine Teilnahme-Aktion bewirkt. Reine Funktion; die Anbindung
 * schreibt die Änderung in die Datenbank. Wiederholte Aktionen sind folgenlos.
 * `teilnahmen` enthält die Teilnahmen dieser Sitzung (andere werden ignoriert).
 */
export function teilnahmeAnwenden(args: {
  aktion: TeilnahmeAktion;
  sitzung: Sitzung;
  teilnahmen: Teilnahme[];
  mitgliedId: string;
  jetzt: Date;
}): TeilnahmeErgebnis {
  const { aktion, sitzung, mitgliedId, jetzt } = args;
  const eigene = args.teilnahmen.find(
    (t) => t.sitzungId === sitzung.id && t.mitgliedId === mitgliedId,
  );
  const aktiv = eigene && !eigene.ausgetragenAm ? eigene : undefined;
  const begonnen = sitzung.start.getTime() <= jetzt.getTime();

  switch (aktion) {
    case "eintragen":
      if (sitzung.abgesagt) return { ok: false, grund: "abgesagt" };
      if (begonnen) return { ok: false, grund: "vergangen" };
      if (aktiv) return { ok: true, aenderung: { art: "keine" } };
      if (eigene) {
        return {
          ok: true,
          aenderung: {
            art: "aktualisieren",
            id: eigene.id,
            daten: { eingetragenAm: jetzt, ausgetragenAm: null, nichtTeilgenommen: false },
          },
        };
      }
      return {
        ok: true,
        aenderung: {
          art: "anlegen",
          daten: {
            sitzungId: sitzung.id,
            mitgliedId,
            eingetragenAm: jetzt,
            ausgetragenAm: null,
            nichtTeilgenommen: false,
          },
        },
      };

    case "austragen":
      if (begonnen) return { ok: false, grund: "vergangen" };
      if (!aktiv) return { ok: true, aenderung: { art: "keine" } };
      return {
        ok: true,
        aenderung: { art: "aktualisieren", id: aktiv.id, daten: { ausgetragenAm: jetzt } },
      };

    case "dabei-gewesen":
      // Nachträglich eintragen: für Sitzungen, die schon stattgefunden haben
      if (sitzung.abgesagt) return { ok: false, grund: "abgesagt" };
      if (!begonnen) return { ok: false, grund: "nicht-vorbei" };
      if (aktiv && !aktiv.nichtTeilgenommen) return { ok: true, aenderung: { art: "keine" } };
      if (aktiv) {
        return { ok: true, aenderung: { art: "aktualisieren", id: aktiv.id, daten: { nichtTeilgenommen: false } } };
      }
      if (eigene) {
        return {
          ok: true,
          aenderung: {
            art: "aktualisieren",
            id: eigene.id,
            daten: { eingetragenAm: jetzt, ausgetragenAm: null, nichtTeilgenommen: false },
          },
        };
      }
      return {
        ok: true,
        aenderung: {
          art: "anlegen",
          daten: { sitzungId: sitzung.id, mitgliedId, eingetragenAm: jetzt, ausgetragenAm: null, nichtTeilgenommen: false },
        },
      };

    case "nicht-teilgenommen":
      if (!aktiv) return { ok: false, grund: "nicht-eingetragen" };
      if (!begonnen) return { ok: false, grund: "nicht-vorbei" };
      if (aktiv.nichtTeilgenommen) return { ok: true, aenderung: { art: "keine" } };
      return {
        ok: true,
        aenderung: { art: "aktualisieren", id: aktiv.id, daten: { nichtTeilgenommen: true } },
      };
  }
}
