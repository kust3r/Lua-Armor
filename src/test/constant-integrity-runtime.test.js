import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emitTransportVerifier, transportChecksum, DATA_CHECK } from "../lib/obfuscator/constant-integrity";
import { obfuscateWithReport } from "../lib/obfuscator/engine";
import { tokenize } from "../lib/obfuscator/lexer";
import { parse } from "../lib/obfuscator/parser";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
const runtime = process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau";
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "lpy-integrity-"));
  try {
    const path = join(dir, "case.lua");
    writeFileSync(path, source);
    return spawnSync(runtime, [path], { encoding: "utf8" });
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}
function walk(n, fn) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) {
    n.forEach((x) => walk(x, fn));
    return;
  }
  const node = n;
  if (node.kind) fn(node);
  for (const [k, v] of Object.entries(n)) if (!["span", "bytes", "exact"].includes(k)) walk(v, fn);
}
describe("constant integrity runtime", () => {
  it("matches finite double checksums including subnormals, signed zero and large exponents", () => {
    const numbers = [0, -0, Number.MIN_VALUE, 2 ** -1022, 1e-300, 0.1, -0.5, 2 ** 53, Number.MAX_VALUE];
    const code = emitTransportVerifier() + numbers.map((n) => `${DATA_CHECK}(${Object.is(n, -0) ? "-0.0" : String(n)},${transportChecksum(n)});`).join("") + 'print("OK")';
    const result = run(code);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("OK");
  });
  for (const level of [2, 3]) for (const seed of [42, 7, 1337]) it(`rejects string transport mutation before user effects L${level} seed ${seed}`, () => {
    const code = 'print("USER_EFFECT", "KNOWN-LONG-CONSTANT-OF-INTEGRITY-9274", 12345)';
    const output = obfuscateWithReport(code, { code, platform: "luau", optimizationLevel: level, nameConfig: { ...DEFAULT_NAME_CONFIG, seed }, toggles: { gcFixes: true } }).output;
    const ast = parse(tokenize(output));
    const verifierNames = /* @__PURE__ */ new Set();
    walk(ast, (n) => {
      if (n.kind === "LocalFunc") {
        let matches = false;
        walk(n, (x) => {
          if (x.kind === "NumberLit" && x.value === 16777213) matches = true;
        });
        if (matches) verifierNames.add(n.name);
      }
    });
    let target;
    walk(ast, (n) => {
      if (target || n.kind !== "Call" || n.func.kind !== "NameExpr" || !verifierNames.has(n.func.name) || n.args[1]?.kind !== "NumberLit") return;
      walk(n.args[0], (x) => {
        if (!target && x.kind === "StringLit" && x.span && x.bytes && x.bytes.length > 40) target = { start: x.span.start, end: x.span.end, bytes: [...x.bytes] };
      });
    });
    if (!target) throw new Error("checked transport literal absent");
    const field = target;
    field.bytes[0] ^= 1;
    const replacement = '"' + field.bytes.map((n) => "\\" + String(n).padStart(3, "0")).join("") + '"';
    const result = run(output.slice(0, field.start) + replacement + output.slice(field.end));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("E_INTEGRITY");
    expect(result.stdout).not.toContain("USER_EFFECT");
  });
});
