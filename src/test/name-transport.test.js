import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decimalBytes, emitNameDirectory } from "../lib/obfuscator/name-transport";
import { hideBuiltinNames } from "../lib/obfuscator/vm-codegen";
import { obfuscate } from "../lib/obfuscator/engine";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
function run(code) {
  const dir = mkdtempSync(join(tmpdir(), "names-"));
  try {
    const file = join(dir, "case.luau");
    writeFileSync(file, code);
    return execFileSync(process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau", [file], { encoding: "utf8", timeout: 2e4 });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}
describe("deterministic name transport", () => {
  it("restores exact directory order, duplicate names and empty names without RNG", () => {
    const names = ["type", "", "string", "type", 'a"\\z', "\xFF"];
    const original = Math.random;
    let draws = 0;
    let output = "";
    Math.random = () => {
      draws++;
      return 0.5;
    };
    try {
      output = emitNameDirectory(names, "t", "string.char");
    } finally {
      Math.random = original;
    }
    expect(draws).toBe(0);
    expect(run(output + "print(#t);for i=1,#t do print(#t[i],string.byte(t[i],1)) end")).toBe(run(`local t={${names.map(decimalBytes).join(",")}};print(#t);for i=1,#t do print(#t[i],string.byte(t[i],1)) end`));
  });
  it("preserves the empty directory and rejects ambiguous delimiters", () => {
    expect(run(emitNameDirectory([], "t", "string.char") + "print(#t)")).toBe("0\n");
    expect(() => emitNameDirectory(["a\0b"], "t", "string.char")).toThrow("E_NAME_SEPARATOR");
  });
  it("keeps lexical builtin shadowing and user _G intact", () => {
    const code = 'local _G={type="user"};local function f(type) return type end;print(f(false),_G.type,type(4),string.sub("abc",2))';
    expect(run(hideBuiltinNames(code))).toBe(run(code));
  });
  for (const seed of [7, 42, 1337]) it(`preserves mixed dispatch, conditional paths, yields and captures seed ${seed}`, () => {
    const code = 'local function make(x)return function(y)x+=y;return x end end;local f=make(3);local t={};for i=1,20 do if i%2==0 then t[#t+1]=f(i) elseif i>12 then break end end;print(table.concat(t,","));local c=coroutine.create(function()coroutine.yield(false,nil,7);return nil,false end);print(coroutine.resume(c));print(coroutine.resume(c));local ok,e=pcall(function()error("controlled",0)end);print(ok,e)';
    const options = { code: "", platform: "luau", optimizationLevel: 3, toggles: { intenseVm: true, gcFixes: true }, nameConfig: { ...DEFAULT_NAME_CONFIG, seed } };
    const a = obfuscate(code, options);
    expect(a).toBe(obfuscate(code, options));
    expect(run(a)).toBe(run(code));
    expect(a.includes("\n")).toBe(false);
    expect(/\\x[0-9a-f]{2}|\\u\{/i.test(a)).toBe(false);
  });
});
