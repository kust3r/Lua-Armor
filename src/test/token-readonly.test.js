import { describe, it, expect } from "vitest";
import { tokenize } from "../lib/obfuscator/lexer";
import { parse } from "../lib/obfuscator/parser";
import { withTokenCache, withoutTokenCache } from "../lib/obfuscator/token-cache";
import { optimize } from "../lib/obfuscator/optimizer";
function freezeTokens(tokens) {
  for (const t of tokens) {
    if (t.span) Object.freeze(t.span);
    if (t.bytes) Object.freeze(t.bytes);
    Object.freeze(t);
  }
  for (const c of tokens.comments ?? []) Object.freeze(c);
  if (tokens.comments) Object.freeze(tokens.comments);
  return Object.freeze(tokens);
}
function readonlyContract(tokens) {
  tokens.push(tokens[0]);
  tokens[0].value = "bad";
  if (tokens[0].span) {
    tokens[0].span.start = 3;
  }
  if (tokens[0].bytes) {
    tokens[0].bytes.push(2);
  }
  if (tokens.comments?.[0]) {
    tokens.comments[0].text = "bad";
  }
}
void readonlyContract;
describe("deep readonly token ownership", () => {
  it("production insertion freezes cache-owned data and ASTs own independent metadata", () => withTokenCache(() => {
    const source = "-- c\n" + "-- padding\n".repeat(7e3) + "return '\\000'";
    const tokens = tokenize(source, { comments: true });
    const literal = tokens.find((t) => t.type === "string");
    if (!literal?.bytes || !literal.span || !tokens.comments?.[0]) throw Error("fixture");
    expect(Object.isFrozen(tokens)).toBe(true);
    expect(Object.isFrozen(literal)).toBe(true);
    expect(Reflect.set(literal.bytes, 0, 255)).toBe(false);
    expect(Reflect.set(literal.span, "start", 99)).toBe(false);
    const a = parse(tokens), b = parse(tokens);
    const r = a.body[0];
    if (r.kind !== "Return" || r.exprs[0]?.kind !== "StringLit") throw Error("AST fixture");
    expect(r.exprs[0].bytes).not.toBe(literal.bytes);
    expect(r.exprs[0].span).not.toBe(literal.span);
    expect(a.comments).not.toBe(tokens.comments);
    expect(a.comments?.[0]).not.toBe(tokens.comments[0]);
    if (r.exprs[0].bytes) Reflect.set(r.exprs[0].bytes, 0, 255);
    expect(parse(tokens)).toEqual(b);
    expect(literal.bytes).toEqual([0]);
  }));
  it("parses and optimizes frozen token graphs without mutating shared bytes or spans", () => {
    const source = "-- comment\n" + "-- large job\n".repeat(6e3) + "local a='\\000\\255';local b='a'..'b';return a,b";
    withTokenCache(() => {
      const tokens = freezeTokens(tokenize(source, { comments: true }));
      const before = JSON.stringify(tokens.map((t) => ({ ...t }))) + JSON.stringify(tokens.comments);
      const ast = parse(tokens);
      optimize(ast);
      expect(tokenize(source, { comments: true })).toBe(tokens);
      expect(JSON.stringify(tokens.map((t) => ({ ...t }))) + JSON.stringify(tokens.comments)).toBe(before);
      expect(parse(tokens)).toEqual(parse(withoutTokenCache(() => tokenize(source, { comments: true }))));
    });
  });
  it("frozen diagnostic fixtures actually reject mutations at every depth", () => {
    const tokens = freezeTokens(tokenize("-- c\nreturn '\\000'", { comments: true }));
    const string = tokens.find((t) => t.type === "string");
    expect(string?.bytes).toEqual([0]);
    expect(() => Reflect.set(tokens, 0, tokens[1]) || (() => {
      throw Error("readonly");
    })()).toThrow();
    expect(Reflect.set(tokens[0], "value", "bad")).toBe(false);
    if (!string?.span || !string.bytes || !tokens.comments?.[0]) throw Error("fixture");
    expect(Reflect.set(string.span, "start", 99)).toBe(false);
    expect(Reflect.set(string.bytes, 0, 255)).toBe(false);
    expect(Reflect.set(tokens.comments[0], "text", "bad")).toBe(false);
  });
});
