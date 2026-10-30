import { describe, it, expect } from "vitest";
import { tokenize } from "../lib/obfuscator/lexer";
import { parse } from "../lib/obfuscator/parser";
import { withTokenCache, withoutTokenCache } from "../lib/obfuscator/token-cache";
import { withGenerationSession, observeGeneration } from "../lib/obfuscator/generation-session";
const source = "-- large source\n".repeat(5e3) + "local x='\\000\\255';return x";
describe("generation-scoped exact token reuse", () => {
  it("reuses only exact source and the same comments mode", () => withTokenCache(() => {
    const a = tokenize(source);
    expect(tokenize(source)).toBe(a);
    expect(tokenize(source, { comments: false })).toBe(a);
    expect(tokenize(source, { comments: true })).not.toBe(a);
    const b = tokenize(source + " ");
    expect(b).not.toBe(a);
    expect(tokenize(source)).toBe(a);
    expect(parse(a)).toEqual(parse(tokenize(source)));
    const str = a.find((t) => t.type === "string");
    expect(str?.bytes).toEqual([0, 255]);
    expect(str?.span?.start).toBe(source.indexOf("'"));
  }));
  it("never keeps entries outside the job or after failure", () => {
    let a;
    expect(() => withTokenCache(() => {
      a = tokenize(source);
      throw new Error("fail");
    })).toThrow("fail");
    withTokenCache(() => expect(tokenize(source)).not.toBe(a));
    expect(tokenize(source)).not.toBe(tokenize(source));
  });
  it("does not cache jobs that start small", () => withTokenCache(() => {
    tokenize("return 1");
    expect(tokenize(source)).not.toBe(tokenize(source));
  }));
  it("bounds entries and evicts old sources", () => withTokenCache(() => {
    const first = tokenize(source);
    for (let i = 0; i < 4; i++) tokenize(source + " ".repeat(i + 1));
    expect(tokenize(source)).not.toBe(first);
  }));
  it("suspends cache during callbacks, even when observers throw", () => withGenerationSession((session) => {
    const a = tokenize(source);
    observeGeneration(() => {
      const b = tokenize(source);
      expect(b).not.toBe(a);
      expect(b[0].value).toBe("local");
      throw new Error("observer");
    });
    expect(session.callbackErrors).toEqual(["observer"]);
    expect(tokenize(source)).toBe(a);
    expect(a[0].value).toBe("local");
  }));
  it("isolates explicit nested analysis scopes and restores the outer cache", () => withTokenCache(() => {
    const a = tokenize(source);
    withTokenCache(() => expect(tokenize(source)).not.toBe(a));
    withoutTokenCache(() => expect(tokenize(source)).not.toBe(a));
    expect(tokenize(source)).toBe(a);
  }));
  it("does not retain oversized entries", () => withTokenCache(() => {
    const large = " ".repeat(2000001) + "return 1";
    expect(tokenize(large)).not.toBe(tokenize(large));
  }));
});
