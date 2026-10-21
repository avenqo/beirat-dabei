import type { Notizfrage, SitzungInfo, Teilnahme, Versand } from "@beirat-dabei/core";
import type { BekannteSitzung, NeueSitzung, SitzungsAenderung } from "@beirat-dabei/ris-adapter";
import type { RegelSpeicher } from "./regellauf.js";
import type { AbgleichSpeicher } from "./abgleichlauf.js";
import type { DokumentZeile, OeffentlichSpeicher } from "./oeffentlich.js";

// Minimale Sicht auf den Endpoint-Kontext von Directus; die Typen des SDKs sind für
// die Services bewusst offen gehalten.
interface Dienst {
  readByQuery(query: Record<string, unknown>): Promise<Record<string, any>[]>;
  readSingleton(query: Record<string, unknown>): Promise<Record<string, any>>;
  createOne(daten: Record<string, unknown>): Promise<unknown>;
  updateOne(id: string, daten: Record<string, unknown>): Promise<unknown>;
  deleteOne(id: string): Promise<unknown>;
}

interface AssetDienst {
  getAsset(id: string): Promise<{ stream: NodeJS.ReadableStream; file: Record<string, any> }>;
}

export interface Kontext {
  services: {
    ItemsService: new (sammlung: string, optionen: Record<string, unknown>) => Dienst;
    AssetsService: new (optionen: Record<string, unknown>) => AssetDienst;
  };
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
): RegelSpeicher & AbgleichSpeicher & OeffentlichSpeicher {
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
        ...(e["name"] ? { name: e["name"] as string } : {}),
        aboVersion: Number(e["abo_version"]) || 1,
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

    async empfaenger() {
      const rollenZeilen = await (await dienst("directus_roles")).readByQuery({
        filter: { name: { _in: [rollen.mitglied, rollen.admin] } },
        fields: ["id"],
        limit: -1,
      });
      const ids = rollenZeilen.map((r) => r["id"]);
      if (ids.length === 0) return [];
      const nutzer = await (await dienst("directus_users")).readByQuery({
        filter: { role: { _in: ids } },
        fields: ["id", "first_name", "last_name", "email", "status"],
        limit: -1,
      });
      return nutzer.map((n) => ({
        id: n["id"],
        aktiv: n["status"] === "active",
        name: [n["first_name"], n["last_name"]].filter(Boolean).join(" ") || "Mitglied",
        email: (n["email"] as string) ?? "",
      }));
    },

    async versand(): Promise<Versand[]> {
      const zeilen = await (await dienst("benachrichtigungen")).readByQuery({ fields: ["regel", "sitzung", "empfaenger", "bezug"], limit: -1 });
      return zeilen.map((z) => ({ regel: z["regel"], sitzungId: z["sitzung"], empfaengerId: z["empfaenger"], bezug: z["bezug"] }));
    },

    async versandSchreiben(eintraege) {
      const dienstV = await dienst("benachrichtigungen");
      for (const e of eintraege) {
        await dienstV.createOne({ regel: e.regel, sitzung: e.sitzungId, empfaenger: e.empfaengerId, bezug: e.bezug });
      }
    },

    async risEinstellungen() {
      const e = await (await dienst("einstellungen")).readSingleton({ fields: ["ris_adapter", "ris_quelle", "zeitzone"] });
      return {
        adapter: (e["ris_adapter"] as string) ?? "manuell",
        quelle: (e["ris_quelle"] as string) ?? "",
        ...(e["zeitzone"] ? { zeitzone: e["zeitzone"] as string } : {}),
      };
    },

    async gremien() {
      const zeilen = await (await dienst("gremien")).readByQuery({ fields: ["*"], limit: -1 });
      return zeilen.map((z) => ({
        id: z["id"] as string,
        name: z["name"] as string,
        risKennung: (z["ris_kennung"] as string) ?? "",
        aktiv: Boolean(z["aktiv"]),
      }));
    },

    async sitzungenBekannt(gremiumId): Promise<BekannteSitzung[]> {
      const zeilen = await (await dienst("sitzungen")).readByQuery({
        fields: ["*"],
        filter: { gremium: { _eq: gremiumId } },
        limit: -1,
      });
      return zeilen.map((z) => ({
        id: z["id"],
        risId: z["ris_id"] ?? null,
        start: new Date(z["beginn"]),
        ort: z["ort"] ?? null,
        abgesagt: Boolean(z["abgesagt"]),
        toVeroeffentlicht: Boolean(z["to_veroeffentlicht"]),
        toLink: z["to_link"] ?? null,
        risLink: z["ris_link"] ?? null,
      }));
    },

    async sitzungAnlegen(gremiumId, d: NeueSitzung) {
      await (await dienst("sitzungen")).createOne({
        gremium: gremiumId,
        ris_id: d.risId,
        beginn: d.start.toISOString(),
        ort: d.ort,
        ris_link: d.risLink,
        abgesagt: d.abgesagt,
        to_veroeffentlicht: d.toVeroeffentlicht,
        to_link: d.toLink,
      });
    },

    async sitzungAendern(id, d: Partial<SitzungsAenderung>) {
      const daten: Record<string, unknown> = {};
      if (d.start) daten["beginn"] = d.start.toISOString();
      if (d.verschobenVon) daten["verschoben_von"] = d.verschobenVon.toISOString();
      if (d.ort !== undefined) daten["ort"] = d.ort;
      if (d.risLink !== undefined) daten["ris_link"] = d.risLink;
      if (d.abgesagt !== undefined) daten["abgesagt"] = d.abgesagt;
      if (d.toVeroeffentlicht !== undefined) daten["to_veroeffentlicht"] = d.toVeroeffentlicht;
      if (d.toLink !== undefined) daten["to_link"] = d.toLink;
      await (await dienst("sitzungen")).updateOne(id, daten);
    },

    async logoId() {
      const e = await (await dienst("directus_settings")).readSingleton({ fields: ["project_logo"] });
      return (e["project_logo"] as string | null) ?? null;
    },

    async dokumente(): Promise<DokumentZeile[]> {
      const zeilen = await (await dienst("dokumente")).readByQuery({
        fields: ["id", "titel", "kategorie", "datum", "beschreibung", "veroeffentlicht", "datei.id", "datei.filename_download", "datei.type", "datei.filesize"],
        sort: ["-datum"],
        limit: -1,
      });
      return zeilen.map((z) => ({
        id: z["id"],
        titel: z["titel"] ?? "",
        kategorie: z["kategorie"] ?? "sonstiges",
        datum: z["datum"] ? String(z["datum"]).slice(0, 10) : null,
        beschreibung: z["beschreibung"] ?? null,
        veroeffentlicht: Boolean(z["veroeffentlicht"]),
        hatDatei: Boolean(z["datei"]?.id),
        dateiName: z["datei"]?.filename_download ?? null,
        dateiTyp: z["datei"]?.type ?? null,
        dateiGroesse: z["datei"]?.filesize ? Number(z["datei"].filesize) : null,
      }));
    },

    async dateiVonDokument(dokumentId) {
      const zeilen = await (await dienst("dokumente")).readByQuery({
        fields: ["datei.id"],
        filter: { id: { _eq: dokumentId }, veroeffentlicht: { _eq: true } },
        limit: 1,
      });
      const dateiId = zeilen[0]?.["datei"]?.id as string | undefined;
      if (!dateiId) return null;
      const assets = new kontext.services.AssetsService({ schema: await kontext.getSchema(), accountability: null });
      const { stream, file } = await assets.getAsset(dateiId);
      return {
        stream,
        typ: (file["type"] as string) || "application/octet-stream",
        name: (file["filename_download"] as string) || "datei",
        groesse: file["filesize"] ? Number(file["filesize"]) : null,
      };
    },

    async notizLoeschen(sitzungId) {
      const notizen = await dienst("notizen");
      const vorhanden = await notizen.readByQuery({ fields: ["id"], filter: { sitzung: { _eq: sitzungId } }, limit: -1 });
      for (const n of vorhanden) await notizen.deleteOne(n["id"]);
      return vorhanden.length > 0;
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
