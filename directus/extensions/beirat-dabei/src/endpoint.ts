import { defineEndpoint } from "@directus/extensions-sdk";
import * as h from "./handlers.js";
import * as o from "./oeffentlich.js";
import { envText, envZahl } from "./env.js";
import { speicherAusDirectus, type Kontext } from "./speicher.js";

export default defineEndpoint({
  id: "beirat-dabei",
  handler: (router, context) => {
    const env = context.env as Record<string, string | undefined>;
    const geheimnis = envText(env["MAGIC_LINK_SECRET"]);
    if (!geheimnis) throw new Error("MAGIC_LINK_SECRET ist nicht gesetzt.");

    const d: h.Abhaengigkeiten = {
      speicher: speicherAusDirectus(context as unknown as Kontext, {
        mitglied: envText(env["ROLLE_MITGLIED"]) ?? "mitglied",
        admin: envText(env["ROLLE_ADMIN"]) ?? "admin",
      }),
      geheimnis,
      jetzt: () => new Date(),
      publicUrl: envText(env["PUBLIC_URL"]) ?? "",
      sitzungsdauerStunden: envZahl(env["SITZUNGSDAUER_STUNDEN"], 3),
    };

    // Kleine Hülle: Handler aufrufen, Antwort schreiben, Ausnahmen als 500 melden.
    const route =
      (fn: (req: any) => Promise<h.Antwort>) =>
      async (req: any, res: any) => {
        try {
          const a = await fn(req);
          for (const [k, v] of Object.entries(a.kopf ?? {})) res.setHeader(k, v);
          if (a.datei) return senden(res, a.datei);
          if (a.typ) res.status(a.status).type(a.typ).send(a.body);
          else res.status(a.status).json(a.body);
        } catch (e) {
          context.logger.error(e, "beirat-dabei");
          res.status(500).json({ fehler: "serverfehler" });
        }
      };
    const nutzer = (req: any): string | null => req.accountability?.user ?? null;

    // Dateien: nur PDF und gängige Bilder werden im Browser angezeigt, alles andere als Download
    const ANZEIGBAR = new Set(["application/pdf", "image/png", "image/jpeg"]);
    const senden = (res: any, datei: h.DateiStrom) => {
      const sicherer = datei.name.replace(/[^\w.\-]+/g, "_");
      const art = ANZEIGBAR.has(datei.typ) ? "inline" : "attachment";
      res.status(200);
      res.setHeader("Content-Type", datei.typ);
      res.setHeader("Content-Disposition", `${art}; filename="${sicherer}"; filename*=UTF-8''${encodeURIComponent(datei.name)}`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=300");
      if (datei.groesse) res.setHeader("Content-Length", String(datei.groesse));
      datei.stream.on("error", () => res.destroy());
      datei.stream.pipe(res);
    };
    const od: o.OeffentlichAbhaengigkeiten = d as o.OeffentlichAbhaengigkeiten;

    // Mit Directus-Anmeldung
    router.get("/dashboard", route((req) => h.dashboard(d, nutzer(req))));
    router.post("/teilnahme", route((req) => h.teilnahme(d, nutzer(req), req.body ?? {})));
    router.post("/notiz/loeschen", route((req) => h.notizLoeschen(d, nutzer(req), req.body ?? {})));
    router.get("/abo", route((req) => h.abo(d, nutzer(req))));
    router.post("/notiz", route((req) => h.notiz(d, nutzer(req), req.body ?? {})));

    // Öffentlich, ohne Anmeldung: Name, Termine, veröffentlichte Unterlagen
    router.get("/instanz", route(() => o.instanz(od)));
    router.get("/oeffentlich", route(() => o.oeffentlich(od)));
    router.get("/datei/:id", route((req) => o.datei(od, req.params.id)));

    // Öffentlich, durch signierten Token geschützt
    router.get("/ical/:token", route((req) => h.ical(d, req.params.token)));
    router.get("/link/:token", route((req) => h.linkInfo(d, req.params.token)));
    router.post("/link/:token", route((req) => h.linkBestaetigen(d, req.params.token, req.body ?? {})));
  },
});
