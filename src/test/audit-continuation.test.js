import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { obfuscateWithReport, validateLuaSyntax } from "../lib/obfuscator/engine";
import { tokenize } from "../lib/obfuscator/lexer";
import { parse } from "../lib/obfuscator/parser";
import { astToLua } from "../lib/obfuscator/unparser";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
import { validateArtifactContract } from "../lib/obfuscator/output-contract";
import { emitWordData } from "../lib/obfuscator/word-data";
import { compressedDataExpression } from "../lib/obfuscator/data-compression";
const runtime = process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau";
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "lpy-continuation-"));
  try {
    const path = join(dir, "case.luau");
    writeFileSync(path, source);
    return execFileSync(runtime, [path], { encoding: "utf8" }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const options = (code, level = 2, seed = 42, gcFixes = true) => ({ code, platform: "luau", optimizationLevel: level, toggles: { intenseVm: true, gcFixes }, nameConfig: { ...DEFAULT_NAME_CONFIG, seed } });
const literal = (bytes) => '"' + bytes.map((n) => "\\" + String(n).padStart(3, "0")).join("") + '"';
describe("continued audit differentials", () => {
  for (const level of [1, 2, 3]) for (const gcFixes of [false, true]) it(`preserves every byte through engine/native cache and late callbacks L${level} GC=${gcFixes}`, () => {
    const bytes = [...Array.from({ length: 256 }, (_, i) => i), ...Array.from('"\\]=]\r\n[[\\xFF', (c) => c.charCodeAt(0))];
    const source = `local payload=${literal(bytes)};local shared=payload;local f=LPY_NO_VIRTUALIZE(function() return shared end);local callbacks={};for i=1,3 do local index=i;callbacks[i]=function() local x=f();assert(x==payload);local n=0;for j=1,#x do n+=string.byte(x,j)*j end;return #x,n,index,nil,false end end;register(callbacks);print(payload==f())`;
    const host = `local stored;function register(x) stored=x end;`;
    const tail = `;for i=3,1,-1 do local function emit(...) print(select('#',...),...) end;emit(stored[i]());emit(stored[i]()) end`;
    const expected = run(host + source.split("LPY_NO_VIRTUALIZE").join("") + tail);
    const report = obfuscateWithReport(source, options(source, level, 7, gcFixes));
    expect(report.usedLevel).toBe(level);
    expect(run(host + "local function entry(...) " + report.output + " end;entry()" + tail)).toBe(expected);
  });
  it("keeps close/jump cells and same-iteration sharing across native/VM after main returns", () => {
    const source = `local read,write={},{};for i=1,5 do local x=i;read[i]=function() return x end;write[i]=LPY_NO_VIRTUALIZE(function(v) x=v end);if i==2 then continue end;if i==4 then break end end;do local x=99;assert(x==99) end;register(read,write)`;
    const host = `local r,w;function register(a,b) r,w=a,b end;`;
    const tail = `;w[2](false);w[3](nil);print(r[1](),r[2](),r[3](),r[4](),r[5]==nil);w[1](18);print(r[1](),r[4]())`;
    const expected = run(host + source.split("LPY_NO_VIRTUALIZE").join("") + tail);
    for (const level of [1, 2, 3]) expect(run(host + "local function entry(...) " + obfuscateWithReport(source, options(source, level)).output + " end;entry()" + tail)).toBe(expected);
  });
  for (const loader of ["direct", "dynamic"]) it(`audits internal identifiers in every final ${loader} layer`, () => {
    const source = 'local x="cache";print(x)';
    const out = obfuscateWithReport(source, { ...options(source), execution: { loader } }).output;
    validateArtifactContract(out);
    const identifiers = new Set(tokenize(out).filter((t) => t.type === "ident").map((t) => t.value));
    for (const fixed of ["_idx", "_pos", "_protoCache", "_captureLayouts"]) expect(identifiers.has(fixed)).toBe(false);
    expect(run(out)).toBe("cache");
  });
  it("preserves user properties and free names that match helper spellings", () => {
    const source = "local t={_idx=1,_pos=2,_protoCache=3,_captureLayouts=4};print(t._idx,t._pos,t._protoCache,t._captureLayouts,_idx)";
    expect(run("local _idx=9;" + source)).toBe("1	2	3	4	9");
    expect(run("_idx=9;" + obfuscateWithReport(source, options(source)).output)).toBe("1	2	3	4	9");
  });
  it("restores interpolation frames after nested closures, consecutive parses and rejected input", () => {
    const source = 'local n=0;local function f() n+=1;return n,nil,false end;print(`A{`B{({["}"]=f()})["}"]}`}C`, `{f()}`,n);print(`next{false}`,f())';
    const expected = run(source);
    for (let repeat = 0; repeat < 3; repeat++) {
      expect(validateLuaSyntax("return `{`bad{}`}`").valid).toBe(false);
      const tokens = tokenize(source);
      expect(run(astToLua(parse(tokens), { target: "luau", mode: "compact" }).code)).toBe(expected);
      expect(run(astToLua(parse(tokens), { target: "luau", mode: "readable" }).code)).toBe(expected);
      expect(run(obfuscateWithReport(source, options(source)).output)).toBe(expected);
    }
  });
  it("does not pretend to strip host line metadata in direct source", () => {
    const source = "local function f()\n return 3\nend\nregister(f)";
    const base = options(source);
    const output = obfuscateWithReport(source, base).output;
    const inspect = `local stored;function register(f) stored=f end;local function entry(...) ${output} end;entry();local line=debug.info(stored,'l');print(type(line),line>=0,stored())`;
    expect(run(inspect)).toBe("number	true	3");
  });
  it("rejects malformed compressed data before returning decoded words", () => {
    for (const bytes of [[128], [128, 0], [255, 255, 255, 255, 127], [0, 0]]) {
      const valid = emitWordData([0], "words", "payload");
      const expression = compressedDataExpression(String.fromCharCode(0));
      const poisoned = valid.replace(expression, literal(bytes));
      expect(poisoned).not.toBe(valid);
      expect(run(`local ok=pcall(function() ${poisoned} end);print(ok)`)).toBe("false");
    }
  });
});
