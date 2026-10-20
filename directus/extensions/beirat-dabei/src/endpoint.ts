import { defineEndpoint } from "@directus/extensions-sdk";
import * as h from "./handlers.js";
import { envText } from "./env.js";
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
    };

    // Kleine Hülle: Handler aufrufen, Antwort schreiben, Ausnahmen als 500 melden.
    const route =
      (fn: (req: any) => Promise<h.Antwort>) =>
      async (req: any, res: any) => {
        try {
          const a = await fn(req);
          res.status(a.status).json(a.body);
        } catch (e) {
          context.logger.error(e, "beirat-dabei");
          res.status(500).json({ fehler: "serverfehler" });
        }
      };
    const nutzer = (req: any): string | null => req.accountability?.user ?? null;

    // Mit Directus-Anmeldung
    router.get("/dashboard", route((req) => h.dashboard(d, nutzer(req))));
    router.post("/teilnahme", route((req) => h.teilnahme(d, nutzer(req), req.body ?? {})));
    router.post("/notiz", route((req) => h.notiz(d, nutzer(req), req.body ?? {})));

    // Öffentlich, durch signierten Token geschützt
    router.get("/link/:token", route((req) => h.linkInfo(d, req.params.token)));
    router.post("/link/:token", route((req) => h.linkBestaetigen(d, req.params.token, req.body ?? {})));
  },
});
