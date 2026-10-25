#!/usr/bin/env node
// Entwicklungsserver: liefert das Dashboard unter /dashboard/ aus und reicht alles andere
// an Directus weiter. So laufen Dashboard und API über dieselbe Adresse, wie im Betrieb mit Caddy.
//
//   DIRECTUS_URL=http://localhost:8055 PORT=8056 node scripts/dev-proxy.mjs

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = fileURLToPath(new URL("../dashboard", import.meta.url));
const ziel = new URL(process.env.DIRECTUS_URL ?? "http://localhost:8055");
const port = Number(process.env.PORT ?? 8056);
const typen = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

http
  .createServer(async (req, res) => {
    const pfad = new URL(req.url, "http://x").pathname;
    if (pfad === "/dashboard") {
      res.writeHead(302, { location: "/dashboard/" }).end();
      return;
    }
    if (pfad.startsWith("/dashboard/")) {
      const relativ = pfad.slice("/dashboard/".length);
      const datei = normalize(join(wurzel, relativ === "" || relativ.endsWith("/") ? `${relativ}index.html` : relativ));
      if (!datei.startsWith(wurzel + sep)) return void res.writeHead(403).end();
      try {
        const inhalt = await readFile(datei);
        res.writeHead(200, { "content-type": typen[extname(datei)] ?? "application/octet-stream", "cache-control": "no-store" });
        res.end(inhalt);
      } catch {
        res.writeHead(404).end("nicht gefunden");
      }
      return;
    }
    const weiter = http.request(
      { host: ziel.hostname, port: ziel.port, path: req.url, method: req.method, headers: { ...req.headers, host: ziel.host } },
      (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(res);
      },
    );
    weiter.on("error", () => res.writeHead(502).end("Directus nicht erreichbar"));
    req.pipe(weiter);
  })
  .listen(port, () => console.log(`Dashboard: http://localhost:${port}/dashboard/  (Directus: ${ziel.origin})`));
