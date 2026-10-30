import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renameRuntimeBindings } from "../lib/obfuscator/runtime-renamer";
import { distributeRuntimeHelpers } from "../lib/obfuscator/runtime-layout";
import { tokenize } from "../lib/obfuscator/lexer";
import { obfuscate } from "../lib/obfuscator/engine";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "emission-"));
  try {
    const file = join(dir, "case.luau");
    writeFileSync(file, source);
    return execFileSync("/tmp/lurapy-runtimes/luau", [file], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const options = { code: "", platform: "luau", optimizationLevel: 3, toggles: { intenseVm: true, gcFixes: true }, nameConfig: { ...DEFAULT_NAME_CONFIG, seed: 42 } };
describe("emission presentation contracts", () => {
  it("reuses sibling parameters while preserving ancestor captures and initializers", () => {
    const source = "local outside=4;local function first(arg) local x=outside+arg;return function(delta) x+=delta;return x end end;local function second(arg) return arg+outside end;local a=first(2);print(a(3),second(7));do local outside=outside+1;print(outside) end";
    const output = renameRuntimeBindings(source, 42);
    expect(run(output)).toBe(run(source));
    const names = (s) => new Set(tokenize(s).filter((t) => t.type === "ident").map((t) => t.value)).size;
    expect(names(output)).toBeLessThan(names(renameRuntimeBindings(source, 42, { reuseNames: false })));
  });
  it("decimalizes numeric tokens without touching string bytes or consuming RNG", () => {
    const source = 'local x=-0.0;local s="0xFF_0b11\\000\\255";print(1/x,0x1f,0b1010,1_234,#s,string.byte(s,#s))';
    let calls = 0;
    const old = Math.random;
    Math.random = () => {
      calls++;
      return 0.5;
    };
    let output = "";
    try {
      output = renameRuntimeBindings(source, 7, { decimalNumbers: true });
    } finally {
      Math.random = old;
    }
    expect(calls).toBe(0);
    expect(run(output)).toBe(run(source));
    expect(tokenize(output).filter((t) => t.type === "number").every((t) => !/^0[xb]/i.test(t.value) && !t.value.includes("_"))).toBe(true);
  });
  it("lifts real helpers with explicit dependencies and exact trailing nil/false", () => {
    const source = 'return(function()return setmetatable({x=function(self) local select=select;local pack=function(...)local t={...};t.n=select("#",...);return t end;local state={n=0};local check=function()state.n+=1 end;local function f(...)check();return pack(...) end;local t=f(false,nil,3,nil);print(t.n,t[1],t[3],state.n);end},{}):x()end)()';
    const output = distributeRuntimeHelpers(source, ["pack", "check"]);
    expect(run(output)).toBe(run(source));
    expect(output).toContain("_h0");
    expect(output).toContain("_h1");
  });
  it("refuses to lift mutable captured lexical cells", () => {
    expect(() => distributeRuntimeHelpers("return {x=function(self)local x=1;local pack=function()return x end;x=2;print(pack())end}", ["pack"])).toThrow("E_RUNTIME_MUTABLE_CAPTURE");
  });
  it("rejects shadowed dependency bindings at call sites", () => {
    expect(() => distributeRuntimeHelpers("return {x=function(self)local dep=7;local h=function()return dep end;do local dep=99;print(h())end end}", ["h"])).toThrow("E_RUNTIME_SHADOWED_DEPENDENCY");
  });
  it("rejects interdependent helper lifting before any mutation", () => {
    expect(() => distributeRuntimeHelpers("return {x=function(self)local h=function()return 7 end;local g=function()return h()end;print(g())end}", ["h", "g"])).toThrow("E_RUNTIME_HELPER_DEPENDENCY");
  });
  it("preserves deterministic direct generation and legacy RNG-dependent payload", () => {
    const code = "local function f(...)return ... end;print(f(false,nil,3,nil))";
    const a = obfuscate(code, options), b = obfuscate(code, options);
    expect(a).toBe(b);
    expect(run(a)).toBe(run(code));
    expect(tokenize(a).filter((t) => t.type === "number").every((t) => !/^0[xb]/i.test(t.value) && !t.value.includes("_"))).toBe(true);
  });
  it("does not emit Roblox probes for generic Luau", () => {
    const output = obfuscate("print(4)", options);
    expect(run(output).trim()).toBe("4");
  });
});
