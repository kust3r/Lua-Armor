import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { obfuscateWithReport } from "../lib/obfuscator/engine";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
import { compile } from "../lib/obfuscator/compiler";
import { parse } from "../lib/obfuscator/parser";
import { tokenize } from "../lib/obfuscator/lexer";
import { generateHardenedVM } from "../lib/obfuscator/hardened-v4";
import { withRandomDomains } from "../lib/obfuscator/generation-random";
import { quoteBytes } from "../lib/obfuscator/literal-values";

const runtime = process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau";
const run = (code) => {
  const dir = mkdtempSync(join(tmpdir(), "v43-functional-"));
  try {
    const file = join(dir, "main.luau");
    writeFileSync(file, code);
    return execFileSync(runtime, [file], { encoding: "utf8", timeout: 2e4 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const options = (code, seed = 42) => ({
  code,
  platform: "luau",
  optimizationLevel: 3,
  hardenedVmVersion: 4,
  toggles: {},
  nameConfig: { ...DEFAULT_NAME_CONFIG, seed }
});

const cases = {
  conditionals: 'local a=3;if a<4 then print("yes") else print("no") end;print(a==3,a~=4,a>1)',
  loops: 'local s=0;for i=1,8 do if i==7 then break end;if i%2==0 then continue end;s=s+i end;local j=0;repeat j=j+1;if j<3 then continue end;s=s+j until j==4;while j>0 do j=j-1 end;print(s,j)',
  joins: 'local a,b=3,4;for i=1,6 do if i%2==0 then a,b=b,a else a=a+1 end end;print(a,b)',
  methods: 'local t={n=4};function t:add(x) self.n=self.n+x;return self.n,nil,false end;print(t:add(3));print(t.n)',
  cells: 'local function make() local n=0;return function() n=n+1;return n end,function() return n end end;local a,b=make();print(a(),b(),a(),b())',
  closures: 'local t={};for i=1,3 do local n=i;t[i]=function() n=n+10;return n end end;print(t[1](),t[2](),t[1](),t[3]())',
  recursive: 'local function f(n) if n<2 then return 1 end;return n*f(n-1) end;print(f(7))',
  varargs: 'local function f(...) return ... end;local a,b,c,d=f(9,nil,false,nil);print(select("#",f(9,nil,false,nil)),a,b,c,d)',
  metamethods: 'local trace={};local t=setmetatable({}, {__index=function(_,k) trace[#trace+1]="r"..k;return 4 end,__newindex=function(_,k,v) trace[#trace+1]="w"..k..v end,__add=function() trace[#trace+1]="add";return 7 end});t.x=3;print(t.y,t+t,table.concat(trace,","))',
  genericFor: 'local s=0;for k,v in ipairs({2,4,6}) do s=s+k*v end;print(s)',
  concat: 'local t=setmetatable({}, {__concat=function() return "X" end});print("a"..t.."b",1 .. "z")',
  coroutine: 'local co=coroutine.create(function(a) local n=2;local b=coroutine.yield(a,n);return b,n+1,nil end);print(coroutine.resume(co,"first"));print(coroutine.resume(co,"last"))',
  numericFor: 'for i=3,1,-1 do print(i) end;for i=1,0 do print("bad") end;for i=1,1 do print(i) end',
  tableCall: 'local t={f=function() print("called") end};t.f();local a,b=3,4;print(a+b)',
  tax: 'local function tax(n) if n<=1000 then return n*0.1 elseif n<=5000 then return 100+(n-1000)*0.2 else return 900+(n-5000)*0.3 end end;print(tax(500),tax(3000),tax(8000))',
  environment: 'local function f() return value end;setfenv(f,{value=73});print(f())'
};

describe("Hardened VM v4.3", () => {
  for (const seed of [7, 42, 1337]) for (const [name, code] of Object.entries(cases)) {
    it.skipIf(!existsSync(runtime))(`${name} seed ${seed} preserves observable behavior`, () => {
      expect(run(obfuscateWithReport(code, options(code, seed)).output)).toBe(run(code));
    });
  }

  it("emits 12 materializers with four loop structures", () => withRandomDomains(42, () => {
    const source = 'print("alpha","bravo","charlie",17,29)';
    const compiled = compile(parse(tokenize(source)), [], false, "luau", { wholeStringLiterals: true });
    const generated = generateHardenedVM(compiled.proto, compiled.opcodes);
    expect(generated.stats.revision).toBe(3);
    expect(generated.code).not.toContain("table.concat");
    expect(generated.code).toContain("for i=1,#v do");
    expect(generated.code).toContain("repeat ");
    expect(generated.code).toContain("while i>=1 do local u=");
    expect(generated.stats.materializers).toHaveLength(12);
    expect(generated.stats.materializers.reduce((sum, count) => sum + count, 0)).toBe(generated.stats.capsules);
  }));

  it.skipIf(!existsSync(runtime))("keeps decoded values out of generic string hooks", () => withRandomDomains(42, () => {
    const source = 'print("this-is-a-long-application-literal","another-long-secret-value")';
    const compiled = compile(parse(tokenize(source)), [], false, "luau", { wholeStringLiterals: true });
    const generated = generateHardenedVM(compiled.proto, compiled.opcodes);
    const hooked = `local seen={};local proxy={};for k,v in string do proxy[k]=v end;local oc,os,of=proxy.char,proxy.sub,proxy.format;proxy.char=function(...)local s=oc(...);seen[#seen+1]=s;return s end;proxy.sub=function(...)local s=os(...);seen[#seen+1]=s;return s end;proxy.format=function(...)local s=of(...);seen[#seen+1]=s;return s end;local function execute(...)${generated.code}end;local base=getfenv();local env=setmetatable({string=proxy},{__index=base});setfenv(execute,env);execute();local longest=0;for _,s in ipairs(seen)do longest=math.max(longest,#s)end;print("HOOK_MAX",longest)`;
    expect(run(hooked)).toContain("HOOK_MAX\t1");
  }));

  it.skipIf(!existsSync(runtime))("rejects a one-byte capsule edit", () => withRandomDomains(42, () => {
    const source = 'print("KONTRA-integrity-probe")';
    const compiled = compile(parse(tokenize(source)), [], false, "luau", { wholeStringLiterals: true });
    const generated = generateHardenedVM(compiled.proto, compiled.opcodes);
    expect(run(generated.code)).toContain("KONTRA-integrity-probe");
    const tableStart = generated.code.indexOf("local J=");
    const tableEnd = generated.code.indexOf(";local fn", tableStart);
    expect(tableStart).toBeGreaterThan(-1);
    expect(tableEnd).toBeGreaterThan(tableStart);
    const tableSource = generated.code.slice(tableStart, tableEnd);
    const escapedByte = tableSource.match(/\\(\d{3})/);
    expect(escapedByte).not.toBeNull();
    const original = escapedByte[0];
    const changed = `\\${String((Number(escapedByte[1]) + 1) % 256).padStart(3, "0")}`;
    const changedTable = tableSource.replace(original, changed);
    const corrupted = generated.code.slice(0, tableStart) + changedTable + generated.code.slice(tableEnd);
    expect(() => run(corrupted)).toThrow(/E_INTEGRITY/);
  }));

  it.skipIf(!existsSync(runtime))("rejects a one-byte edit in the final emitted application string", () => {
    const literal = "KONTRA-integrity-probe";
    const source = `print(${JSON.stringify(literal)})`;
    const output = obfuscateWithReport(source, options(source)).output;
    expect(run(output)).toContain(literal);
    const candidate = tokenize(output).find((token) => token.type === "string" && token.bytes?.length === literal.length && token.bytes.some((byte) => byte < 32 || byte > 126));
    expect(candidate).toBeDefined();
    const changedBytes = [...candidate.bytes];
    changedBytes[0] = (changedBytes[0] + 1) % 256;
    const corrupted = output.slice(0, candidate.span.start) + quoteBytes(changedBytes) + output.slice(candidate.span.end);
    expect(() => run(corrupted)).toThrow(/E_INTEGRITY/);
  });

  it("couples repeated constants to the region sequence", () => withRandomDomains(42, () => {
    const source = 'print("shared-value","shared-value","shared-value")';
    const compiled = compile(parse(tokenize(source)), [], false, "luau", { wholeStringLiterals: true });
    const generated = generateHardenedVM(compiled.proto, compiled.opcodes);
    expect(generated.stats.capsuleReuses).toBeGreaterThan(0);
    expect(generated.code).not.toMatch(/D\d+\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*,[^)]*,[^)]*,[^)]*,[^)]*\)/);
    expect(generated.code).toMatch(/D\d+\(F,F\[\d+\]\[F\[\d+\]\[\(F\[\d+\]\*\d+\+\d+\)%16777216\]\]\)/);
    expect(generated.code).toContain("E_INTEGRITY");
  }));

  it("removes the legacy public state-directory signature", () => {
    const source = 'local x="state-bound-value";if #x>3 then print(x) end';
    const output = obfuscateWithReport(source, options(source)).output;
    expect(output).not.toMatch(/local\s+\w+=\{\[0\]=\([^}]{100,}\[100\]=\(/);
    expect(output).not.toMatch(/\[137\]=\([^)]*[+*-][^)]*\)\}/);
    expect(output).not.toContain("state-bound-value");
  });

  it("records the promoted revision in generation metadata", () => {
    const source = 'print("metadata")';
    const report = obfuscateWithReport(source, options(source));
    expect(report.metadata).toMatchObject({
      engineVersion: "2026.10.hardened-v4.3",
      hardenedVmVersion: 4,
      hardenedVmRevision: 3,
      usedLevel: 3
    });
  });
});
