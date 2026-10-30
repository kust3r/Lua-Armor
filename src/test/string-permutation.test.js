import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { permutationWidth, packStringPermutation, unpackStringPermutation, emitStringPermutationDecoder } from "../lib/obfuscator/string-permutation";
import { obfuscateWithReport } from "../lib/obfuscator/engine";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
const alphabet = "!#$%&()*+,-./0369258147:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^abcdefghijklmnopqrstuvwxyz";
function run(code) {
  const dir = mkdtempSync(join(tmpdir(), "permutation-"));
  try {
    const file = join(dir, "case.luau");
    writeFileSync(file, code);
    return spawnSync(process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau", [file], { encoding: "utf8", timeout: 2e4 });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}
function shuffled(count) {
  const values = Array.from({ length: count }, (_, i) => i + 1);
  let state = 42;
  for (let i = count - 1; i > 0; i--) {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    const j = state % (i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
const names = { packed: "packed", table: "strings", permutation: "perm", cursor: "i", digit: "n", lut: "lut" };
function decoderCase(data, count, suffix) {
  return `local alphabet=${JSON.stringify(alphabet)};local lut={};for i=1,85 do lut[string.byte(alphabet,i)]=i-1 end;local packed=${JSON.stringify(data)};local strings=table.create(${count},true);` + emitStringPermutationDecoder(count, names) + suffix;
}
describe("minimum-width inverse string permutation", () => {
  for (const [count, width] of [[0, 1], [1, 1], [84, 1], [85, 2], [810, 2], [7224, 2], [7225, 3]]) {
    it(`round-trips ${count} indices with width ${width}, including emitted Luau`, () => {
      expect(permutationWidth(count)).toBe(width);
      const values = shuffled(count), packed = packStringPermutation(values, alphabet);
      expect(packed.data.length).toBe(count * width);
      expect(unpackStringPermutation(packed.data, alphabet, count)).toEqual(values);
      const result = run(decoderCase(packed.data, count, `local expected={${values.join(",")}};assert(#perm==${count});for i=1,#expected do assert(perm[i]==expected[i]) end;print('OK')`));
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe("OK");
    });
  }
  it("uses the supplied shuffled alphabet without RNG", () => {
    const alternate = alphabet.slice(13) + alphabet.slice(0, 13), values = shuffled(810);
    const packed = packStringPermutation(values, alternate);
    expect(unpackStringPermutation(packed.data, alternate, 810)).toEqual(values);
    expect(packed.data.length).toBe(1620);
  });
  for (const values of [[0], [2], [1, 1]]) it(`rejects invalid encoder indices ${values}`, () => expect(() => packStringPermutation(values, alphabet)).toThrow());
  for (const [label, data, count] of [["length", "!", 2], ["zero", "!", 1], ["range", "#", 1], ["digit", "~", 1]]) it(`rejects malformed runtime map: ${label}`, () => {
    const actual = label === "range" ? alphabet[2] : data;
    const result = run(decoderCase(actual, count, 'print("USER_EFFECT")'));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("E_INTEGRITY");
    expect(result.stdout).not.toContain("USER_EFFECT");
  });
  for (const gcFixes of [false, true]) it(`preserves empty/binary/long fragmented strings and cache, GC=${gcFixes}`, () => {
    const code = 'local values={"","\\000\\255A\\128","' + "fragment-long-".repeat(120) + '"};for pass=1,2 do for i=1,#values do local s=values[i];local sum=0;for j=1,#s do sum+=string.byte(s,j) end;print(i,#s,sum) end end';
    const options = { code, platform: "luau", optimizationLevel: 3, toggles: { gcFixes, intenseVm: true }, execution: { loader: "direct" }, nameConfig: { ...DEFAULT_NAME_CONFIG, seed: 42 } };
    const a = obfuscateWithReport(code, options), b = obfuscateWithReport(code, options);
    expect(a.usedLevel).toBe(3);
    expect(a.output).toBe(b.output);
    const original = run(code), result = run(a.output);
    expect(original.status, original.stderr).toBe(0);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(original.stdout);
  });
  it("executes a source with no string constants", () => {
    const code = "return 42";
    const result = obfuscateWithReport(code, { code, platform: "luau", optimizationLevel: 3, toggles: {}, nameConfig: { ...DEFAULT_NAME_CONFIG, seed: 42 } });
    expect(result.usedLevel).toBe(3);
    expect(run(result.output).status).toBe(0);
  });
});
