import { describe, expect, it } from "vitest";
import { capturedRegisters } from "../lib/obfuscator/capture-layout";
import { compile } from "../lib/obfuscator/compiler";
import { parse } from "../lib/obfuscator/parser";
import { tokenize } from "../lib/obfuscator/lexer";
const proto = (source) => compile(parse(tokenize(source))).proto;
describe("binding-derived capture layouts", () => {
  it("does not box uncaptured locals", () => expect(capturedRegisters(proto("local x=1;print(x)"))).toEqual([]));
  it("deduplicates siblings sharing the same binding", () => {
    const p = proto("local x=1;local a=function() x+=1 end;local b=function() return x end");
    expect(capturedRegisters(p)).toEqual([0]);
    expect(p.protos[0].upvalues[0].index).toBe(p.protos[1].upvalues[0].index);
  });
  it("does not confuse inherited upvalues with child-local captures", () => {
    const p = proto("local x=1;local f=function() return function() return x end end");
    expect(capturedRegisters(p)).toEqual([0]);
    expect(capturedRegisters(p.protos[0])).toEqual([]);
    expect(p.protos[0].protos[0].upvalues[0].source).toBe(1);
  });
  it("keeps distinct shadowed declarations as distinct slots", () => {
    const p = proto("local x=1;local a=function() return x end;local x=2;local b=function() return x end");
    const slots = capturedRegisters(p);
    expect(slots).toHaveLength(2);
    expect(new Set(slots).size).toBe(2);
  });
  it("rejects out of range metadata instead of silently dropping it", () => {
    const p = proto("local x=1;local a=function() return x end");
    p.protos[0].upvalues[0].index = p.maxReg + 1;
    expect(() => capturedRegisters(p)).toThrow("outside");
  });
});
