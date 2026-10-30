import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tokenize } from "../lib/obfuscator/lexer";
import { parse } from "../lib/obfuscator/parser";
import { astToLua } from "../lib/obfuscator/unparser";
import { obfuscateWithReport, validateLuaSyntax } from "../lib/obfuscator/engine";
import { preprocessMacros } from "../lib/obfuscator/macros";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
const runtime = process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau";
function run(code) {
  const dir = mkdtempSync(join(tmpdir(), "lpy-interpolation-"));
  try {
    const path = join(dir, "case.luau");
    writeFileSync(path, code);
    return execFileSync(runtime, [path], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const cases = {
  empty: "print(``, `100% %%`, `hello`)",
  values: 'local tostring=function() return "wrong" end;print(`{nil}/{false}/{12.5}`)',
  bytes: 'local s=`\\0001\\255\\128\\`\\{\\}\\\\\\"\xE9`;for i=1,#s do print(string.byte(s,i)) end',
  unicode: "print(`\\u{1F600}\\z \n x{3}`)",
  nested: "print(`outer {`inner {({x=7}).x}`} done`)",
  order: "local n=0;local function f() n+=1;return n,nil end;print(`{f()}:{f()}`,n)",
  returns: "local function f() end;local function g() return 2,3 end;print(`{f()}/{g()}`)",
  metamethod: 'local n=0;local x=setmetatable({},{__tostring=function() n+=1;return "X"..n end});local function f() n+=10;return x end;print(`{x}/{f()}`,n)',
  uploadExpression: `local g={"a","b"};local f=3;local h=nil;print((h or "")..\` expected '{table.concat(g,", ")}'. got '{typeof(f)}'.\`)`,
  conditional: 'local d=false;print(`Scripts now {d and "may" or "may not"} make you rejoin`)',
  vararg: "local function f(...) return `{...}` end;print(f(4,5));print(f())",
  comments: "print(`{(function() -- } ` ignored\nreturn 4 end)()}`)"
};
describe("interpolation parser", () => {
  it("does not emit Luau conversion into a legacy dialect", () => {
    expect(() => astToLua(parse(tokenize("return `{1}`")), { target: "lua51" })).toThrow("interpolation requires Luau");
  });
  it("rejects malformed holes and escapes", () => {
    for (const code of ["return `{}`", "return `{1,2}`", "return `{1`", "return `abc", "return `x}`", "return `\\q`"]) expect(validateLuaSyntax(code).valid).toBe(false);
  });
  it("preserves macros inside holes but never literal segments", () => {
    const pre = preprocessMacros("return `LPY_LINE {LPY_LINE} LPY_UNKNOWN`");
    expect(pre.errors).toEqual([]);
    expect(pre.code).toBe("return `LPY_LINE {1} LPY_UNKNOWN`");
    expect(validateLuaSyntax(pre.code).valid).toBe(true);
  });
});
describe.skipIf(!existsSync(runtime))("official Luau interpolation differential", () => {
  for (const [name, source] of Object.entries(cases)) it(name, () => {
    const expected = run(source);
    const ast = parse(tokenize(source));
    for (const mode of ["compact", "readable"]) {
      const result = astToLua(ast, { target: "luau", mode });
      expect(run(result.code)).toBe(expected);
    }
    for (const level of [1, 2, 3]) {
      const report = obfuscateWithReport(source, { platform: "luau", optimizationLevel: level, toggles: {}, code: source, nameConfig: { ...DEFAULT_NAME_CONFIG, seed: 42 } });
      expect(report.usedLevel).toBe(level);
      expect(run(report.output)).toBe(expected);
    }
  }, 6e4);
});
