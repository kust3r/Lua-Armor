import { describe, expect, it } from "vitest";
import { validateLuaSyntax, obfuscateWithReport } from "../lib/obfuscator/engine";
import { regenerateSource } from "../lib/obfuscator/source-emission";
import { LuaDiagnostic } from "../lib/obfuscator/diagnostics";
const unsupported = [["type T = number", "UNSUPPORTED_SYNTAX"], ["export type T = { x: number }", "UNSUPPORTED_SYNTAX"], ["local x: number=1", "UNSUPPORTED_TYPES"], ["local function f<T>(x) return x end", "UNSUPPORTED_TYPES"], ["local f=function<T>(x) return x end", "UNSUPPORTED_TYPES"], ["function f<T>(x) return x end", "UNSUPPORTED_TYPES"], ["function t:f<T>(x) return x end", "UNSUPPORTED_TYPES"], ["local function f(x: number) end", "UNSUPPORTED_TYPES"], ["local function f(...: number) end", "UNSUPPORTED_TYPES"], ["local function f(): number return 1 end", "UNSUPPORTED_TYPES"], ["local x=(1 :: number)", "UNSUPPORTED_CAST"], ["local x=1;print(x :: number)", "UNSUPPORTED_CAST"], ["type function F(t) return t end", "UNSUPPORTED_TYPE_FUNCTION"]];
describe("unsupported types have explicit positioned diagnostics", () => {
  for (const [source, code] of unsupported) it(source, () => {
    const preflight = validateLuaSyntax(source);
    expect(preflight.valid).toBe(false);
    expect(preflight.diagnostic?.code).toBe(code);
    expect(preflight.diagnostic?.span?.line).toBe(1);
    for (const fn of [() => regenerateSource(source, { target: "luau" }), () => obfuscateWithReport(source, { code: source, platform: "luau", optimizationLevel: 2, toggles: {} })]) {
      try {
        fn();
        throw new Error("expected diagnostic");
      } catch (error) {
        expect(error).toBeInstanceOf(LuaDiagnostic);
        expect(error.code).toBe(code);
      }
    }
  });
});
