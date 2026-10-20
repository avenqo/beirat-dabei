export interface RisSitzung {
  /** Kennung der Sitzung im RIS */
  risId: string;
  /** Name des Gremiums, wie es das RIS anzeigt */
  gremium: string;
  start: Date;
  ende: Date | null;
  ort: string | null;
  /** Seite der Sitzung im RIS */
  risLink: string;
  abgesagt: boolean;
}

export interface RisTop {
  nummer: string;
  titel: string;
  /** Nummer der Beschlussvorlage, falls vorhanden */
  vorlage: string | null;
}

export interface RisTagesordnung {
  /** Tagesordnung liegt vor: TOPs vorhanden oder Einladung zum Download */
  veroeffentlicht: boolean;
  link: string;
  tops: RisTop[];
  abgesagt: boolean;
}

export interface Zeitraum {
  von: Date;
  bis: Date;
}

export interface SitzungenErgebnis {
  sitzungen: RisSitzung[];
  /**
   * Alle Abrufe waren erfolgreich. Nur dann darf der Abgleich aus dem Fehlen einer
   * Sitzung auf eine Absage schließen.
   */
  vollstaendig: boolean;
}

/** Die Schnittstelle, die der Kern von einem RIS-Adapter erwartet. */
export interface RisAdapter {
  sitzungen(gremium: string, zeitraum: Zeitraum): Promise<SitzungenErgebnis>;
  tagesordnung(risId: string): Promise<RisTagesordnung>;
}
