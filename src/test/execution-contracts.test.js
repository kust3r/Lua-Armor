import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { obfuscateWithReport, obfuscateDiagnostic } from "../lib/obfuscator/engine";
import { tokenize } from "../lib/obfuscator/lexer";
import { compressedDataExpression } from "../lib/obfuscator/data-compression";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
const runtime = process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau";
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "lpy-contract-"));
  try {
    const file = join(dir, "test.luau");
    writeFileSync(file, source);
    return execFileSync(runtime, [file], { encoding: "utf8", timeout: 6e4 }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const options = (source) => ({ code: source, platform: "luau", optimizationLevel: 2, toggles: { intenseVm: true, gcFixes: true } });
const env = `local env=setmetatable({_G={},loadstring=false,load=false},{__index=getfenv(1)})`;
function inEnvironment(output, setup = "") {
  return `${env}
${setup}
local fn=assert(loadstring(${JSON.stringify(output)}));setfenv(fn,env);fn()`;
}
describe.skipIf(!existsSync(runtime))("execution contracts", () => {
  it("direct hybrid executes when the script environment has no dynamic compiler", () => {
    const source = `local x=2;local f=LPY_NO_VIRTUALIZE(function(v) x+=v;return x,nil,false end);print(f(3));print(f(4))`;
    const output = obfuscateWithReport(source, options(source)).output;
    expect(run(inEnvironment(output))).toBe("5	nil	false\n9	nil	false");
    const tokens = tokenize(output);
    expect(tokens.some((t) => t.value === "loadstring" || t.value === "load")).toBe(false);
  });
  it("direct mode cannot be changed by persisted source-compression packers", () => {
    const source = "print(42)";
    const output = obfuscateWithReport(source, { ...options(source), toggles: { packer: true, vmCompression: true } }).output;
    expect(run(inEnvironment(output))).toBe("42");
  });
  it("dynamic mode remains explicit and preserves the script environment", () => {
    const source = "print(marker)";
    const output = obfuscateWithReport(source, { ...options(source), execution: { loader: "dynamic" } }).output;
    expect(run(`local env=setmetatable({marker=71},{__index=getfenv(1)});local f=assert(loadstring(${JSON.stringify(output)}));setfenv(f,env);f()`)).toBe("71");
  });
  it("manual coroutine protocol is unchanged even with entry-thread yield consent", () => {
    const source = `local n=0;local c=coroutine.create(function() local x=0;for i=1,20000 do x+=i end;coroutine.yield(nil,false,x);n+=1;return false,nil,n end);local function emit(...) print(select('#',...),...) end;emit(coroutine.resume(c));print(coroutine.status(c),n);emit(coroutine.resume(c));print(coroutine.status(c),n)`;
    const expected = run(source);
    for (const cooperativeYield of [false, true]) {
      const out = obfuscateWithReport(source, { ...options(source), execution: { cooperativeYield } }).output;
      expect(run(inEnvironment(out, `local ticks=0;env.os={clock=function() ticks+=1;return ticks end};env.task={wait=function() error('unexpected scheduler wait',0) end}`))).toBe(expected);
    }
  });
  it("authorized invocation cleans up after error and preserves error identity and packed results", () => {
    const source = `local marker={};local f=LPY_NO_VIRTUALIZE(function(cb) return cb() end);local n=0;local function cb() n+=1;if n==1 then error(marker,0) end;coroutine.yield(nil,false);return nil,false,3,nil end;local ok,e=pcall(f,cb);print(ok,e==marker);local co=coroutine.create(function() return f(cb) end);local function emit(...) print(select('#',...),...) end;emit(coroutine.resume(co));emit(coroutine.resume(co));print(n)`;
    const expected = run(source.split("LPY_NO_VIRTUALIZE").join(""));
    const out = obfuscateWithReport(source, { ...options(source), execution: { cooperativeYield: true } }).output;
    expect(run(inEnvironment(out, `env.task={wait=function() error('unexpected wait',0) end}`))).toBe(expected);
  });
  it("intense VM no longer terminates a legitimate invocation after five million instructions", () => {
    const source = "local s=0;for i=1,1200000 do s+=i end;print(s)";
    const out = obfuscateWithReport(source, options(source)).output;
    expect(run(out)).toBe("720000600000");
  });
  it("instruction limit is emitted only through the diagnostic entry point", () => {
    const source = "local s=0;for i=1,1200000 do s+=i end;print(s)";
    const opts = { ...options(source), toggles: { diagnosticInstructionLimit: true, intenseVm: true } };
    expect(run(obfuscateWithReport(source, opts).output)).toBe("720000600000");
    const out = obfuscateDiagnostic(source, opts);
    const d = "{instructions=0,clockCalls=0,yields=0,yieldSeconds=0,protoSeconds=0,prototypes=0,vmEntries=0,nativeCalls=0,vmClosureCalls=0,initSeconds=0,nativeInclusiveSeconds=0,callOpcodes=0}";
    expect(run(`local f=assert(loadstring(${JSON.stringify(out)}));local ok,e=pcall(f,${d});print(ok,string.find(tostring(e),'5000000',1,true)~=nil)`)).toBe("false	true");
  });
  it("data compression roundtrips bytes and dictionary resets without compiling source", () => {
    let seed = 42;
    let source = "";
    for (let i = 0; i < 4e4; i++) {
      seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
      source += String.fromCharCode(seed % 256);
    }
    const bytes = '"' + Array.from(source, (c) => "\\" + c.charCodeAt(0).toString().padStart(3, "0")).join("") + '"';
    expect(run(`local expected=${bytes};local actual=${compressedDataExpression(source)};print(actual==expected,#actual)`)).toBe("true	40000");
  });
  it("surviving callbacks remain usable after repeated and failed parent invocations", () => {
    const source = `local callbacks={};local function make(v,fail) local x=v;callbacks[#callbacks+1]=function(n) x+=n;return x end;if fail then error('parent',0) end end;print(pcall(make,10,true));make(20,false);print(callbacks[1](1),callbacks[2](2),callbacks[1](3));make(30,false);print(callbacks[3](4),callbacks[2](5))`;
    const expected = run(source);
    for (const gcFixes of [false, true]) {
      const out = obfuscateWithReport(source, { ...options(source), toggles: { gcFixes }, execution: { cooperativeYield: true } }).output;
      expect(run(inEnvironment(out))).toBe(expected);
    }
  });
  it("builtin replacement never rewrites literal data that happens to spell builtin paths", () => {
    const source = `local value="math.floor string.byte setmetatable _G[key]";local f=LPY_NO_VIRTUALIZE(function() return value end);print(f())`;
    expect(run(obfuscateWithReport(source, options(source)).output)).toBe("math.floor string.byte setmetatable _G[key]");
  });
  it("same seed preserves output and GC changes real retained encrypted blocks", () => {
    const source = 'local x="payload-value";print(x,x)';
    const base = { ...options(source), nameConfig: { ...DEFAULT_NAME_CONFIG, seed: 42 } };
    const off = obfuscateWithReport(source, { ...base, toggles: { gcFixes: false } }).output;
    const on = obfuscateWithReport(source, { ...base, toggles: { gcFixes: true } }).output;
    expect(obfuscateWithReport(source, { ...base, toggles: { gcFixes: false } }).output).toBe(off);
    expect(run(off)).toBe("payload-value	payload-value");
    expect(run(on)).toBe(run(off));
    expect((on.match(/\[\w+\]=nil/g) || []).length).toBeGreaterThan((off.match(/\[\w+\]=nil/g) || []).length);
  });
  it("direct output keeps the one-line contract without fabricating removable line metadata", () => {
    const source = "print(73)";
    const base = { ...options(source), nameConfig: { ...DEFAULT_NAME_CONFIG, seed: 42 } };
    const output = obfuscateWithReport(source, base).output;
    expect(output.split("\n")).toHaveLength(1);
    expect(run(output)).toBe("73");
  });
  it("refuses encrypted-function macro in direct mode rather than inserting a hidden compiler", () => {
    const source = 'local key="' + "a".repeat(64) + '";local f=LPY_ENCFUNC(function() return 1 end,"' + "a".repeat(64) + '",key);print(f())';
    expect(() => obfuscateWithReport(source, options(source))).toThrow("UNSUPPORTED_DYNAMIC_MACRO");
  });
});
