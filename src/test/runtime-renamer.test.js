import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renameRuntimeBindings } from "../lib/obfuscator/runtime-renamer";
import { tokenize } from "../lib/obfuscator/lexer";
import { parse } from "../lib/obfuscator/parser";
import { resolveBindings } from "../lib/obfuscator/bindings";
import { walk } from "../lib/obfuscator/ast-walk";
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "rename-"));
  try {
    const file = join(dir, "case.luau");
    writeFileSync(file, source);
    return execFileSync(process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau", [file], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const fixtures = [
  "local x=7;do local x=x+2;local function f(n) if n==0 then return x end return f(n-1) end;print(f(3)) end;print(x)",
  "local x=3;local fs={};for x=x,5 do fs[#fs+1]=function() return x end end;for _,f in ipairs(fs) do print(f()) end",
  "local x=4;repeat local x=x+1;print(x) until x==5;print(x)",
  "local t={field=4};function t:run(x) return self.field+x end;print(t:run(2),t.field)",
  "local andy=1;local typ=2;local function closure() local andy=andy+1;return function() andy+=typ;return andy end end;local a,b=closure(),closure();print(a(),a(),b())",
  "local a=1;if a==1 then local a=2;print(a) elseif a==2 then local a=3;print(a) else local a=4;print(a) end;print(a)",
  "local _ENV={value=7};local value=3;print(_ENV.value,value)"
];
describe("generated runtime binding renaming", () => {
  for (const [i, source] of fixtures.entries()) it(`preserves trusted program ${i}`, () => expect(run(renameRuntimeBindings(source, 42))).toBe(run(source)));
  it("preserves every string byte and property name", () => {
    const literal = '"' + Array.from({ length: 256 }, (_, i) => "\\" + String(i).padStart(3, "0")).join("") + '"';
    const source = `local _pos=${literal};local t={_pos=_pos};print(#t._pos);for i=1,#t._pos do print(string.byte(t._pos,i)) end`;
    expect(run(renameRuntimeBindings(source, 7))).toBe(run(source));
  });
  it("preserves long literal newline normalization instead of replacing its bytes", () => {
    const source = "local x=[=[\n a  b\r\nc\n]=];print(#x,string.byte(x,7))";
    const output = renameRuntimeBindings(source, 42);
    expect(output.includes("\n")).toBe(false);
    expect(run(output)).toBe(run(source));
  });
  it("keeps free bindings and binding graph equal", () => {
    function graph(source) {
      const ast = parse(tokenize(source)), a = resolveBindings(ast);
      const uses = [];
      walk(ast, (n) => {
        if (n.kind === "NameExpr") uses.push(a.uses.get(n)?.id ?? n.name);
      });
      return uses;
    }
    for (const fixture of fixtures) expect(graph(renameRuntimeBindings(fixture, 42))).toEqual(graph(fixture));
  });
  it("is deterministic without consuming host randomness", () => {
    let calls = 0;
    const old = Math.random;
    Math.random = () => {
      calls++;
      return 0.1;
    };
    try {
      expect(renameRuntimeBindings(fixtures[0], 42)).toBe(renameRuntimeBindings(fixtures[0], 42));
      expect(calls).toBe(0);
    } finally {
      Math.random = old;
    }
  });
});
