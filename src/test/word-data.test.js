import { describe, expect, it } from "vitest";
import { encodeWords, decodeWords, emitWordData } from "../lib/obfuscator/word-data";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
describe("compressed word data", () => {
  for (const words of [[], [0], [127, 128, 16383, 16384, 4294967295], Array.from({ length: 1e4 }, (_, i) => i % 257)]) it(`roundtrips ${words.length} exact words`, () => expect(decodeWords(encodeWords(words), words.length)).toEqual(words));
  it("rejects truncated, overflowing, noncanonical and wrong count data", () => {
    for (const data of ["\x80", "\xFF\xFF\xFF\xFF\x7F", "\x80\0", "\0\0"]) expect(() => decodeWords(data, 1)).toThrow();
  });
  it("rejects invalid source words", () => {
    for (const words of [[-1], [2 ** 32], [1.2]]) expect(() => encodeWords(words)).toThrow();
  });
  it("executes decoder with every word boundary and dictionary resets", () => {
    const words = Array.from({ length: 1e4 }, (_, i) => i % 3 === 0 ? 4294967295 : i);
    const dir = mkdtempSync(join(tmpdir(), "word-data-"));
    try {
      const file = join(dir, "case.luau");
      writeFileSync(file, `${emitWordData(words, "d", "p")}local expected={${words.join(",")}};for i=1,#expected do assert(d[i]==expected[i]) end;print(#d)`);
      expect(execFileSync(process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau", [file], { encoding: "utf8" }).trim()).toBe("10000");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
