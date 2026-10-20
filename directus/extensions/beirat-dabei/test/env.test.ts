import { describe, expect, it } from "vitest";
import { envText, envZahl } from "../src/env.js";

describe("env", () => {
  it("stellt Texte wieder her, die Directus in Listen zerlegt hat", () => {
    expect(envText(["15 6", "12", "18 * * *"])).toBe("15 6,12,18 * * *");
  });
  it("lässt Texte und Zahlen als Text", () => {
    expect(envText("0 7 * * *")).toBe("0 7 * * *");
    expect(envText(1000)).toBe("1000");
  });
  it("leer und fehlend sind undefined", () => {
    expect(envText(undefined)).toBeUndefined();
    expect(envText("")).toBeUndefined();
  });
  it("Zahlen mit Rückfall", () => {
    expect(envZahl(14, 3)).toBe(14);
    expect(envZahl("14", 3)).toBe(14);
    expect(envZahl("x", 3)).toBe(3);
    expect(envZahl(undefined, 3)).toBe(3);
  });
});
