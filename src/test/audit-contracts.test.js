import { describe, expect, it } from "vitest";
import { obfuscateWithReport, validateLuaSyntax } from "../lib/obfuscator/engine";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
import { serializeDiagnostic } from "../lib/obfuscator/diagnostics";
const source = "local function f(x) return function() x+=1;return x end end;local a=f(4);print(a(),a())";
const options = { code: source, platform: "luau", optimizationLevel: 2, toggles: { intenseVm: true }, nameConfig: { ...DEFAULT_NAME_CONFIG, seed: 42 } };
describe("audit contracts", () => {
  it("records random seed for exact replay", () => {
    const first = obfuscateWithReport(source, { ...options, nameConfig: { ...DEFAULT_NAME_CONFIG, seed: null } });
    const replay = obfuscateWithReport(source, { ...options, nameConfig: { ...DEFAULT_NAME_CONFIG, seed: first.metadata.seed } });
    expect(replay.output).toBe(first.output);
    expect(first.metadata.seed).toBeGreaterThanOrEqual(0);
    expect(first.metadata.attempts).toBe(1);
  });
  it("isolates reporting failures from generation", () => {
    const result = obfuscateWithReport(source, options, void 0, () => {
      throw new Error("report failed");
    });
    const plain = obfuscateWithReport(source, options);
    expect(result.output).toBe(plain.output);
    expect(result.metadata).toEqual(plain.metadata);
    expect(result.callbackErrors).toEqual(["report failed"]);
  });
  it("reports without consuming generation randomness", () => {
    let audit;
    const off = obfuscateWithReport(source, options);
    const on = obfuscateWithReport(source, options, void 0, (r) => {
      audit = r;
    });
    expect(on.output).toBe(off.output);
    expect(audit?.regions.reduce((s, r) => s + r.bytes, 0)).toBe(audit?.rawBytes);
    expect(audit?.finalBytes).toBe(new TextEncoder().encode(on.output).length);
    expect(audit?.captureSlots).toBe(1);
    expect(audit?.prototypes).toBe(3);
  });
  for (const code of ["type function F(t) return t end", "export type function F(t) return t end", "type --comment\n function F(t) return t end"]) it(`rejects type function before consumption: ${code}`, () => {
    const result = validateLuaSyntax(code);
    expect(result.valid).toBe(false);
    expect(result.diagnostic?.code).toBe("UNSUPPORTED_TYPE_FUNCTION");
    expect(result.diagnostic?.span?.line).toBe(1);
    expect(() => obfuscateWithReport(code, options)).toThrow("UNSUPPORTED_TYPE_FUNCTION");
  });
  it("keeps contextual type identifiers legal", () => {
    for (const code of ["print(type(1))", "local type=function(x) return x end;print(type(4))", "local export=function(x)return x end;export(1)", "local t={type=3};print(t.type)"]) expect(validateLuaSyntax(code).valid).toBe(true);
  });
  it("retains diagnostic fields as plain transport data", () => {
    try {
      obfuscateWithReport("type function F(t) return t end", options);
      throw new Error("must reject");
    } catch (error) {
      const serialized = serializeDiagnostic(error);
      expect(serialized?.code).toBe("UNSUPPORTED_TYPE_FUNCTION");
      expect(serialized?.target).toBe("luau");
      expect(serialized?.span?.column).toBe(1);
      expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
    }
  });
});
