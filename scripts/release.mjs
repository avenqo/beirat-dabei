#!/usr/bin/env node
// Neue Version herausgeben: Versionsnummer in app/package.json erhöhen, Commit und Tag anlegen.
//
//   pnpm release patch    0.2.0 -> 0.2.1  (Fehlerbehebungen)
//   pnpm release minor    0.2.0 -> 0.3.0  (neue Funktionen)
//   pnpm release major    0.2.0 -> 1.0.0  (grundlegende Änderungen)
//   pnpm release 0.4.0    feste Nummer
//
// Veröffentlicht wird danach mit: git push --follow-tags
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const paketDatei = path.join(wurzel, "app/package.json");
const git = (...args) => execFileSync("git", args, { cwd: wurzel, encoding: "utf8" }).trim();
const fehler = (text) => {
  console.error(`Fehler: ${text}`);
  process.exit(1);
};

const art = process.argv[2];
if (!art) fehler("Bitte angeben: patch, minor, major oder eine Nummer wie 0.4.0");

if (git("status", "--porcelain") !== "") fehler("Es gibt nicht committete Änderungen. Erst committen, dann die Version herausgeben.");

const text = readFileSync(paketDatei, "utf8");
const alt = JSON.parse(text).version;
const teile = /^(\d+)\.(\d+)\.(\d+)$/.exec(alt);
if (!teile) fehler(`Unerwartete Versionsnummer in app/package.json: ${alt}`);
let [major, minor, patch] = teile.slice(1).map(Number);

let neu;
if (art === "patch") neu = `${major}.${minor}.${patch + 1}`;
else if (art === "minor") neu = `${major}.${minor + 1}.0`;
else if (art === "major") neu = `${major + 1}.0.0`;
else if (/^\d+\.\d+\.\d+$/.test(art)) neu = art;
else fehler(`Unbekannte Angabe: ${art}`);

const tag = `v${neu}`;
if (git("tag", "--list", tag) !== "") fehler(`Den Tag ${tag} gibt es schon.`);

// Nur die Versionszeile ersetzen, damit die übrige Formatierung bleibt
writeFileSync(paketDatei, text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${neu}$2`));
git("add", "app/package.json");
git("commit", "-m", `Version ${neu}`);
git("tag", "-a", tag, "-m", `Version ${neu}`);

const zweig = git("rev-parse", "--abbrev-ref", "HEAD");
console.log(`Version ${alt} -> ${neu}, Tag ${tag} auf ${zweig} angelegt.`);
console.log("Veröffentlichen: git push --follow-tags");
console.log("Auf dem Server: scripts/deploy.sh");
