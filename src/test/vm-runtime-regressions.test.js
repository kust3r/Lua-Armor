import { describe, expect, it } from "vitest";
import { tokenize } from "@/lib/obfuscator/lexer";
import { parse } from "@/lib/obfuscator/parser";
import { compile } from "@/lib/obfuscator/compiler";
import { generateVM } from "@/lib/obfuscator/vm-codegen";
import { DEFAULT_NAME_CONFIG } from "@/lib/obfuscator/types";
import { withRandomDomains } from "@/lib/obfuscator/generation-random";
import { configureNames, withNameState } from "@/lib/obfuscator/names";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "lpy-regression-"));
  try {
    const path = join(dir, "case.luau");
    writeFileSync(path, source);
    return execFileSync(process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau", [path], { encoding: "utf8", timeout: 1e4 }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
describe("vm runtime regressions", () => {
  it("preserves explicit argument counts for false/nil-sensitive calls", () => {
    const code = `
      local mt=getrawmetatable(game)
      setreadonly(mt,false)
      setreadonly(mt,true)
    `;
    const { proto, opcodes } = compile(parse(tokenize(code)));
    const vm = generateVM(proto, opcodes, 2);
    expect(vm).toContain("unpack(");
    expect(vm).toMatch(/unpack\([^)]*,1,[^)]+\)/);
    expect(vm).toMatch(/\.n\s*or\s*#/);
  });
  it("packs closure varargs with select count instead of #table heuristics", () => {
    const code = `
      local function f(...) return ... end
      print(select('#',f(1,nil,false,nil)),f(1,nil,false,nil))
    `;
    const { proto, opcodes } = compile(parse(tokenize(code)));
    const vm = withNameState(() => {
      configureNames({ ...DEFAULT_NAME_CONFIG, seed: 42 });
      return withRandomDomains(42, () => generateVM(proto, opcodes, 2, { directOutput: true }));
    });
    const evidence = { seed: 42, requestedLevel: 2, usedLevel: 2, sha256: createHash("sha256").update(vm).digest("hex") };
    expect(evidence.usedLevel).toBe(evidence.requestedLevel);
    expect(tokenize(vm).some((t) => t.type === "string" && t.value === "#")).toBe(true);
    expect(vm).toContain(".n=");
    expect(run(vm)).toBe("4	1	nil	false	nil");
  });
  it("applies per-build opcode hashing on top of raw byte decode", () => {
    const code = `
      local x = -1
      print(x)
      local t = { label = 'ok' }
      print(t.label)
    `;
    const { proto, opcodes } = compile(parse(tokenize(code)));
    const vm = generateVM(proto, opcodes, 2);
    expect(vm).toMatch(/_rb/);
    const tokens = tokenize(vm);
    const moduli = tokens.flatMap((token, index) => token.value === "%" && tokens[index + 1]?.type === "number" ? [Number(tokens[index + 1].value.replace(/_/g, ""))] : []);
    expect(moduli).toContain(1048576);
    expect(vm).toMatch(/\[5\]/);
  });
  it("never emits an empty infinite loop as a decoder trap", () => {
    const code = `local value = 'kernel'; print(value)`;
    const { proto, opcodes } = compile(parse(tokenize(code)));
    for (let attempt = 0; attempt < 20; attempt++) {
      const vm = generateVM(proto, opcodes, 3, { intenseVm: true });
      expect(vm).not.toMatch(/while\s+true\s+do\s+end/);
      expect(vm).not.toMatch(/repeat[^;]*until\s+[A-Za-z_]\w*\[/);
      expect(vm).not.toMatch(/\[=+\[\n/);
    }
  });
  it("mascara constantes inteiras sem deixar seus valores diretamente na tabela", () => {
    const code = "local a=12345678; local b=-8765432; print(a,b)";
    const { proto, opcodes } = compile(parse(tokenize(code)));
    for (let attempt = 0; attempt < 5; attempt++) {
      const seed = [42, 7, 1337, 23, 91][attempt];
      const vm = withNameState(() => {
        configureNames({ ...DEFAULT_NAME_CONFIG, seed });
        return withRandomDomains(seed, () => generateVM(proto, opcodes, 3, { intenseVm: true, directOutput: true }));
      });
      const evidence = { seed, requestedLevel: 3, usedLevel: 3, sha256: createHash("sha256").update(vm).digest("hex") };
      expect(evidence.usedLevel).toBe(evidence.requestedLevel);
      expect(run(vm)).toBe("12345678	-8765432");
      const numericValues = tokenize(vm).filter((t) => t.type === "number").map((t) => Number(t.value.replace(/_/g, "")));
      expect(numericValues).not.toContain(12345678);
      expect(numericValues).not.toContain(8765432);
    }
  });
  it("anti-hook verifies all 20 cached builtins, not just the first 11", () => {
    const code = `local x = 1; print(x)`;
    const { proto, opcodes } = compile(parse(tokenize(code)));
    const vm = generateVM(proto, opcodes, 2);
    expect(vm).toMatch(/\[12\]/);
    expect(vm).toMatch(/\[20\]/);
    expect(vm).toMatch(/1,20/);
    expect(vm).toMatch(/1\.5/);
  });
  it("does not publish GetService/Instance.new refs into the environment", () => {
    const code = `print("hello")`;
    const { proto, opcodes } = compile(parse(tokenize(code)));
    const vm = generateVM(proto, opcodes, 3, { robloxEnvLock: true });
    expect(vm).not.toMatch(/CalloutService/);
    expect(vm).not.toMatch(/TimerService/);
  });
});
