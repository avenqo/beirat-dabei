import { defineHook } from "@directus/extensions-sdk";
import { standardHttp } from "@beirat-dabei/ris-adapter";
import { speicherAusDirectus, type Kontext } from "./speicher.js";
import { regellaufAusfuehren, type Modus } from "./regellauf.js";
import { abgleichAusfuehren } from "./abgleichlauf.js";

export default defineHook(({ schedule, action }, context) => {
  const env = context.env as Record<string, string | undefined>;
  const regelnModus = (env["REGELN_MODUS"] || "trocken") as Modus;
  const risModus = (env["RIS_MODUS"] || "trocken") as Modus;
  const geheimnis = env["MAGIC_LINK_SECRET"];
  const publicUrl = env["PUBLIC_URL"];
  if (!geheimnis || !publicUrl) throw new Error("MAGIC_LINK_SECRET und PUBLIC_URL müssen gesetzt sein.");

  const speicher = speicherAusDirectus(context as unknown as Kontext, {
    mitglied: env["ROLLE_MITGLIED"] ?? "mitglied",
    admin: env["ROLLE_ADMIN"] ?? "admin",
  });
  const log = {
    info: (m: string) => context.logger.info(`beirat-dabei: ${m}`),
    error: (e: unknown, m: string) => context.logger.error(e, `beirat-dabei: ${m}`),
  };

  // --- Benachrichtigungsregeln -------------------------------------------
  const mailer = {
    async senden({ an, betreff, text, html }: { an: string; betreff: string; text: string; html: string }) {
      const { MailService } = context.services as any;
      const mail = new MailService({ schema: await context.getSchema(), accountability: null });
      await mail.send({ to: an, subject: betreff, text, html });
    },
  };

  const regelLauf = () =>
    regellaufAusfuehren({
      speicher,
      mailer,
      jetzt: () => new Date(),
      modus: regelnModus,
      mail: {
        dashboardUrl: (env["DASHBOARD_URL"] || `${publicUrl.replace(/\/$/, "")}/dashboard`).replace(/\/$/, ""),
        geheimnis,
        nachlaufTage: Number(env["MAGIC_LINK_NACHLAUF_TAGE"] ?? 14),
        dauerStunden: Number(env["SITZUNGSDAUER_STUNDEN"] ?? 3),
      },
      log,
    }).catch((e) => log.error(e, "Regellauf fehlgeschlagen"));

  if (regelnModus === "aus") {
    log.info("Regellauf ist ausgeschaltet (REGELN_MODUS=aus).");
  } else {
    // Einmal täglich am Morgen (Zeitzone des Servers, siehe TZ)
    schedule(env["REGELN_CRON"] || "0 7 * * *", regelLauf);

    // Zusätzlich kurz nach Änderungen an Teilnahmen, damit R2 und R4 nicht bis zum nächsten Morgen warten.
    let timer: NodeJS.Timeout | undefined;
    const bald = () => {
      clearTimeout(timer);
      timer = setTimeout(regelLauf, 10_000);
    };
    action("teilnahmen.items.create", bald);
    action("teilnahmen.items.update", bald);
  }

  // --- RIS-Abgleich ------------------------------------------------------
  if (risModus === "aus") {
    log.info("RIS-Abgleich ist ausgeschaltet (RIS_MODUS=aus).");
  } else {
    const http = standardHttp({
      userAgent: env["RIS_USER_AGENT"] || `beirat-dabei/0.1 (+${publicUrl})`,
      pauseMs: Number(env["RIS_PAUSE_MS"] ?? 1000),
    });
    // Wenige Male am Tag. Danach laufen die Regeln, damit neue Tagesordnungen und
    // Absagen nicht bis zum nächsten Morgen warten.
    schedule(env["RIS_CRON"] || "15 6,12,18 * * *", async () => {
      try {
        const r = await abgleichAusfuehren({ speicher, http, jetzt: () => new Date(), modus: risModus, log });
        if (r.angelegt + r.geaendert > 0) await regelLauf();
      } catch (e) {
        log.error(e, "RIS-Abgleich fehlgeschlagen");
      }
    });
  }
});
