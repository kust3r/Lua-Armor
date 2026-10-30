import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitPrototypeMetadata, encodePrototypeMetadata } from "../lib/obfuscator/prototype-metadata";
import { emitNativeIdentity } from "../lib/obfuscator/native-identity";
import { removeUnusedNumericTables } from "../lib/obfuscator/runtime-cleanup";
import { obfuscateWithReport } from "../lib/obfuscator/engine";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
function run(code) {
  const dir = mkdtempSync(join(tmpdir(), "structural-"));
  try {
    const file = join(dir, "case.luau");
    writeFileSync(file, code);
    return spawnSync(process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau", [file], { encoding: "utf8", timeout: 1e4 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
describe("exact independent prototype metadata", () => {
  it("accepts empty/captured prototypes and rejects nearby plausible offsets with E_PROTO", () => {
    const metadata = emitPrototypeMetadata([{ position: 1, captures: [] }, { position: 3411, captures: [0, 4] }, { position: 3557, captures: [] }]);
    const result = run(metadata + `local function check(p) local layout=_prototypeMetadata[p];if layout==nil then error("E_PROTO",0) end;return layout end;assert(check(1)==false);assert(check(3557)==false);assert(check(3411)[2]==4);for _,p in ipairs({0,2,3410,3412,3556,3558,999999}) do local ok,e=pcall(check,p);assert(not ok and e=="E_PROTO") end;print("EXACT")`);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("EXACT");
  });
  it("rejects duplicate/out-of-order identities and capture metadata", () => {
    expect(() => encodePrototypeMetadata([{ position: 1, captures: [] }, { position: 1, captures: [] }])).toThrow();
    expect(() => encodePrototypeMetadata([{ position: 1, captures: [2, 2] }])).toThrow();
    expect(() => encodePrototypeMetadata([{ position: 1, captures: [-1] }])).toThrow();
  });
});
describe("ordered live native identity units", () => {
  const emitted = emitNativeIdentity(Array.from({ length: 20 }, (_, i) => `live(${i + 1})`), "cache");
  it("preserves all twenty live reads, nil optional refs and short-circuit at every index", () => {
    const result = run(`local cache={};local mismatch=0;local seen={};for i=1,19 do cache[i]={} end;local function live(i) seen[#seen+1]=i;if i==mismatch then return {} end;return cache[i] end;` + emitted.declarations + `local function check() return ${emitted.mismatch} end;for stop=0,20 do mismatch=stop;seen={};assert(check()==(stop>0));assert(#seen==(stop==0 and 20 or stop));for i,v in ipairs(seen) do assert(i==v) end end;print("LIVE20")`);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("LIVE20");
  });
  it("does not pre-evaluate later reads or swallow getter errors", () => {
    const result = run(`local cache={};local function live(i) if i==9 then error("GETTER",0) end;return cache[i] end;` + emitted.declarations + `local ok,e=pcall(function() return ${emitted.mismatch} end);assert(not ok and e=="GETTER");print("ERROR_ORDER")`);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("ERROR_ORDER");
  });
});
describe("binding-proven pure numeric table removal", () => {
  it("removes the highlighted literal arithmetic, not used/shadowed/escaping locals", () => {
    const source = "do local a={(63656-407),(61341+249),(7213*3)} end;local a={1};do local a={2} end;print(a[1]);local b={3};return function() return b end";
    const result = removeUnusedNumericTables(source);
    expect(result.removed).toBe(2);
    const executed = run("local factory=(function() " + result.code + " end)();assert(factory()[1]==3)");
    expect(executed.status).toBe(0);
    expect(executed.stdout.trim()).toBe("1");
  });
  it("retains calls, lookups, potentially failing arithmetic, nonfinite values and multiple initializers", () => {
    const source = "local a={f()};local b={t.x};local c={1/0};local d={1%0};local e={2^4};local f,g={1},effect();local h={1e308*1e308};local i={x+1};local j={[-1]=3}";
    expect(removeUnusedNumericTables(source).removed).toBe(0);
  });
});
it("keeps deterministic one-line direct output, nil/false arity, closures and mutation", () => {
  const code = 'local x=0;local function f(...) x+=1;return nil,false,x,... end;print(select("#",f(7,nil)));print(f(8,nil))';
  const options = { code, platform: "luau", optimizationLevel: 3, toggles: { intenseVm: true, gcFixes: true }, nameConfig: { ...DEFAULT_NAME_CONFIG, seed: 42 } };
  const first = obfuscateWithReport(code, options), second = obfuscateWithReport(code, options);
  expect(first.output).toBe(second.output);
  expect(first.usedLevel).toBe(3);
  expect(first.output).not.toMatch(/[\r\n]|loadstring/);
  const result = run(first.output);
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("5\nnil	false	2	8	nil");
});
