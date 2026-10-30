import { it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateVM } from "../lib/obfuscator/vm-codegen";
import { compile } from "../lib/obfuscator/compiler";
import { tokenize } from "../lib/obfuscator/lexer";
import { parse } from "../lib/obfuscator/parser";
import { walk } from "../lib/obfuscator/ast-walk";
import { resolveBindings } from "../lib/obfuscator/bindings";
import { astToLua } from "../lib/obfuscator/unparser";
it("rejects an interior header-like position at the actual VM entry before user effects", () => {
  const { proto, opcodes } = compile(parse(tokenize('local function f() return 7 end;print("USER_EFFECT",f())')));
  const generated = generateVM(proto, opcodes, 2, { directOutput: true, legacyRuntimeLayout: true });
  const ast = parse(tokenize(generated)), bindings = resolveBindings(ast);
  let runner;
  walk(ast, (n) => {
    if (n.kind !== "LocalFunc") return;
    const first = n.body.body[0];
    if (first?.kind === "LocalDecl" && first.exprs[0]?.kind === "IndexAccess" && first.exprs[0].obj.kind === "NameExpr" && first.exprs[0].obj.name === "_prototypeMetadata") runner = n;
  });
  if (!runner) throw Error("Actual VM runner absent");
  const binding = bindings.declarations.get(runner)?.[0];
  let changed = 0;
  walk(ast, (n) => {
    if (n.kind === "Call" && n.func.kind === "NameExpr" && bindings.uses.get(n.func)?.id === binding?.id && n.args[0]?.kind === "NumberLit" && n.args[0].value === 1) {
      n.args[0] = { kind: "NumberLit", value: 2 };
      changed++;
    }
  });
  expect(changed).toBe(1);
  const dir = mkdtempSync(join(tmpdir(), "proto-entry-"));
  try {
    const file = join(dir, "case.luau");
    writeFileSync(file, astToLua(ast, { target: "luau", mode: "compact" }).code);
    const result = spawnSync(process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau", [file], { encoding: "utf8", timeout: 1e4 });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("E_PROTO");
    expect(result.stdout).not.toContain("USER_EFFECT");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
