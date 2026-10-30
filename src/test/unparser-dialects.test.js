import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { regenerateSource } from "../lib/obfuscator/source-emission";
import { tokenize } from "../lib/obfuscator/lexer";
import { parse } from "../lib/obfuscator/parser";
import { astToLua } from "../lib/obfuscator/unparser";
const root = process.env.LUA_TEST_ROOT ?? "/tmp/lurapy-runtimes";
const runtimes = [
  { target: "lua51", bin: process.env.LUA51_BIN ?? "/usr/bin/lua", compiler: process.env.LUAC51_BIN ?? "/usr/bin/luac" },
  ...["5.2.4", "5.3.6", "5.4.8"].map((v, i) => ({ target: ["lua52", "lua53", "lua54"][i], bin: `${root}/lua-src/lua-${v}/src/lua`, compiler: `${root}/lua-src/lua-${v}/src/luac` })),
  { target: "luajit", bin: process.env.LUAJIT_BIN ?? `${root}/LuaJIT-2.1/src/luajit` },
  { target: "luau", bin: process.env.LUAU_BIN ?? `${root}/luau`, compiler: process.env.LUAU_COMPILER ?? `${root}/luau-compile` }
];
function run(bin, source, compiler, target) {
  const dir = mkdtempSync(join(tmpdir(), "lpy-dialect-"));
  try {
    const file = join(dir, "case.lua");
    writeFileSync(file, source);
    if (compiler) execFileSync(compiler, target === "luau" ? ["--null", file] : ["-p", file], { stdio: "pipe", timeout: 15e3 });
    if (target === "luajit") execFileSync(bin, ["-b", file, join(dir, "case.bc")], { stdio: "pipe", env: { ...process.env, LUA_PATH: `${root}/LuaJIT-2.1/src/?.lua;;` }, timeout: 15e3 });
    return execFileSync(bin, [file], { encoding: "utf8", timeout: 15e3 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const core = 'local function f(...) return ... end;local a,b,c=f(2,nil,4);local t={name="\xE9",["key"]=3,f(a,b,c)};local x=0;repeat local y=x+1;x=y until y==3;print(a,b,c,t[3],t.name,x);local function g(n) if n==0 then return 1 end return n*g(n-1) end;print(g(5))';
for (const runtime of runtimes) describe.skipIf(!existsSync(runtime.bin))(`official ${runtime.target}`, () => {
  for (const mode of ["readable", "compact"]) it(`core ${mode}`, () => {
    const emitted = regenerateSource(core, { target: runtime.target, mode }).code;
    expect(run(runtime.bin, emitted, runtime.compiler, runtime.target)).toBe(run(runtime.bin, core));
  });
  if (runtime.target === "lua53" || runtime.target === "lua54") for (const source of [
    "local n=9223372036854775807;print(n,n-1,math.type(n));print(0xFFFFFFFFFFFFFFFF,1.0,math.type(1.0))",
    'local a,b=17,3;print(a&b,a|b,a~b,a<<b,a>>b,~a,a//b);local x=1;print(x.."x")'
  ]) it(`integer/bitwise ${source.slice(0, 24)}`, () => {
    for (const mode of ["readable", "compact"]) expect(run(runtime.bin, regenerateSource(source, { target: runtime.target, mode }).code, runtime.compiler, runtime.target)).toBe(run(runtime.bin, source));
  });
});
describe("comments, stale literals and semantic grouping", () => {
  it("retains comments only when explicitly requested and rejects compiler directives", () => {
    const source = "-- retained\nlocal x=1;print(x)";
    expect(regenerateSource(source, { target: "lua51", comments: true }).code).toContain("-- retained");
    expect(regenerateSource(source, { target: "lua51" }).code).not.toContain("--");
    expect(() => regenerateSource("--!native\nprint(1)", { target: "luau" })).toThrow("UNSUPPORTED_DIRECTIVE");
  });
  it("does not reuse stale string or number metadata", () => {
    const input = parse(tokenize('return "old",9223372036854775807'));
    const ret = input.body[0];
    if (ret.kind !== "Return") throw new Error();
    const str = ret.exprs[0], num = ret.exprs[1];
    if (str.kind !== "StringLit" || num.kind !== "NumberLit") throw new Error();
    str.value = "new";
    num.value = 7;
    const output = astToLua(input, { target: "lua54", mode: "compact" }).code;
    const again = parse(tokenize(output)).body[0];
    if (again.kind !== "Return") throw new Error();
    expect(again.exprs[0]).toMatchObject({ kind: "StringLit", value: "new" });
    expect(again.exprs[1]).toMatchObject({ kind: "NumberLit", value: 7 });
  });
  it("parenthesizes transformed exponent bases and unary operands", () => {
    const base = parse(tokenize("print(1)"));
    const stmt = base.body[0];
    if (stmt.kind !== "ExprStmt" || stmt.expr.kind !== "Call") throw new Error();
    stmt.expr.args = [{ kind: "BinOp", op: "^", left: { kind: "UnOp", op: "-", expr: { kind: "NumberLit", value: 2 } }, right: { kind: "NumberLit", value: 2 } }];
    expect(run("/usr/bin/lua", astToLua(base, { target: "lua51", mode: "compact" }).code)).toBe("4\n");
  });
});
