import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { obfuscateWithReport } from "../lib/obfuscator/engine";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
import { withRandomDomains, domainRandom } from "../lib/obfuscator/generation-random";
const runtime = process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau";
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "lpy-iy2-"));
  try {
    const file = join(dir, "case.luau");
    writeFileSync(file, source);
    return execFileSync(runtime, [file], { encoding: "utf8" }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function output(code, seed = 42) {
  return obfuscateWithReport(code, { code, platform: "luau", optimizationLevel: 2, toggles: { intenseVm: true, gcFixes: true }, nameConfig: { ...DEFAULT_NAME_CONFIG, seed } }).output;
}
describe("iy2 audit contracts", () => {
  it("keeps user properties with private-looking names unchanged across hybrid boundaries", () => {
    const source = `local t={_boxes=1,_halt=2,_rv=3,_top=4,_va=5,_vac=6};local f=LPY_NO_VIRTUALIZE(function() t._boxes+=10;return t._boxes,t._vac end);print(f());print(t._halt,t._rv,t._top,t._va)`;
    expect(run(output(source))).toBe(run(source.split("LPY_NO_VIRTUALIZE").join("")));
  });
  it("fails explicitly when a cached builtin is replaced after initialization", () => {
    const source = `mutate();local s=0;for i=1,100000 do s+=i end;print('unreachable',s)`;
    const generated = output(source);
    const host = `local env=setmetatable({}, {__index=getfenv(1)});local original=type;env.mutate=function() env.type=function(v) return original(v) end end;local f=assert(loadstring(${JSON.stringify(generated)}));setfenv(f,env);local ok,e=pcall(f);print(ok,tostring(e)=='E_HOOK')`;
    expect(run(host)).toBe("false	true");
  });
  it("does not snapshot user globals or native property lookups", () => {
    const source = `local f=LPY_NO_VIRTUALIZE(function() return probe() end);print(probe(),f());change();print(probe(),f())`;
    const host = `local env=setmetatable({probe=function() return 1 end},{__index=getfenv(1)});env.change=function() env.probe=function() return 2 end end;local f=assert(loadstring(${JSON.stringify(output(source))}));setfenv(f,env);f()`;
    expect(run(host)).toBe("1	1\n2	2");
  });
  it("observer callbacks do not alter production artifacts", () => {
    const code = 'print("one","two")';
    const opts = { code, platform: "luau", optimizationLevel: 2, toggles: { gcFixes: true }, nameConfig: { ...DEFAULT_NAME_CONFIG, seed: 7 } };
    expect(obfuscateWithReport(code, opts, () => {
    }, () => {
    }).output).toBe(obfuscateWithReport(code, opts).output);
  });
  it("encoding draws are independent of transform draws and restore host randomness", () => {
    const original = Math.random;
    const a = withRandomDomains(42, () => {
      const first = domainRandom("encoding");
      Math.random();
      Math.random();
      return [first, domainRandom("encoding")];
    });
    const b = withRandomDomains(42, () => [domainRandom("encoding"), domainRandom("encoding")]);
    expect(a).toEqual(b);
    expect(Math.random).toBe(original);
  });
});
