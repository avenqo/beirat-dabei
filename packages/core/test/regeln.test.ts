import { describe, expect, it } from "vitest";
import {
  STANDARD_EINSTELLUNGEN,
  faelligeNachrichten,
  sitzungStatus,
  type Sitzung,
  type Teilnahme,
  type Versand,
  type Zustand,
} from "../src/index.js";

const d = (iso: string) => new Date(iso);
const A = { id: "a", aktiv: true };
const B = { id: "b", aktiv: true };
const C = { id: "c", aktiv: true };

// Sitzung am Mi 2026-11-18, 18:00 Uhr Berlin (17:00 UTC)
const sitzung = (extra: Partial<Sitzung> = {}): Sitzung => ({
  id: "s1",
  gremiumId: "g1",
  start: d("2026-11-18T17:00:00Z"),
  abgesagt: false,
  toVeroeffentlicht: false,
  ...extra,
});

const teilnahme = (extra: Partial<Teilnahme> = {}): Teilnahme => ({
  id: "t1",
  sitzungId: "s1",
  mitgliedId: "a",
  eingetragenAm: d("2026-11-01T08:00:00Z"),
  nichtTeilgenommen: false,
  ...extra,
});

const zustand = (extra: Partial<Zustand> = {}): Zustand => ({
  jetzt: d("2026-11-01T06:00:00Z"),
  einstellungen: STANDARD_EINSTELLUNGEN,
  mitglieder: [A, B, C],
  sitzungen: [sitzung()],
  teilnahmen: [],
  notizen: [],
  versand: [],
  ...extra,
});

const regeln = (z: Zustand) => faelligeNachrichten(z).map((n) => n.regeln.join("+"));
const empfaenger = (z: Zustand) => faelligeNachrichten(z).map((n) => n.empfaengerId).sort();
const protokoll = (z: Zustand): Versand[] => faelligeNachrichten(z).flatMap((n) => n.protokoll);

describe("R1 Tagesordnung veröffentlicht", () => {
  it("geht an alle aktiven Mitglieder", () => {
    const z = zustand({
      sitzungen: [sitzung({ toVeroeffentlicht: true })],
      mitglieder: [A, B, { id: "x", aktiv: false }],
    });
    expect(empfaenger(z)).toEqual(["a", "b"]);
    expect(regeln(z)).toEqual(["R1", "R1"]);
  });

  it("geht nicht doppelt raus", () => {
    const z = zustand({ sitzungen: [sitzung({ toVeroeffentlicht: true })] });
    const versand = protokoll(z);
    expect(faelligeNachrichten({ ...z, versand })).toEqual([]);
  });

  it("kommt nicht für vergangene Sitzungen", () => {
    const z = zustand({
      jetzt: d("2026-11-20T06:00:00Z"),
      sitzungen: [sitzung({ toVeroeffentlicht: true })],
    });
    expect(regeln(z)).toEqual([]);
  });
});

describe("R2 Jemand trägt sich ein", () => {
  it("informiert alle anderen, nicht die Person selbst", () => {
    const z = zustand({ teilnahmen: [teilnahme()] });
    expect(empfaenger(z)).toEqual(["b", "c"]);
    expect(faelligeNachrichten(z)[0]?.ausloeserId).toBe("a");
  });

  it("wiederholt sich nicht, löst aber bei erneuter Eintragung wieder aus", () => {
    const z = zustand({ teilnahmen: [teilnahme()] });
    const versand = protokoll(z);
    expect(faelligeNachrichten({ ...z, versand })).toEqual([]);

    const neu = teilnahme({ eingetragenAm: d("2026-11-02T08:00:00Z") });
    expect(faelligeNachrichten({ ...z, teilnahmen: [neu], versand })).toHaveLength(2);
  });

  it("ausgetragene Personen lösen nichts aus", () => {
    const z = zustand({ teilnahmen: [teilnahme({ ausgetragenAm: d("2026-11-01T09:00:00Z") })] });
    expect(regeln(z)).not.toContain("R2");
  });
});

