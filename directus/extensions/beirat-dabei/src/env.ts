/**
 * Directus wandelt Umgebungsvariablen automatisch um: Werte mit Komma werden zu Listen,
 * Zahlen zu Zahlen. Cron-Ausdrücke wie "15 6,12,18 * * *" kämen sonst als Liste an.
 * Diese Funktion liefert immer den ursprünglichen Text zurück.
 */
export function envText(wert: unknown): string | undefined {
  if (wert === undefined || wert === null || wert === "") return undefined;
  if (Array.isArray(wert)) return wert.join(",");
  return String(wert);
}

export function envZahl(wert: unknown, standard: number): number {
  const t = envText(wert);
  const n = t === undefined ? NaN : Number(t);
  return Number.isFinite(n) ? n : standard;
}
