import { defineHook } from "@directus/extensions-sdk";
import { speicherAusDirectus, type Kontext } from "./speicher.js";
import { regellaufAusfuehren, type Modus } from "./regellauf.js";

export default defineHook(({ schedule, action }, context) => {
  const env = context.env as Record<string, string | undefined>;
  const modus = (env["REGELN_MODUS"] ?? "trocken") as Modus;
  if (modus === "aus") {
    context.logger.info("beirat-dabei: Regellauf ist ausgeschaltet (REGELN_MODUS=aus).");
    return;
  }
  const geheimnis = env["MAGIC_LINK_SECRET"];
  const publicUrl = env["PUBLIC_URL"];
  if (!geheimnis || !publicUrl) throw new Error("MAGIC_LINK_SECRET und PUBLIC_URL müssen gesetzt sein.");

  const speicher = speicherAusDirectus(context as unknown as Kontext, {
    mitglied: env["ROLLE_MITGLIED"] ?? "mitglied",
    admin: env["ROLLE_ADMIN"] ?? "admin",
  });

  const mailer = {
    async senden({ an, betreff, text, html }: { an: string; betreff: string; text: string; html: string }) {
      const { MailService } = context.services as any;
      const mail = new MailService({ schema: await context.getSchema(), accountability: null });
      await mail.send({ to: an, subject: betreff, text, html });
    },
  };

  const lauf = () =>
    regellaufAusfuehren({
      speicher,
      mailer,
      jetzt: () => new Date(),
      modus,
      mail: {
        dashboardUrl: (env["DASHBOARD_URL"] || `${publicUrl.replace(/\/$/, "")}/dashboard`).replace(/\/$/, ""),
        geheimnis,
        nachlaufTage: Number(env["MAGIC_LINK_NACHLAUF_TAGE"] ?? 14),
        dauerStunden: Number(env["SITZUNGSDAUER_STUNDEN"] ?? 3),
      },
      log: {
        info: (m) => context.logger.info(`beirat-dabei: ${m}`),
        error: (e, m) => context.logger.error(e, `beirat-dabei: ${m}`),
      },
    }).catch((e) => context.logger.error(e, "beirat-dabei: Regellauf fehlgeschlagen"));

  // Einmal täglich am Morgen (Zeitzone des Servers, siehe TZ)
  schedule(env["REGELN_CRON"] || "0 7 * * *", lauf);

  // Zusätzlich kurz nach Änderungen an Teilnahmen, damit R2 und R4 nicht bis zum nächsten Morgen warten.
  let timer: NodeJS.Timeout | undefined;
  const bald = () => {
    clearTimeout(timer);
    timer = setTimeout(lauf, 10_000);
  };
  action("teilnahmen.items.create", bald);
  action("teilnahmen.items.update", bald);
});
