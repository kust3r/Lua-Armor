import { describe, it, expect } from "vitest";
import { elideUncapturedCloses } from "../lib/obfuscator/close-elision";
import { compile } from "../lib/obfuscator/compiler";
import { parse } from "../lib/obfuscator/parser";
import { tokenize } from "../lib/obfuscator/lexer";
describe("CLOSE elision", () => {
  it("removes only uncaptured lifetimes and remaps jumps to the next surviving instruction", () => {
    const { proto, opcodes: o } = compile(parse(tokenize("print(1)")));
    const instructions = [[o.FORPREP, 0, 5, 0], [o.LOADK, 4, 0, 0], [o.CLOSE, 4, 4, 0], [o.JMP, 5, 0, 0], [o.FORLOOP, 0, 2, 0], [o.RETURN, 0, 1, 0]];
    const p = { ...proto, instructions, protos: [], maxReg: 4 };
    const r = elideUncapturedCloses(p, o);
    expect(r.instructions).toEqual([[o.FORPREP, 0, 4, 0], [o.LOADK, 4, 0, 0], [o.JMP, 4, 0, 0], [o.FORLOOP, 0, 2, 0], [o.RETURN, 0, 1, 0]]);
    expect(p.instructions).toEqual(instructions);
  });
  it("keeps captured CLOSE and native child capture slots", () => {
    const { proto, opcodes: o } = compile(parse(tokenize("print(1)")));
    const child = { ...proto, upvalues: [{ source: 0, index: 2, name: "x" }] };
    const r = elideUncapturedCloses({ ...proto, maxReg: 3, protos: [child], instructions: [[o.CLOSE, 1, 3, 0], [o.RETURN, 0, 1, 0]] }, o);
    expect(r.instructions[0]).toEqual([o.CLOSE, 1, 3, 0]);
  });
  it("preserves skip-next positions", () => {
    const { proto, opcodes: o } = compile(parse(tokenize("print(1)")));
    for (const previous of [[o.TEST, 0, 0, 0], [o.TESTSET, 0, 0, 0], [o.TFORLOOP, 0, 0, 0], [o.LOADBOOL, 0, 0, 1]]) {
      const r = elideUncapturedCloses({ ...proto, protos: [], instructions: [previous, [o.CLOSE, 1, 1, 0], [o.RETURN, 0, 1, 0]] }, o);
      expect(r.instructions.length).toBe(3);
      expect(r.instructions[1][0]).toBe(o.CLOSE);
    }
  });
  it("remaps branches into consecutive deletions and the end sentinel", () => {
    const { proto, opcodes: o } = compile(parse(tokenize("print(1)")));
    const r = elideUncapturedCloses({ ...proto, protos: [], instructions: [[o.JMP, 3, 0, 0], [o.JMPIF, 0, 4, 0], [o.CLOSE, 1, 1, 0], [o.CLOSE, 2, 2, 0], [o.RETURN, 0, 1, 0], [o.CLOSE, 3, 3, 0]] }, o);
    expect(r.instructions).toEqual([[o.JMP, 3, 0, 0], [o.JMPIF, 0, 3, 0], [o.RETURN, 0, 1, 0]]);
    const end = elideUncapturedCloses({ ...proto, protos: [], instructions: [[o.JMP, 4, 0, 0], [o.CLOSE, 1, 1, 0], [o.CLOSE, 2, 2, 0]] }, o);
    expect(end.instructions).toEqual([[o.JMP, 2, 0, 0]]);
  });
});
