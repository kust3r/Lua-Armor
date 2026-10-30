import { describe, it, expect } from "vitest";
import { withTokenCache, getTokens, storeTokens, MAX_RETAINED_TOKENS, MAX_RETAINED_CONTENT_UNITS } from "../lib/obfuscator/token-cache";
const source = " ".repeat(65536);
const token = { type: "number", value: "1", line: 1 };
describe("cache logical retention budgets", () => {
  it("accepts exactly 200000 tokens", () => withTokenCache(() => {
    getTokens(source, false);
    const tokens = Array(2e5).fill(token);
    storeTokens(source, false, tokens);
    expect(getTokens(source, false)).toBe(tokens);
  }));
  it("rejects more than 200000 retained tokens even with a short key", () => withTokenCache(() => {
    expect(MAX_RETAINED_TOKENS).toBe(2e5);
    getTokens(source, false);
    storeTokens(source, false, Array(MAX_RETAINED_TOKENS + 1).fill(token));
    expect(getTokens(source, false)).toBeUndefined();
  }));
  it("evicts before exceeding the total of 200000", () => withTokenCache(() => {
    getTokens(source, false);
    const a = Array(12e4).fill(token);
    const b = Array(80001).fill(token);
    storeTokens(source, false, a);
    expect(getTokens(source, false)).toBe(a);
    storeTokens(source + " ", false, b);
    expect(getTokens(source, false)).toBeUndefined();
    expect(getTokens(source + " ", false)).toBe(b);
  }));
  it("caps key, value, raw, comment text and literal byte elements at 8000000 logical units", () => withTokenCache(() => {
    expect(MAX_RETAINED_CONTENT_UNITS).toBe(8e6);
    getTokens(source, false);
    const huge = [{ ...token, value: "v".repeat(4e6), raw: "r".repeat(4e6) }];
    storeTokens(source, false, huge);
    expect(getTokens(source, false)).toBeUndefined();
    const bytes = [{ ...token, bytes: Array(8e6).fill(0) }];
    storeTokens(source, false, bytes);
    expect(getTokens(source, false)).toBeUndefined();
  }));
  it("clears count budgets on errors and suspends during observers", () => {
    expect(() => withTokenCache(() => {
      getTokens(source, false);
      storeTokens(source, false, Array(2e5).fill(token));
      throw Error("fail");
    })).toThrow("fail");
    withTokenCache(() => {
      getTokens(source, false);
      const b = [token];
      storeTokens(source, false, b);
      expect(getTokens(source, false)).toBe(b);
    });
  });
});