describe("R3 niemand eingetragen", () => {
  it("noch nicht fällig, wenn mehr als 7 Tage bleiben", () => {
    expect(regeln(zustand({ jetzt: d("2026-11-10T06:00:00Z") }))).toEqual([]);
  });

  it("fällig genau 7 Kalendertage vorher", () => {
    const z = zustand({ jetzt: d("2026-11-11T06:00:00Z") });
    expect(empfaenger(z)).toEqual(["a", "b", "c"]);
    expect(regeln(z)).toEqual(["R3", "R3", "R3"]);
  });

  it("entfällt, wenn jemand eingetragen ist", () => {
    const z = zustand({ jetzt: d("2026-11-12T06:00:00Z"), teilnahmen: [teilnahme()] });
    expect(regeln(z)).not.toContain("R3");
  });

  it("geht nicht doppelt raus, auch nicht am Folgetag", () => {
    const z = zustand({ jetzt: d("2026-11-11T06:00:00Z") });
    const versand = protokoll(z);
    expect(faelligeNachrichten({ ...z, jetzt: d("2026-11-12T06:00:00Z"), versand })).toEqual([]);
  });

  it("wird nach Verschiebung neu berechnet", () => {
    const z = zustand({ jetzt: d("2026-11-11T06:00:00Z") });
    const versand = protokoll(z);
    const verschoben = sitzung({ start: d("2026-11-25T17:00:00Z"), verschobenVon: z.sitzungen[0]!.start });
    // neuer Termin liegt 14 Tage entfernt: noch nichts fällig
    expect(faelligeNachrichten({ ...z, sitzungen: [verschoben], versand })).toEqual([]);
    // eine Woche später: wieder fällig
    expect(
      faelligeNachrichten({ ...z, jetzt: d("2026-11-18T06:00:00Z"), sitzungen: [verschoben], versand }),
    ).toHaveLength(3);
  });
});

describe("R1 + R3 gemeinsam (späte Tagesordnung)", () => {
  it("eine gemeinsame Mail pro Person", () => {
    const z = zustand({
      jetzt: d("2026-11-14T06:00:00Z"),
      sitzungen: [sitzung({ toVeroeffentlicht: true })],
    });
    const nachrichten = faelligeNachrichten(z);
    expect(nachrichten).toHaveLength(3);
    for (const n of nachrichten) {
      expect(n.regeln.sort()).toEqual(["R1", "R3"]);
      expect(n.protokoll).toHaveLength(2);
    }
  });

  it("R1 allein, wenn schon jemand eingetragen ist", () => {
    const z = zustand({
      jetzt: d("2026-11-14T06:00:00Z"),
      sitzungen: [sitzung({ toVeroeffentlicht: true })],
      teilnahmen: [teilnahme()],
      versand: protokollVon(["R2"]),
    });
    expect(regeln(z).every((r) => r === "R1")).toBe(true);
  });
});

function protokollVon(ausgenommen: string[]): Versand[] {
  // Versandeinträge für R2 an b und c, damit der Test nur R1 prüft
  return ausgenommen.includes("R2")
    ? ["b", "c"].map((id) => ({
        regel: "R2" as const,
        sitzungId: "s1",
        empfaengerId: id,
        bezug: "t1:2026-11-01T08:00:00.000Z",
      }))
    : [];
}

