#!/usr/bin/env node
// Überträgt die Startkonfiguration einer Instanz (instanz.yaml) nach Directus.
//
//   node scripts/instanz-anwenden.mjs [--trocken] [--yes] examples/kremmen/instanz.yaml
//
// Zugang über Umgebungsvariablen: DIRECTUS_URL (Standard http://localhost:8055),
// ADMIN_EMAIL und ADMIN_PASSWORD. Voraussetzung: scripts/schema-anwenden.mjs ist gelaufen
// und `pnpm -r build` ebenfalls.
//
// Das Skript zeigt zuerst, was sich ändern würde, und fragt nach (außer mit --yes).
// Mit --trocken wird nur angezeigt. Es löscht nie etwas: Gremien, die nicht in der Datei
// stehen, bleiben unberührt. Nach der ersten Einrichtung ist Directus maßgeblich. Ein
// erneutes Ausführen überschreibt dort geänderte Werte wieder, deshalb die Rückfrage.

import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

const args = process.argv.slice(2);
const trocken = args.includes("--trocken");
const ja = args.includes("--yes") || args.includes("-y");
const dateien = args.filter((a) => !a.startsWith("-"));
if (args.includes("-h") || args.includes("--help") || dateien.length !== 1) {
  console.log("Aufruf: node scripts/instanz-anwenden.mjs [--trocken] [--yes] <instanz.yaml>");
  process.exit(args.includes("-h") || args.includes("--help") ? 0 : 1);
}

const beenden = (text) => {
  console.error(`Fehler: ${text}`);
  process.exit(1);
};

let lib;
try {
  lib = await import("../packages/instanz/dist/index.js");
} catch {
  beenden("Das Paket ist nicht gebaut. Bitte zuerst `pnpm install` und `pnpm -r build` ausführen.");
}

let yamlText;
try {
  yamlText = await readFile(dateien[0], "utf8");
} catch {
  beenden(`Datei nicht lesbar: ${dateien[0]}`);
}
const gelesen = lib.instanzLesen(yamlText);
if (!gelesen.ok) {
  console.error(`Die Datei ${dateien[0]} hat Fehler:`);
  for (const f of gelesen.fehler) console.error(`  - ${f}`);
  process.exit(1);
}
const instanz = gelesen.instanz;

const url = (process.env.DIRECTUS_URL ?? "http://localhost:8055").replace(/\/$/, "");
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) beenden("ADMIN_EMAIL und ADMIN_PASSWORD müssen gesetzt sein.");

let token = "";
async function api(methode, pfad, body) {
  let res;
  try {
    res = await fetch(url + pfad, {
      method: methode,
      headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    beenden(`Directus ist unter ${url} nicht erreichbar.`);
  }
  const text = await res.text();
  if (!res.ok) {
    const e = new Error(`${methode} ${pfad} -> ${res.status} ${text}`);
    e.status = res.status;
    throw e;
  }
  return text ? JSON.parse(text).data : null;
}

try {
  token = (await api("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).access_token;
} catch {
  beenden("Anmeldung bei Directus fehlgeschlagen (ADMIN_EMAIL und ADMIN_PASSWORD prüfen).");
}

// Rollen müssen schon existieren (sie legt scripts/schema-anwenden.mjs mit ROLLE_MITGLIED und ROLLE_ADMIN an)
for (const [art, name] of Object.entries(instanz.rollen)) {
  const treffer = await api("GET", `/roles?filter[name][_eq]=${encodeURIComponent(name)}`);
  if (!treffer?.length) {
    beenden(
      `Die Rolle „${name}“ (${art}) gibt es in Directus nicht. Führe zuerst scripts/schema-anwenden.mjs aus, mit ` +
        `ROLLE_MITGLIED=${instanz.rollen.mitglied} und ROLLE_ADMIN=${instanz.rollen.admin}.`,
    );
  }
}
for (const [art, env] of [["mitglied", "ROLLE_MITGLIED"], ["admin", "ROLLE_ADMIN"]]) {
  if (process.env[env] && process.env[env] !== instanz.rollen[art]) {
    console.warn(`Hinweis: ${env}=${process.env[env]} in der Umgebung weicht von rollen.${art}=${instanz.rollen[art]} in der Datei ab.`);
  }
}

let istEinstellungen;
let istGremien;
try {
  istEinstellungen = await api("GET", "/items/einstellungen");
  istGremien = await api("GET", "/items/gremien?limit=-1&fields=id,name,ris_kennung,aktiv");
} catch (e) {
  if (e.status === 403 || e.status === 404) beenden("Das Datenmodell fehlt. Führe zuerst scripts/schema-anwenden.mjs aus.");
  throw e;
}

const plan = lib.planen(instanz, istEinstellungen ?? {}, istGremien ?? []);

const zeige = (w) => {
  if (w === null || w === undefined || w === "") return "(leer)";
  if (Array.isArray(w)) return `${w.length} Einträge`;
  return String(w);
};
const aenderung = (a) => `    ${a.feld}: ${zeige(a.alt)} → ${zeige(a.neu)}`;

console.log(`Instanz „${instanz.name}“ → ${url}\n`);
if (lib.planLeer(plan)) {
  console.log("Nichts zu tun: Directus entspricht schon der Datei.");
} else {
  if (plan.einstellungen.length) {
    console.log("Einstellungen:");
    for (const a of plan.einstellungen) console.log(aenderung(a));
  }
  for (const g of plan.gremien) {
    if (g.art === "anlegen") console.log(`Gremium neu: ${g.name}`);
    else {
      console.log(`Gremium ändern: ${g.name}`);
      for (const a of g.aenderungen) console.log(aenderung(a));
    }
  }
}
if (plan.unbekannteGremien.length) {
  console.log(`\nIn Directus, aber nicht in der Datei (bleiben unberührt): ${plan.unbekannteGremien.join(", ")}`);
}

if (lib.planLeer(plan) || trocken) {
  if (trocken && !lib.planLeer(plan)) console.log("\nTrockenlauf: es wurde nichts geändert.");
  process.exit(0);
}

if (!ja) {
  if (!process.stdin.isTTY) beenden("Keine Eingabe möglich, bitte --yes angeben.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let antwort = "";
  try {
    antwort = await rl.question("\nSo übernehmen? [j/N] ");
  } catch {
    /* Eingabe wurde geschlossen: gilt als Nein */
  }
  rl.close();
  if (!/^(j|ja)$/i.test(antwort.trim())) {
    console.log("Abgebrochen.");
    process.exit(1);
  }
}

if (plan.einstellungen.length) {
  await api("PATCH", "/items/einstellungen", Object.fromEntries(plan.einstellungen.map((a) => [a.feld, a.neu])));
}
for (const g of plan.gremien) {
  if (g.art === "anlegen") await api("POST", "/items/gremien", g.daten);
  else await api("PATCH", `/items/gremien/${g.id}`, g.daten);
}
console.log("\nFertig. Ab jetzt pflegt ihr alles in der Verwaltung (siehe docs/Betrieb.md).");
