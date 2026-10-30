import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emitPositionDecoder, encodePositions } from "../lib/obfuscator/position-codec";
import { byteStringAccumulator } from "../lib/obfuscator/string-assembly";
import { compressedDataExpression } from "../lib/obfuscator/data-compression";
import { validateArtifactContract } from "../lib/obfuscator/output-contract";
import { configureNames, shortName, randomShortName } from "../lib/obfuscator/names";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "audit-runtime-"));
  try {
    const file = join(dir, "case.luau");
    writeFileSync(file, source);
    return execFileSync(process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau", [file], { encoding: "utf8" }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
describe("audit runtime safety", () => {
  for (const version of [1, 2]) it(`v${version} validates entire map before touching constants`, () => {
    const decoder = emitPositionDecoder("!~!!", 2, 100, "constants", "getter", version);
    expect(run(`local constants={};local calls=0;local function getter(i) calls+=1;return i end;local ok=pcall(function() ${decoder} end);print(ok,calls,next(constants)==nil)`)).toBe("false	0	true");
  });
  for (const version of [1, 2]) it(`v${version} exact positions across 512-byte segments`, () => {
    const positions = Array.from({ length: 1100 }, (_, i) => (i + 1) * 2);
    const decoder = emitPositionDecoder(encodePositions(positions, version), positions.length, 2200, "c", "g", version);
    expect(run(`local c={};local function g(i) return i end;${decoder}for i=1,1100 do assert(c[i*2]==i) end;print(c[2200])`)).toBe("1100");
  });
  for (const count of [0, 1, 127, 128, 129, 511, 512, 513, 2e4]) it(`block assembly preserves ${count} arbitrary bytes`, () => {
    const a = byteStringAccumulator("result");
    expect(run(`${a.setup}for i=1,${count} do ${a.append("string.char((i-1)%256)")} end;${a.finish}for i=1,#result do assert(string.byte(result,i)==(i-1)%256) end;print(#result)`)).toBe(String(count));
  });
  it("data compression crosses dictionary resets with high-byte pseudorandom input", () => {
    let seed = 42, source = "";
    for (let i = 0; i < 5e4; i++) {
      seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
      source += String.fromCharCode(seed >>> 24);
    }
    const literal = '"' + Array.from(source, (c) => "\\" + String(c.charCodeAt(0)).padStart(3, "0")).join("") + '"';
    expect(run(`local a=${literal};local b=${compressedDataExpression(source)};print(a==b,#b)`)).toBe("true	50000");
  });
  it("rejects lexical string escapes but accepts hex integer and literal backslash-x bytes", () => {
    expect(() => validateArtifactContract("return 0x62")).not.toThrow();
    expect(() => validateArtifactContract('return "\\\\x62"')).not.toThrow();
    for (const code of ['return "\\x62"', 'return "\\u{62}"', 'return "\\12"', 'return "Roblox"', "return 1\n"]) expect(() => validateArtifactContract(code)).toThrow();
  });
  it("allocates 3000 unique valid pool names, including random aliases", () => {
    configureNames({ ...DEFAULT_NAME_CONFIG, charset: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", seed: 42 });
    const values = Array.from({ length: 3e3 }, (_, i) => i % 2 ? shortName() : randomShortName());
    expect(new Set(values).size).toBe(3e3);
    for (const v of values) expect(v).toMatch(/^[A-Za-z_][A-Za-z_0-9]*$/);
  });
});
