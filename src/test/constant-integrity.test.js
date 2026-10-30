import { describe, expect, it } from "vitest";
import { transportChecksum } from "../lib/obfuscator/constant-integrity";
describe("constant transport integrity", () => {
  it("detects arbitrary byte changes including NUL and 255", () => {
    expect(transportChecksum(String.fromCharCode(0, 255))).not.toBe(transportChecksum(String.fromCharCode(0, 254)));
  });
  it("frames empty strings separately from missing values", () => {
    expect(transportChecksum([""])).not.toBe(transportChecksum([null]));
    expect(transportChecksum(["", "a"])).not.toBe(transportChecksum(["a", ""]));
  });
  it("covers permutation, length and slot metadata in order", () => {
    expect(transportChecksum([1, 2, 3])).not.toBe(transportChecksum([2, 1, 3]));
    expect(transportChecksum([1, 2, 3])).not.toBe(transportChecksum([1, 2]));
  });
  it("distinguishes nil, false, numeric zero and negative zero", () => {
    const hashes = [null, false, 0, -0].map((v) => transportChecksum(v));
    expect(new Set(hashes).size).toBe(4);
  });
});
