import { describe, expect, it } from "vitest";
import { decodePositions, encodePositions, MAX_POSITION, emitBestPositionDecoder } from "../lib/obfuscator/position-codec";
describe("constant position format", () => {
  for (const version of [1, 2]) {
    for (const slots of [[], [1], [85, 86, 171, 257], [MAX_POSITION], Array.from({ length: 1200 }, (_, i) => i + 1)]) it(`roundtrips v${version} ${slots.length} positions`, () => expect(decodePositions(encodePositions(slots, version), slots.length, MAX_POSITION, version)).toEqual(slots));
    it(`rejects invalid/truncated v${version} data before accepting positions`, () => {
      for (const data of ["~", "~!!", "~!!!", " ", "~zzz!", "|!!!"]) expect(() => decodePositions(data, 1, 100, version)).toThrow();
      expect(() => decodePositions("!!", 1, 100, version)).toThrow();
      expect(() => decodePositions("!", 2, 100, version)).toThrow();
    });
  }
  it("rejects nonincreasing or unrepresentable source positions", () => {
    for (const slots of [[0], [2, 1], [1, 1], [MAX_POSITION + 1], [1.5]]) expect(() => encodePositions(slots)).toThrow();
  });
  it("compresses long runs without expansion padding", () => expect(encodePositions(Array.from({ length: 23908 }, (_, i) => i + 1))).toHaveLength(4));
  it("selects a decoder with net savings including validation", () => expect(emitBestPositionDecoder(Array.from({ length: 25e3 }, (_, i) => i + 1), 25e3, "c", "g").length).toBeLessThan(3e3));
});
