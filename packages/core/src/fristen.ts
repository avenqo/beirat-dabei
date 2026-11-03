const MS_PRO_TAG = 86_400_000;

/** Nummer des Kalendertags in der angegebenen Zeitzone (Tage seit 1970-01-01). */
export function kalendertag(datum: Date, zeitzone: string): number {
  const teile = new Intl.DateTimeFormat("en-CA", {
    timeZone: zeitzone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(datum);
  const wert = (typ: string) => Number(teile.find((t) => t.type === typ)?.value);
  return Date.UTC(wert("year"), wert("month") - 1, wert("day")) / MS_PRO_TAG;
}

/** Kalendertage von `von` bis `bis`. Positiv, wenn `bis` später liegt. */
export function tageZwischen(von: Date, bis: Date, zeitzone: string): number {
  return kalendertag(bis, zeitzone) - kalendertag(von, zeitzone);
}
