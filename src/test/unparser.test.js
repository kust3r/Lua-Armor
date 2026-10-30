import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tokenize } from "../lib/obfuscator/lexer";
import { parse } from "../lib/obfuscator/parser";
import { astToLua } from "../lib/obfuscator/unparser";
import { obfuscate } from "../lib/obfuscator/engine";
import { resolveBindings } from "../lib/obfuscator/bindings";
import { flattenControlFlow } from "../lib/obfuscator/obfuscations/control-flow";
import { foldConstants } from "../lib/obfuscator/optimizer";
const luau = process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau";
function run(source, runtime = "/usr/bin/lua") {
  const dir = mkdtempSync(join(tmpdir(), "lpy-unparser-"));
  const file = join(dir, "case.lua");
  try {
    writeFileSync(file, source);
    return execFileSync(runtime, [file], { encoding: "utf8", timeout: 15e3 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const ast = (source) => parse(tokenize(source));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([k, v]) => !["span", "comments", "exact", "raw", "valueAtParse", "bytes"].includes(k) && v !== void 0).map(([k, v]) => [k, normalize(v)]));
  return value;
}
const cases = {
  precedence: 'local a,b,c=7,3,2;print(a-(b-c),a/(b/c),(a^b)^c,a^(b^c),-a^b,(-a)^b); print("a"..("b".."c"))',
  multireturn: 'local function f() return 1,nil,3 end; local function p(...) print(select("#",...),...) end; p(f());p((f()));p({f()}[1]);return (f())',
  results: 'local function f() return 1,nil,3 end;local function p(...) print(select("#",...),...) end;p(f());p((f()));local t={f()};p(t[1],t[2],t[3]);local u={(f())};p(u[1],u[2]);local a,b,c=f();p(a,b,c)',
  varargs: 'local function p(...) local t={...};print(select("#",...),t[1],t[2],t[3]);return (...) end;print(p(1,nil,3))',
  methods: "local n=0;local t={x=3};function t:m(v) self.x=self.x+v;return self.x end;local function receiver() n=n+1;return t end;print(receiver():m(4),n)",
  closures: "local x=1;local function f() return x end;do local x=x+3;print(x) end;local x=8;print(f(),x);local function fac(n) if n==0 then return 1 end return n*fac(n-1) end;print(fac(6))",
  repeat: "local n=0;repeat local inner=n+1;n=inner until inner==3;print(n)",
  effects: 'local trace={};local t=setmetatable({},{__index=function(_,k) trace[#trace+1]=k;return 4 end,__newindex=function(_,k,v) trace[#trace+1]=k..v end});t.b=t.a+2;print(table.concat(trace,","));local ok,e=pcall(function() error("failure",0) end);print(ok,e)',
  fields: 'local x=0;local t={named=2,["computed"]=3,4,5};for _,k in ipairs({"named","computed",1,2}) do print(k,t[k]) end',
  tokens: 'local a=1;local b=2;a=a- -b;print(a,1 .. "x");local t={};(function() t.x=7 end)();print(t.x)',
  bytes: 'local s="\\0001\\255\\128\\010\\013\\034\\092\xE9\u{1F600}";for i=1,#s do print(string.byte(s,i)) end'
};
delete cases.multireturn;
for (const mode of ["readable", "compact"]) describe(`unparser ${mode}`, () => {
  for (const [label, source] of Object.entries(cases)) it(label, () => {
    const input = ast(source);
    const result = astToLua(input, { target: "lua51", mode });
    expect(result.diagnostics).toEqual([]);
    expect(normalize(ast(result.code))).toEqual(normalize(input));
    expect(run(result.code)).toBe(run(source));
    if (mode === "compact") expect(result.code).not.toMatch(/[\r\n]/);
    expect(result.code).not.toMatch(/\\x[\da-fA-F]{2}|\\u\{/);
  });
});
describe("semantic AST and diagnostics", () => {
  it("preserves return adjustment and false conditional results", () => {
    const source = "local function f() return 1,2 end;return (f())";
    const node = ast(source).body[1];
    expect(node.kind === "Return" && node.exprs[0].kind).toBe("ParenExpr");
    const conditional = ast("return if true then false else 2").body[0];
    expect(conditional.kind === "Return" && conditional.exprs[0].kind).toBe("IfExpr");
  });
  it("preserves integer lexemes above 2^53", () => {
    const input = ast("return 9223372036854775807");
    expect(astToLua(input, { target: "lua54", mode: "compact" }).code).toContain("9223372036854775807");
    expect(() => obfuscate("return 9223372036854775807", { platform: "lua54", optimizationLevel: 1, toggles: {}, code: "" })).toThrow("UNSUPPORTED_VM_INTEGER");
  });
  it("preserves Lua long string normalization and decimal escapes", () => {
    const source = "local s=[=[\r\nhello\r\nworld]=];print(#s,s)";
    expect(run(astToLua(ast(source), { target: "lua51" }).code)).toBe(run(source));
    expect(tokenize('"\\0001"')[0].bytes).toEqual([0, 49]);
  });
  it("reports legacy VM target incompatibility instead of returning invalid syntax", () => {
    expect(() => obfuscate("print(1)", { platform: "lua51", optimizationLevel: 1, toggles: {}, code: "" })).toThrow("UNSUPPORTED_VM_TARGET");
  });
  it("does not mutate input or substitute macros in literal text", () => {
    const input = ast('local s="LPY_NO_VIRTUALIZE(function() end)";print(s)');
    const before = JSON.stringify(input);
    astToLua(input, { target: "lua51" });
    expect(JSON.stringify(input)).toBe(before);
  });
  it("does not silently accept unsupported extensions", () => {
    for (const s of ["return `x{1}`", "type T = number", "local x:number=2", "return x::number", "goto label", "::label::", "local x <close> = f()"]) expect(() => astToLua(ast(s), { target: "lua51" })).toThrow();
    expect(() => astToLua(ast("continue"), { target: "lua51" })).toThrow("UNSUPPORTED_FEATURE");
    expect(() => astToLua(ast("return 1//2"), { target: "lua51" })).toThrow("integer division");
    expect(() => astToLua(ast("return 1&2"), { target: "luau" })).toThrow("bitwise");
    expect(() => astToLua({ kind: "Block", body: [{ kind: "Alien" }] })).toThrow("UNKNOWN_NODE");
    expect(() => astToLua(ast("break"), { target: "lua51" })).toThrow("INVALID_LOOP_CONTROL");
  });
  it("resolves declaration-point scope by binding identity", () => {
    const a = ast("local x=2;do local x=x+1;print(x) end;print(x)");
    const r = resolveBindings(a);
    expect(r.bindings).toHaveLength(2);
    expect(r.bindings[0].id).not.toBe(r.bindings[1].id);
    const d = a.body[1];
    if (d.kind !== "DoBlock") throw new Error();
    const local = d.body.body[0];
    if (local.kind !== "LocalDecl") throw new Error();
    const rhs = local.exprs[0];
    if (rhs.kind !== "BinOp") throw new Error();
    expect(r.uses.get(rhs.left)?.id).toBe(0);
  });
  it("does not hoist shadowed lexical declarations", () => {
    const input = ast(cases.closures + ';if true then print("end") end');
    expect(flattenControlFlow(input)).toBe(input);
  });
  it("does not expand a call after boolean constant folding", () => {
    const input = ast("return true and f()").body[0];
    if (input.kind !== "Return") throw new Error();
    expect(foldConstants(input.exprs[0]).kind).toBe("ParenExpr");
  });
});
describe.skipIf(!existsSync(luau))("Luau differential and hybrid boundaries", () => {
  const hybridCases = {
    writes: "local x=1;local n=LPY_NO_VIRTUALIZE(function(a) x=x+a;return x,nil,false end);print(n(4));print(x);x=10;print(n(1))",
    bothDirections: "local x=1;local make=LPY_NO_VIRTUALIZE(function(n) local y=n;return function(v) y=y+v;x=x+y;return y,x end end);local f=make(2);print(f(3));print(f(4));print(x)",
    recursion: "local f;f=LPY_NO_VIRTUALIZE(function(n) if n==0 then return 1 end return n*f(n-1) end);print(f(6))",
    nestedNative: "local f=LPY_NO_VIRTUALIZE(function(a) local x=a;return LPY_NO_VIRTUALIZE(function(b) x=x+b;return x end) end);local g=f(2);print(g(3),g(4))",
    swap: "local a,b=1,2;local f=LPY_NO_VIRTUALIZE(function() a,b=b,a;return a,b end);print(f());print(a,b)",
    independent: "local make=LPY_NO_VIRTUALIZE(function(n) return function() n=n+1;return n end end);local a,b=make(1),make(10);print(a(),b(),a())",
    shadow: "local x=7;local f=LPY_NO_VIRTUALIZE(function() local x=x+1;do local x=x+1;print(x) end;return x end);print(f(),x)",
    close: "local f,g;do local x=1;f=LPY_NO_VIRTUALIZE(function() x=x+1;return x end) end;do local x=10;g=function() x=x+1;return x end end;print(f(),g(),f())",
    yield: "local x=0;local f=LPY_NO_VIRTUALIZE(function() x=1;coroutine.yield(4);x=2;return x end);local c=coroutine.create(f);print(coroutine.resume(c));print(x);print(coroutine.resume(c));print(x)",
    condition: "local a=if true then false else 2;local b=if true then nil else 3;print(a,b)",
    result: "local function f() return 1,nil,3 end;local a,b,c=f();print(a,b,c);a,b,c=(f());print(a,b,c)",
    repeat: cases.repeat,
    utf8bytes: cases.bytes,
    localInit: "local x=8;local f=LPY_NO_VIRTUALIZE(function() local x=x+1;return x end);print(f(),x)",
    repeatClosure: "local t={};local n=0;repeat local v=n;n=n+1;t[n]=LPY_NO_VIRTUALIZE(function() return v end) until n==3;print(t[1](),t[2](),t[3]())",
    reentrant: "local f;local n=0;f=LPY_NO_VIRTUALIZE(function(x) n=n+1;if x>0 then return f(x-1) end;return n end);print(f(4),n)",
    nilfalse: "local x=false;local f=LPY_NO_VIRTUALIZE(function(v) x=v;return x end);print(f(nil),x);print(f(false),x)",
    assignExpansion: "local function f() return 1,nil,3 end;local a,b,c;a,b,c=f();print(a,b,c);local n=0;local function effect() n=n+1;return 4 end;a=2,effect();print(a,n)",
    tableAddress: "local i=1;local t={};i,t[i]=2,7;print(i,t[1],t[2])",
    loopCaptures: "local t={};for i=1,3 do t[i]=LPY_NO_VIRTUALIZE(function() return i end) end;print(t[1](),t[2](),t[3]())",
    genericCaptures: "local t={};for i,v in ipairs({4,5,6}) do t[i]=LPY_NO_VIRTUALIZE(function() return v end) end;print(t[1](),t[2](),t[3]())",
    nativeLoop: "local f=LPY_NO_VIRTUALIZE(function() local t={};for i=1,3 do t[i]=function() return i end end;return t end);local t=f();print(t[1](),t[2](),t[3]())",
    nativeLocalRecursion: "local f=LPY_NO_VIRTUALIZE(function(n) local function rec(a) if a==0 then return 1 end;return a*rec(a-1) end;return rec(n) end);print(f(6))"
  };
  for (const [label, source] of Object.entries(hybridCases)) it(label, () => {
    const original = source.split("LPY_NO_VIRTUALIZE").join("");
    const expected = run(original, luau);
    for (const level of [1, 2, 3]) {
      const output = obfuscate(source, { platform: "luau", optimizationLevel: level, toggles: {}, code: source });
      expect(run(output, luau)).toBe(expected);
    }
  }, 6e4);
  it("preserves final production restrictions with native output", () => {
    const source = 'local f=LPY_NO_VIRTUALIZE(function() return "Roblox", "string.byte", "\\255" end);print(f())';
    const output = obfuscate(source, { platform: "luau", optimizationLevel: 2, toggles: { gcFixes: true }, code: source });
    expect(output.startsWith("return(function(")).toBe(true);
    expect(output).not.toMatch(/[\r\n]/);
    expect(output).not.toContain("Roblox");
    expect(output).not.toMatch(/\\x[\da-fA-F]{2}|\\u\{/);
    expect(run(output, luau)).toBe(run(source.split("LPY_NO_VIRTUALIZE").join(""), luau));
  });
  it("compiles both Luau output modes with official compiler", () => {
    const source = "local n=0;while n<3 do n+=1;if n==2 then continue end;print(if n==3 then false else n) end";
    for (const mode of ["readable", "compact"]) {
      const output = astToLua(ast(source), { target: "luau", mode }).code;
      expect(run(output, luau)).toBe(run(source, luau));
      const dir = mkdtempSync(join(tmpdir(), "lpy-compile-"));
      try {
        const f = join(dir, "case.luau");
        writeFileSync(f, output);
        execFileSync("/tmp/lurapy-runtimes/luau-compile", [f], { stdio: "pipe" });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });
});
describe("seeded generated ASTs", () => {
  for (const seed of [1, 42, 91357]) it(`seed ${seed}`, () => {
    let state = seed;
    const next = () => {
      state = Math.imul(state, 1664525) + 1013904223 >>> 0;
      return state;
    };
    const expr = (depth) => depth === 0 ? { kind: "NumberLit", value: next() % 9 + 1 } : { kind: "BinOp", op: ["+", "-", "*", "^"][next() % 4], left: expr(depth - 1), right: { kind: "NumberLit", value: next() % 3 + 1 } };
    for (let i = 0; i < 12; i++) {
      const n = { kind: "Block", body: [{ kind: "ExprStmt", expr: { kind: "Call", func: { kind: "NameExpr", name: "print" }, args: [expr(3)] } }] };
      const a = astToLua(n, { target: "lua51", mode: "readable" }).code, b = astToLua(n, { target: "lua51", mode: "compact" }).code;
      expect(run(a)).toBe(run(b));
    }
  });
});
