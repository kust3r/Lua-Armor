import { describe, expect, it } from "vitest";
import { obfuscateWithReport } from "../lib/obfuscator/engine";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
import { normalizeToggles } from "../lib/obfuscator/normalize-toggles";
import { PLATFORMS } from "../lib/obfuscator/platforms";
describe("retired line option", () => {
  it("does not include the retired option in any platform configuration", () => {
    expect(PLATFORMS.flatMap((p) => p.toggles).map((t) => t.id).includes("disableLineInfo")).toBe(false);
  });
  it("removes legacy true and false without changing other settings", () => {
    expect(normalizeToggles({ disableLineInfo: true, gcFixes: true })).toEqual({ gcFixes: true });
    expect(normalizeToggles({ disableLineInfo: false, gcFixes: true })).toEqual({ gcFixes: true });
  });
  for (const loader of ["direct", "dynamic"]) it(`ignores historical values byte-for-byte in ${loader} generation and metadata`, () => {
    const source = "print(73)";
    const base = { code: source, platform: "luau", optimizationLevel: 3, nameConfig: { ...DEFAULT_NAME_CONFIG, seed: 42 }, execution: { loader } };
    const absent = obfuscateWithReport(source, { ...base, toggles: {} });
    for (const disableLineInfo of [true, false]) {
      const report = obfuscateWithReport(source, { ...base, toggles: { disableLineInfo } });
      expect(report.output).toBe(absent.output);
      expect(report.metadata.toggles).not.toHaveProperty("disableLineInfo");
      expect(report.output).not.toMatch(/[\r\n]/);
    }
  });
});
