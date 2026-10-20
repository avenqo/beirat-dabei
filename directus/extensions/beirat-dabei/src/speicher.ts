import type { Notizfrage, SitzungInfo, Teilnahme } from "@beirat-dabei/core";
import type { Speicher } from "./handlers.js";

// Minimale Sicht auf den Endpoint-Kontext von Directus; die Typen des SDKs sind für
// die Services bewusst offen gehalten.
interface Dienst {
  readByQuery(query: Record<string, unknown>): Promise<Record<string, any>[]>;
  readSingleton(query: Record<string, unknown>): Promise<Record<string, any>>;
  createOne(daten: Record<string, unknown>): Promise<unknown>;
  updateOne(id: string, daten: Record<string, unknown>): Promise<unknown>;
}

export interface Kontext {
  services: { ItemsService: new (sammlung: string, optionen: Record<string, unknown>) => Dienst };
  getSchema(): Promise<unknown>;
}

const datum = (v: unknown): Date | null => (v ? new Date(v as string) : null);

/**
 * Directus-Anbindung. Läuft ohne `accountability`, also mit voller Berechtigung:
 * Wer was darf, prüfen die Handler im Code (Directus 12 Core kennt keine eigenen Regeln).
 */
export function speicherAusDirectus(
  kontext: Kontext,
  rollen: { mitglied: string; admin: string },
): Speicher {
  const dienst = async (sammlung: string): Promise<Dienst> =>
    new kontext.services.ItemsService(sammlung, { schema: await kontext.getSchema(), accountability: null });

  const teilnahmeAusZeile = (z: Record<string, any>): Teilnahme => ({
    id: z["id"],
    sitzungId: z["sitzung"],
    mitgliedId: z["mitglied"],
    eingetragenAm: datum(z["eingetragen_am"]) ?? new Date(0),
    ausgetragenAm: datum(z["ausgetragen_am"]),
    nichtTeilgenommen: Boolean(z["nicht_teilgenommen"]),
  });

  const sitzungAusZeile = (z: Record<string, any>): SitzungInfo => ({
    id: z["id"],
    gremiumId: z["gremium"]?.id ?? "",
    gremiumName: z["gremium"]?.name ?? "",
    start: new Date(z["beginn"]),
    abgesagt: Boolean(z["abgesagt"]),
    toVeroeffentlicht: Boolean(z["to_veroeffentlicht"]),
    verschobenVon: datum(z["verschoben_von"]),
    ...(z["ort"] ? { ort: z["ort"] } : {}),
    ...(z["ris_link"] ? { risLink: z["ris_link"] } : {}),
    ...(z["to_link"] ? { toLink: z["to_link"] } : {}),
  });

  const SITZUNG_FELDER = ["*", "gremium.id", "gremium.name"];

  return {
    async einstellungen() {
      const e = await (await dienst("einstellungen")).readSingleton({ fields: ["*"] });
      return {
        einstellungen: {
          fristVorTage: e["frist_vor_tage"] ?? 7,
          fristNachTage: e["frist_nach_tage"] ?? 3,
          zeitzone: e["zeitzone"] ?? "Europe/Berlin",
        },
        notizfragen: (Array.isArray(e["notizfragen"]) ? e["notizfragen"] : []) as Notizfrage[],
      };
    },

    async mitglieder() {
      const rollenZeilen = await (await dienst("directus_roles")).readByQuery({
        filter: { name: { _in: [rollen.mitglied, rollen.admin] } },
        fields: ["id"],
        limit: -1,
      });
      const ids = rollenZeilen.map((r) => r["id"]);
      if (ids.length === 0) return [];
      const nutzer = await (await dienst("directus_users")).readByQuery({
        filter: { role: { _in: ids } },
        fields: ["id", "first_name", "last_name", "status"],
        limit: -1,
      });
      return nutzer.map((n) => ({
        id: n["id"],
        aktiv: n["status"] === "active",
        name: [n["first_name"], n["last_name"]].filter(Boolean).join(" ") || "Mitglied",
      }));
    },

    async sitzungen() {
      const zeilen = await (await dienst("sitzungen")).readByQuery({ fields: SITZUNG_FELDER, sort: ["beginn"], limit: -1 });
      return zeilen.map(sitzungAusZeile);
    },

    async sitzung(id) {
      const zeilen = await (await dienst("sitzungen")).readByQuery({
        fields: SITZUNG_FELDER,
        filter: { id: { _eq: id } },
        limit: 1,
      });
      return zeilen[0] ? sitzungAusZeile(zeilen[0]) : null;
    },

    async teilnahmen(sitzungId) {
      const zeilen = await (await dienst("teilnahmen")).readByQuery({
        fields: ["*"],
        ...(sitzungId ? { filter: { sitzung: { _eq: sitzungId } } } : {}),
        limit: -1,
      });
      return zeilen.map(teilnahmeAusZeile);
    },

    async teilnahmeAnlegen(d) {
      await (await dienst("teilnahmen")).createOne({
        sitzung: d.sitzungId,
        mitglied: d.mitgliedId,
        eingetragen_am: d.eingetragenAm.toISOString(),
        ausgetragen_am: null,
        nicht_teilgenommen: false,
      });
    },

    async teilnahmeAendern(id, d) {
      const daten: Record<string, unknown> = {};
      if (d.eingetragenAm !== undefined) daten["eingetragen_am"] = d.eingetragenAm.toISOString();
      if (d.ausgetragenAm !== undefined) daten["ausgetragen_am"] = d.ausgetragenAm ? d.ausgetragenAm.toISOString() : null;
      if (d.nichtTeilgenommen !== undefined) daten["nicht_teilgenommen"] = d.nichtTeilgenommen;
      await (await dienst("teilnahmen")).updateOne(id, daten);
    },

    async notizen() {
      const zeilen = await (await dienst("notizen")).readByQuery({ fields: ["*"], limit: -1 });
      return zeilen.map((z) => ({
        sitzungId: z["sitzung"],
        relevant: Boolean(z["relevant"]),
        antworten: (z["antworten"] ?? {}) as Record<string, string>,
      }));
    },

    async notizSpeichern(sitzungId, wert) {
      const notizen = await dienst("notizen");
      const vorhanden = await notizen.readByQuery({ fields: ["id"], filter: { sitzung: { _eq: sitzungId } }, limit: 1 });
      const daten = { relevant: wert.relevant, antworten: wert.antworten };
      if (vorhanden[0]) await notizen.updateOne(vorhanden[0]["id"], daten);
      else await notizen.createOne({ sitzung: sitzungId, ...daten });
    },
  };
}