describe("R4 letzte Person trägt sich aus", () => {
  const r3Versand = (): Versand[] =>
    ["a", "b", "c"].map((id) => ({
      regel: "R3" as const,
      sitzungId: "s1",
      empfaengerId: id,
      bezug: "2026-11-18T17:00:00.000Z",
    }));

  it("informiert alle, wenn die Austragung innerhalb der Frist liegt", () => {
    const z = zustand({
      jetzt: d("2026-11-14T06:00:00Z"),
      teilnahmen: [teilnahme({ ausgetragenAm: d("2026-11-13T10:00:00Z") })],
      versand: [...r3Versand(), ...r2Versand()],
    });
    expect(regeln(z)).toEqual(["R4", "R4", "R4"]);
  });

  it("nicht, wenn die Austragung vor der Frist lag (dann greift später R3)", () => {
    const z = zustand({
      jetzt: d("2026-11-05T06:00:00Z"),
      teilnahmen: [teilnahme({ ausgetragenAm: d("2026-11-04T10:00:00Z") })],
      versand: r2Versand(),
    });
    expect(regeln(z)).toEqual([]);
  });

  it("nicht, wenn noch eine andere Person eingetragen ist", () => {
    const z = zustand({
      jetzt: d("2026-11-14T06:00:00Z"),
      teilnahmen: [
        teilnahme({ ausgetragenAm: d("2026-11-13T10:00:00Z") }),
        teilnahme({ id: "t2", mitgliedId: "b" }),
      ],
      versand: [...r3Versand(), ...r2Versand()],
    });
    expect(regeln(z)).not.toContain("R4");
  });

  it("geht nicht doppelt raus", () => {
    const z = zustand({
      jetzt: d("2026-11-14T06:00:00Z"),
      teilnahmen: [teilnahme({ ausgetragenAm: d("2026-11-13T10:00:00Z") })],
      versand: [...r3Versand(), ...r2Versand()],
    });
    const versand = [...z.versand, ...protokoll(z)];
    expect(faelligeNachrichten({ ...z, versand })).toEqual([]);
  });

  it("wird in die R3-Mail eingebunden, wenn R3 noch aussteht, und läuft nicht nach", () => {
    const z = zustand({
      jetzt: d("2026-11-14T06:00:00Z"),
      teilnahmen: [teilnahme({ ausgetragenAm: d("2026-11-13T10:00:00Z") })],
      versand: r2Versand(),
    });
    const nachrichten = faelligeNachrichten(z);
    expect(nachrichten).toHaveLength(3);
    expect(nachrichten[0]?.regeln.sort()).toEqual(["R3", "R4"]);
    const versand = [...z.versand, ...protokoll(z)];
    expect(faelligeNachrichten({ ...z, jetzt: d("2026-11-15T06:00:00Z"), versand })).toEqual([]);
  });

  function r2Versand(): Versand[] {
    return ["b", "c"].map((id) => ({
      regel: "R2" as const,
      sitzungId: "s1",
      empfaengerId: id,
      bezug: "t1:2026-11-01T08:00:00.000Z",
    }));
  }
});

describe("R5 Notiz fehlt", () => {
  const nachher = (tag: string) => zustand({ jetzt: d(`${tag}T06:00:00Z`) });

  it("noch nicht fällig nach 2 Tagen", () => {
    const z = { ...nachher("2026-11-20"), teilnahmen: [teilnahme()] };
    expect(regeln(z)).toEqual([]);
  });

  it("fällig nach 3 Tagen, nur an Teilnehmende", () => {
    const z = { ...nachher("2026-11-21"), teilnahmen: [teilnahme()] };
    expect(empfaenger(z)).toEqual(["a"]);
    expect(regeln(z)).toEqual(["R5"]);
  });

  it("entfällt bei vorhandener Notiz", () => {
    const z = { ...nachher("2026-11-21"), teilnahmen: [teilnahme()], notizen: [{ sitzungId: "s1" }] };
    expect(regeln(z)).toEqual([]);
  });

  it("entfällt bei 'doch nicht teilgenommen'", () => {
    const z = { ...nachher("2026-11-21"), teilnahmen: [teilnahme({ nichtTeilgenommen: true })] };
    expect(regeln(z)).toEqual([]);
  });

  it("ausgetragene Personen werden nicht erinnert", () => {
    const z = {
      ...nachher("2026-11-21"),
      teilnahmen: [teilnahme({ ausgetragenAm: d("2026-11-10T10:00:00Z") })],
    };
    expect(regeln(z)).toEqual([]);
  });

  it("geht nicht doppelt raus", () => {
    const z = { ...nachher("2026-11-21"), teilnahmen: [teilnahme()] };
    const versand = protokoll(z);
    expect(faelligeNachrichten({ ...z, jetzt: d("2026-11-22T06:00:00Z"), versand })).toEqual([]);
  });
});

