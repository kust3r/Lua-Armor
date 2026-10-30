import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tokenize } from "../lib/obfuscator/lexer";
import { parse } from "../lib/obfuscator/parser";
import { compile } from "../lib/obfuscator/compiler";
import { obfuscate, obfuscateDiagnostic } from "../lib/obfuscator/engine";
import { regenerateSource } from "../lib/obfuscator/source-emission";
import { restoreVmPlatform, VM_PLATFORMS } from "../lib/obfuscator/platforms";
const runtime = process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau";
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "lpy-sharing-"));
  try {
    const file = join(dir, "case.luau");
    writeFileSync(file, source);
    return execFileSync(runtime, [file], { encoding: "utf8", timeout: 3e4 }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const cases = {
  dynamicArgs: `local calls=0;local function nextValue() calls+=1;return calls*3 end;local f=LPY_NO_VIRTUALIZE(function(a,b,...) return a,b,select('#',...),... end);print(f(nextValue(),nextValue(),nil,false));print(calls)`,
  siblings: `local make=LPY_NO_VIRTUALIZE(function(n) local x=n;return LPY_NO_VIRTUALIZE(function(v) x+=v;return x end),LPY_NO_VIRTUALIZE(function() return x end) end);local a,b=make(2);local c,d=make(10);print(a(3),b(),c(4),d(),b())`,
  transitive: `local f=LPY_NO_VIRTUALIZE(function(n) local x=n;return LPY_NO_VIRTUALIZE(function() return function(v) x+=v;return LPY_NO_VIRTUALIZE(function() x+=1;return x end) end end) end);local a=f(4)();local b=a(3);print(b(),b())`,
  multiple: `local n=0;local t={};local f=LPY_NO_VIRTUALIZE(function(...) local function at() n+=1;return n end;local a,b,c=...;t[at()],t[at()],a=b,c,a;return a,t[1],t[2],n end);print(f(1,nil,false));print(n)`,
  results: `local f=LPY_NO_VIRTUALIZE(function(...) return nil,...,nil end);local g=LPY_NO_VIRTUALIZE(function(...) return ... end);local function p(...) print(select('#',...),...) end;p(f(1,nil,false));p(g(nil,2,nil,false,nil));p((g(1,2)))`,
  callbackYield: `local x=0;local f=LPY_NO_VIRTUALIZE(function(cb,...) x+=1;local a,b=cb(...);x+=1;return a,b,x end);local function cb(v) x+=v;coroutine.yield(nil,false,x);return nil,x end;local co=coroutine.create(function() return f(cb,4) end);print(coroutine.resume(co));print(x);print(coroutine.resume(co));print(x)`,
  errorRecovery: `local n=0;local f=LPY_NO_VIRTUALIZE(function(cb) n+=1;return cb(n) end);local function cb(v) if v==1 then error('failure',0) end;return v,nil,false end;print(pcall(f,cb));print(pcall(f,cb));print(n)`,
  crossReentry: `local f;local x=0;local function cb(n) if n>0 then return f(n-1) end;return x end;f=LPY_NO_VIRTUALIZE(function(n) x+=1;return cb(n) end);print(f(5),x)`,
  continueCells: `local f=LPY_NO_VIRTUALIZE(function() local out={};for i=1,4 do local x=i;out[i]=function(v) x+=v;return x end;if i%2==0 then continue end;x+=10 end;return out end);local t=f();print(t[1](1),t[2](1),t[3](1),t[4](1))`,
  closeSlots: `local t={};for i=1,3 do do local x=i;t[i]=LPY_NO_VIRTUALIZE(function(v) x+=v;return x end) end;do local x=100+i;print(x) end end;print(t[1](1),t[2](2),t[3](3),t[1](1))`,
  localNames: `local _ENV=4;local debug=function(v) return v+1 end;local getfenv=function(v) return v+2 end;local setfenv=function(v) return v+3 end;local f=LPY_NO_VIRTUALIZE(function(v) return debug(v)+getfenv(v)+setfenv(v)+_ENV end);print(f(2))`,
  nativeNames: `local f=LPY_NO_VIRTUALIZE(function() local _ENV=4;local debug=function(v) return v+1 end;return debug(_ENV) end);print(f())`
};
describe.skipIf(!existsSync(runtime))("binding-resolved hybrid differential", () => {
  for (const [label, source] of Object.entries(cases)) it(label, () => {
    const expected = run(source.split("LPY_NO_VIRTUALIZE").join(""));
    for (const level of [1, 2, 3]) expect(run(obfuscate(source, { platform: "luau", optimizationLevel: level, toggles: { gcFixes: true }, code: source }))).toBe(expected);
    if (label === "dynamicArgs") expect(expected).toBe("3	6	2	nil	false\n2");
  }, 6e4);
});
describe("sharing and target contracts", () => {
  it.skipIf(!existsSync(runtime))("diagnostics count native calls without production counters", () => {
    const source = "local f=LPY_NO_VIRTUALIZE(function(n) return n+1 end);for i=1,3 do print(f(i)) end";
    const options = { platform: "luau", optimizationLevel: 2, toggles: { gcFixes: true }, code: source };
    const output = obfuscateDiagnostic(source, options);
    const harness = `local d={instructions=0,clockCalls=0,yields=0,yieldSeconds=0,protoSeconds=0,prototypes=0,vmEntries=0,nativeCalls=0,vmClosureCalls=0,initSeconds=0,nativeInclusiveSeconds=0,callOpcodes=0};assert(loadstring(${JSON.stringify(output)}))(d);print(d.nativeCalls,d.vmEntries,d.instructions>0,d.prototypes)`;
    expect(run(harness)).toBe("2\n3\n4\n3	1	true	1");
    expect(obfuscateDiagnostic(source, options, false)).not.toContain("_lpyDiag");
  });
  it("keeps exclusive native locals and native closures unboxed", () => {
    const source = "local f=LPY_NO_VIRTUALIZE(function(n) local x=n;return LPY_NO_VIRTUALIZE(function(v) x=x+v;return x end) end)";
    const { proto } = compile(parse(tokenize(source)));
    const native = proto.protos[0];
    expect(native.protos).toHaveLength(0);
    expect(native.nativeSource).toContain("local x=n");
    expect(native.nativeSource).not.toContain("[1]");
  });
  it("only exposes Roblox/Luau VM choices and migrates old preferences", () => {
    expect(VM_PLATFORMS.map((p) => p.id)).toEqual(["roblox", "luau"]);
    expect(restoreVmPlatform("lua54")).toBe("roblox");
    expect(restoreVmPlatform("luau")).toBe("luau");
  });
  it("preserves recognized analysis directives, rejects incompatible transfer", () => {
    for (const directive of ["strict", "nonstrict", "nocheck"]) {
      expect(regenerateSource(`--!${directive}
return 1`, { target: "luau", mode: "compact" }).code.startsWith(`--!${directive}
`)).toBe(true);
      expect(() => regenerateSource(`--!${directive}
return 1`, { target: "lua51" })).toThrow("UNSUPPORTED_DIRECTIVE");
    }
    expect(() => regenerateSource("--!optimize 2\nreturn 1", { target: "luau" })).toThrow("UNSUPPORTED_DIRECTIVE");
  });
  it("rejects genuine native introspection rather than local names", () => {
    for (const builtin of ["debug", "getfenv", "setfenv"]) {
      const source = `local f=LPY_NO_VIRTUALIZE(function() return ${builtin} end)`;
      expect(() => obfuscate(source, { platform: "luau", optimizationLevel: 1, toggles: {}, code: source })).toThrow("UNSUPPORTED_NATIVE_INTROSPECTION");
    }
  });
});
