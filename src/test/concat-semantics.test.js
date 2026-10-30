import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { obfuscateWithReport } from "../lib/obfuscator/engine";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
const runtime = process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau";
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "lpy-concat-"));
  try {
    const path = join(dir, "case.luau");
    writeFileSync(path, source);
    return execFileSync(runtime, [path], { encoding: "utf8" }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const fixtures = {
  primitives: `print('a'..'b',12 .. 'x','x'..3.5);local v='a';v..='b';print(v)`,
  errors: `for _,v in ipairs({false,true,{}}) do local ok,e=pcall(function() return 'a'..v end);print(ok,type(e)) end;local ok,e=pcall(function() return nil..'b' end);print(ok,type(e))`,
  metamethods: `local calls=0;local mt={__tostring=function() error('tostring must not run',0) end,__concat=function(a,b) calls+=1;return '('..(type(a)=='table' and a.v or a)..':'..(type(b)=='table' and b.v or b)..')' end};local a=setmetatable({v='A'},mt);local b=setmetatable({v='B'},mt);print(a..b,'x'..a,a..'y',calls)`,
  grouping: `local trace='';local mt;local function item(s) return setmetatable({v=s},mt) end;mt={__concat=function(a,b) trace=trace..'['..a.v..','..b.v..']';return item('('..a.v..b.v..')') end};local a,b,c=item('A'),item('B'),item('C');print((a..b..c).v,trace);trace='';print(((a..b)..c).v,trace);trace='';print((a..(b..c)).v,trace)`,
  effects: `local trace='';local mt;local function f(s) trace=trace..s;return setmetatable({v=s},mt),nil,false end;mt={__concat=function(a,b) trace=trace..'['..a.v..b.v..']';return setmetatable({v=a.v..b.v},mt) end};local x=f('A')..f('B')..f('C');print(x.v,trace);local function result() return x.v,nil,false end;print(select('#',result()),result())`,
  compound: `local hits=0;local mt={__concat=function(a,b) hits+=1;return setmetatable({v=a.v+b.v},getmetatable(a)) end};local t={x=setmetatable({v=2},mt)};local n=0;local function key() n+=1;return 'x' end;t[key()]..=setmetatable({v=3},mt);print(t.x.v,n,hits)`
};
describe("native CONCAT semantics", () => {
  for (const level of [1, 2, 3]) for (const seed of [42, 7, 1337]) {
    for (const [name, source] of Object.entries(fixtures)) it(`${name} L${level} seed ${seed}`, () => {
      const expected = run(source);
      const result = obfuscateWithReport(source, { code: source, platform: "luau", optimizationLevel: level, toggles: { intenseVm: true }, nameConfig: { ...DEFAULT_NAME_CONFIG, seed } });
      expect(result.usedLevel).toBe(level);
      expect(run(result.output)).toBe(expected);
    });
  }
});