describe("Absage und Verschiebung", () => {
  it("Absage: Info an Eingetragene, sonst nichts", () => {
    const z = zustand({
      jetzt: d("2026-11-14T06:00:00Z"),
      sitzungen: [sitzung({ abgesagt: true, toVeroeffentlicht: true })],
      teilnahmen: [teilnahme()],
    });
    expect(empfaenger(z)).toEqual(["a"]);
    expect(regeln(z)).toEqual(["abgesagt"]);
    const versand = protokoll(z);
    expect(faelligeNachrichten({ ...z, versand })).toEqual([]);
  });

  it("abgesagte Sitzung löst nie R3 oder R5 aus", () => {
    const z = zustand({
      jetzt: d("2026-11-25T06:00:00Z"),
      sitzungen: [sitzung({ abgesagt: true })],
      teilnahmen: [teilnahme()],
    });
    expect(regeln(z)).toEqual([]);
  });

  it("Verschiebung: Eingetragene werden informiert und behalten ihren Eintrag", () => {
    const neu = d("2026-11-25T17:00:00Z");
    const z = zustand({
      sitzungen: [sitzung({ start: neu, verschobenVon: d("2026-11-18T17:00:00Z") })],
      teilnahmen: [teilnahme()],
      versand: [
        { regel: "R2", sitzungId: "s1", empfaengerId: "b", bezug: "t1:2026-11-01T08:00:00.000Z" },
        { regel: "R2", sitzungId: "s1", empfaengerId: "c", bezug: "t1:2026-11-01T08:00:00.000Z" },
      ],
    });
    expect(empfaenger(z)).toEqual(["a"]);
    expect(regeln(z)).toEqual(["verschoben"]);
  });
});

describe("Zeitzone", () => {
  it("zählt Kalendertage in Berlin, nicht in UTC", () => {
    // Sitzung 2026-11-18 00:30 Berlin = 2026-11-17 23:30 UTC
    const s = sitzung({ start: d("2026-11-17T23:30:00Z") });
    // 2026-11-11 00:10 Berlin (= 10.11. 23:10 UTC): in Berlin genau 7 Tage vorher
    const z = zustand({ jetzt: d("2026-11-10T23:10:00Z"), sitzungen: [s] });
    expect(regeln(z)).toEqual(["R3", "R3", "R3"]);
  });
});

describe("sitzungStatus", () => {
  const st = (jetzt: string, extra: Partial<Zustand> = {}, s = sitzung()) => {
    const z = zustand({ jetzt: d(jetzt), ...extra });
    return sitzungStatus(s, z.teilnahmen, z.notizen, z.jetzt, z.einstellungen);
  };

  it("offen, dringend, besetzt", () => {
    expect(st("2026-11-01T06:00:00Z")).toBe("offen");
    expect(st("2026-11-11T06:00:00Z")).toBe("dringend");
    expect(st("2026-11-11T06:00:00Z", { teilnahmen: [teilnahme()] })).toBe("besetzt");
  });

  it("ausgetragene zählen nicht als besetzt", () => {
    const t = teilnahme({ ausgetragenAm: d("2026-11-02T00:00:00Z") });
    expect(st("2026-11-11T06:00:00Z", { teilnahmen: [t] })).toBe("dringend");
  });

  it("nach der Sitzung: Notiz fehlt oder dokumentiert", () => {
    expect(st("2026-11-19T06:00:00Z")).toBe("notiz-fehlt");
    expect(st("2026-11-19T06:00:00Z", { notizen: [{ sitzungId: "s1" }] })).toBe("dokumentiert");
  });

  it("abgesagt", () => {
    expect(st("2026-11-01T06:00:00Z", {}, sitzung({ abgesagt: true }))).toBe("abgesagt");
  });
});
