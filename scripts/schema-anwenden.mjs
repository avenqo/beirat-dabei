#!/usr/bin/env node
// Legt Datenmodell, Rollen und Berechtigungen in Directus an. Idempotent:
// mehrfaches Ausführen ergänzt Fehlendes und setzt die Berechtigungen neu.
//
//   DIRECTUS_URL=http://localhost:8055 ADMIN_EMAIL=… ADMIN_PASSWORD=… \
//   ROLLE_MITGLIED=ub ROLLE_ADMIN=ub-admin node scripts/schema-anwenden.mjs

const url = (process.env.DIRECTUS_URL ?? "http://localhost:8055").replace(/\/$/, "");
const rolleMitglied = process.env.ROLLE_MITGLIED ?? "mitglied";
const rolleAdmin = process.env.ROLLE_ADMIN ?? "admin";
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("ADMIN_EMAIL und ADMIN_PASSWORD müssen gesetzt sein.");
  process.exit(1);
}

let token = "";
async function api(method, pfad, body, { erlaube404 = false } = {}) {
  const res = await fetch(url + pfad, {
    method,
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (erlaube404 && (res.status === 404 || res.status === 403)) return null; // Directus meldet unbekannte Collections als 403
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${pfad} -> ${res.status} ${text}`);
  return text ? JSON.parse(text).data : null;
}

// --- Felder ---------------------------------------------------------------

const text = (field, meta = {}, schema = {}) => ({
  field, type: "string", meta: { interface: "input", ...meta }, schema,
});
const bool = (field, standard = false, meta = {}) => ({
  field, type: "boolean", meta: { interface: "boolean", ...meta }, schema: { default_value: standard },
});
const zahl = (field, standard, meta = {}) => ({
  field, type: "integer", meta: { interface: "input", ...meta }, schema: { default_value: standard },
});
const zeit = (field, meta = {}) => ({
  field, type: "timestamp", meta: { interface: "datetime", ...meta }, schema: {},
});
const json = (field, meta = {}) => ({ field, type: "json", meta: { interface: "input-code", options: { language: "json" }, ...meta }, schema: {} });
const bezug = (field, meta = {}, schema = {}) => ({
  field, type: "uuid", meta: { interface: "select-dropdown-m2o", special: ["m2o"], ...meta }, schema,
});

const id = { field: "id", type: "uuid", meta: { hidden: true, readonly: true, special: ["uuid"] }, schema: { is_primary_key: true } };

const sammlungen = [
  {
    collection: "einstellungen",
    meta: { singleton: true, icon: "settings", note: "Einstellungen dieser Instanz" },
    felder: [
      id,
      text("name", { note: "Anzeigename, z. B. Umweltbeirat Kremmen" }),
      text("absender_email", { note: "Absenderadresse der Benachrichtigungen" }),
      zahl("frist_vor_tage", 7, { note: "Tage vor der Sitzung (Regeln 3 und 4)" }),
      zahl("frist_nach_tage", 3, { note: "Tage nach der Sitzung (Regel 5)" }),
      text("zeitzone", {}, { default_value: "Europe/Berlin" }),
      json("notizfragen", { note: "Liste von {schluessel, frage, pflicht, typ}" }),
      text("themenfokus", { note: "Für die optionale KI-Vorsortierung" }),
      text("ris_adapter", {
        interface: "select-dropdown",
        options: { choices: ["manuell", "komfa", "oparl", "ical"].map((v) => ({ text: v, value: v })) },
      }, { default_value: "manuell" }),
      text("ris_quelle", { note: "Adresse des RIS, z. B. https://ris-kremmen.komfa.de" }),
    ],
  },
  {
    collection: "gremien",
    meta: { icon: "groups", note: "Begleitete Gremien", display_template: "{{name}}" },
    felder: [id, text("name"), text("ris_kennung", { note: "Kennung im Ratsinformationssystem" }), bool("aktiv", true)],
  },
  {
    collection: "sitzungen",
    meta: { icon: "event", display_template: "{{beginn}} {{gremium.name}}", sort_field: null },
    felder: [
      id,
      bezug("gremium", {}, { foreign_key_table: "gremien", foreign_key_column: "id" }),
      zeit("beginn"),
      text("ort"),
      text("ris_id", { note: "Kennung der Sitzung im RIS, für den Abgleich" }, { is_unique: true }),
      text("ris_link", { note: "Link zur Sitzung im RIS" }),
      bool("to_veroeffentlicht"),
      text("to_link", { note: "Link zur Tagesordnung" }),
      bool("abgesagt"),
      zeit("verschoben_von", { note: "Früherer Beginn, gesetzt vom RIS-Abgleich" }),
    ],
  },
  {
    collection: "teilnahmen",
    meta: { icon: "how_to_reg" },
    felder: [
      id,
      bezug("sitzung", {}, { foreign_key_table: "sitzungen", foreign_key_column: "id" }),
      bezug("mitglied", {}, { foreign_key_table: "directus_users", foreign_key_column: "id" }),
      zeit("eingetragen_am"),
      zeit("ausgetragen_am", { note: "Gesetzt, solange die Person ausgetragen ist" }),
      bool("nicht_teilgenommen"),
    ],
  },
  {
    collection: "notizen",
    meta: { icon: "edit_note" },
    felder: [
      id,
      bezug("sitzung", {}, { foreign_key_table: "sitzungen", foreign_key_column: "id", is_unique: true }),
      bool("relevant"),
      json("antworten", { note: "Antworten auf die Notizfragen" }),
      { field: "date_updated", type: "timestamp", meta: { special: ["date-updated"], readonly: true, hidden: true }, schema: {} },
    ],
  },
  {
    collection: "benachrichtigungen",
    meta: { icon: "forward_to_inbox", note: "Versandprotokoll, verhindert doppelte Nachrichten" },
    felder: [
      id,
      text("regel"),
      bezug("sitzung", {}, { foreign_key_table: "sitzungen", foreign_key_column: "id" }),
      bezug("empfaenger", {}, { foreign_key_table: "directus_users", foreign_key_column: "id" }),
      text("bezug"),
      { field: "gesendet_am", type: "timestamp", meta: { special: ["date-created"], readonly: true }, schema: {} },
    ],
  },
];

const relationen = [
  ["sitzungen", "gremium", "gremien"],
  ["teilnahmen", "sitzung", "sitzungen"],
  ["teilnahmen", "mitglied", "directus_users"],
  ["notizen", "sitzung", "sitzungen"],
  ["benachrichtigungen", "sitzung", "sitzungen"],
  ["benachrichtigungen", "empfaenger", "directus_users"],
];

async function sammlungenAnlegen() {
  for (const s of sammlungen) {
    const vorhanden = await api("GET", `/collections/${s.collection}`, undefined, { erlaube404: true });
    if (!vorhanden) {
      await api("POST", "/collections", {
        collection: s.collection,
        meta: s.meta,
        schema: {},
        fields: s.felder.map(({ schema, ...f }) => ({ ...f, schema: { ...schema, foreign_key_table: undefined, foreign_key_column: undefined } })),
      });
      console.log(`+ Collection ${s.collection}`);
      continue;
    }
    const felder = await api("GET", `/fields/${s.collection}`);
    const bekannt = new Set(felder.map((f) => f.field));
    for (const f of s.felder.filter((f) => !bekannt.has(f.field))) {
      await api("POST", `/fields/${s.collection}`, { ...f, schema: { ...f.schema, foreign_key_table: undefined, foreign_key_column: undefined } });
      console.log(`+ Feld ${s.collection}.${f.field}`);
    }
  }
  // Auswahlmöglichkeiten bestehender Felder nachziehen
  const risFeld = sammlungen.find((x) => x.collection === "einstellungen").felder.find((f) => f.field === "ris_adapter");
  await api("PATCH", "/fields/einstellungen/ris_adapter", { meta: { options: risFeld.meta.options } });

  const vorhandene = await api("GET", "/relations");
  for (const [many, feld, one] of relationen) {
    if (vorhandene.some((r) => r.collection === many && r.field === feld)) continue;
    await api("POST", "/relations", { collection: many, field: feld, related_collection: one, schema: { on_delete: "CASCADE" } });
    console.log(`+ Relation ${many}.${feld} -> ${one}`);
  }
}

// --- Rollen und Rechte ----------------------------------------------------

async function rolleAnlegen(name, extra = {}) {
  const rollen = await api("GET", `/roles?filter[name][_eq]=${encodeURIComponent(name)}`);
  if (rollen[0]) return rollen[0];
  const neu = await api("POST", "/roles", { name, icon: "supervised_user_circle", ...extra });
  console.log(`+ Rolle ${name}`);
  return neu;
}

async function richtlinieAnlegen(name, daten) {
  const vorhanden = await api("GET", `/policies?filter[name][_eq]=${encodeURIComponent(name)}`);
  const p = vorhanden[0] ?? (await api("POST", "/policies", { name, ...daten }));
  if (!vorhanden[0]) console.log(`+ Richtlinie ${name}`);
  await api("PATCH", `/policies/${p.id}`, daten);
  return p;
}

async function verknuepfen(rolle, richtlinie) {
  const r = await api("GET", `/roles/${rolle.id}?fields=policies.policy`);
  const haengt = (r.policies ?? []).some((a) => (a.policy?.id ?? a.policy) === richtlinie.id);
  if (!haengt) await api("POST", "/access", { role: rolle.id, policy: richtlinie.id });
}

// Directus 12 (Core-Lizenz) erlaubt keine benutzerdefinierten Berechtigungsregeln:
// keine Feldeinschränkungen, keine Filter wie "nur eigene Einträge", keine Validierung.
// Deshalb bekommen Mitglieder hier nur Lesezugriff auf die Sitzungsdaten. Alle
// Schreibzugriffe (Teilnahme, Notiz) und alles mit Personenbezug (Namen der Mitglieder)
// laufen über die Extension, die das im Code prüft. Vgl. docs/Beirat-dabei-Konzept.md.

function rechteMitglied(policy) {
  return ["einstellungen", "gremien", "sitzungen", "teilnahmen", "notizen"].map((collection) => ({
    policy, collection, action: "read", fields: ["*"],
  }));
}

function rechteAdmin(policy) {
  const alle = (collection, actions = ["create", "read", "update", "delete"]) =>
    actions.map((action) => ({ policy, collection, action, fields: ["*"] }));
  return [
    ...alle("gremien"),
    ...alle("sitzungen"),
    ...alle("teilnahmen"),
    ...alle("notizen"),
    ...alle("einstellungen", ["read", "update"]),
    ...alle("benachrichtigungen", ["read"]),
    ...alle("directus_users", ["create", "read", "update"]),
  ];
}

async function rechteSetzen(policy, rechte) {
  const alt = await api("GET", `/permissions?filter[policy][_eq]=${policy}&limit=-1`);
  for (const a of alt) await api("DELETE", `/permissions/${a.id}`);
  for (const r of rechte) await api("POST", "/permissions", r);
}

async function rollenUndRechte() {
  const mitglied = await rolleAnlegen(rolleMitglied, { description: "Dashboard sehen, eintragen, Notizen schreiben" });
  const admin = await rolleAnlegen(rolleAdmin, { description: "Zusätzlich Mitglieder, Sitzungen und Einstellungen verwalten", parent: mitglied.id });
  if (admin.parent !== mitglied.id) await api("PATCH", `/roles/${admin.id}`, { parent: mitglied.id });

  const pMitglied = await richtlinieAnlegen(`${rolleMitglied}-rechte`, { icon: "badge", admin_access: false, app_access: false });
  const pAdmin = await richtlinieAnlegen(`${rolleAdmin}-rechte`, { icon: "admin_panel_settings", admin_access: false, app_access: true });
  await verknuepfen(mitglied, pMitglied);
  await verknuepfen(admin, pAdmin);
  await rechteSetzen(pMitglied.id, rechteMitglied(pMitglied.id));
  await rechteSetzen(pAdmin.id, rechteAdmin(pAdmin.id));
}

async function einstellungenVorbelegen() {
  const e = await api("GET", "/items/einstellungen");
  if (e && e.id) return;
  await api("PATCH", "/items/einstellungen", {
    name: "Beirat dabei",
    frist_vor_tage: 7,
    frist_nach_tage: 3,
    zeitzone: "Europe/Berlin",
    ris_adapter: "manuell",
    notizfragen: [
      { schluessel: "relevant", frage: "War etwas Relevantes für den Beirat dabei?", typ: "ja-nein", pflicht: true },
      { schluessel: "tops", frage: "Welche TOPs waren umweltrelevant?", typ: "text", pflicht: false },
      { schluessel: "beschluesse", frage: "Was wurde beschlossen oder vertagt, und muss der Beirat etwas tun?", typ: "text", pflicht: false },
    ],
  });
  console.log("+ Einstellungen vorbelegt");
}

const login = await api("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
token = login.access_token;
await sammlungenAnlegen();
await rollenUndRechte();
await einstellungenVorbelegen();
console.log("Fertig.");
