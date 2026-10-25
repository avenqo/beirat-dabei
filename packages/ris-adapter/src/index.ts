import { KomfaAdapter } from "./komfa.js";
import type { Http } from "./http.js";
import type { RisAdapter } from "./types.js";

export * from "./types.js";
export * from "./http.js";
export * from "./ics.js";
export * from "./komfa.js";
export * from "./abgleich.js";

export const ADAPTER_NAMEN = ["manuell", "komfa"] as const;

/** Erzeugt den Adapter zum Namen aus den Einstellungen. `manuell` hat keinen Abgleich. */
export function adapterErzeugen(name: string, quelle: string, http: Http, zeitzone?: string): RisAdapter | null {
  if (name === "komfa" && quelle) return new KomfaAdapter({ basisUrl: quelle, http, ...(zeitzone ? { zeitzone } : {}) });
  return null;
}
