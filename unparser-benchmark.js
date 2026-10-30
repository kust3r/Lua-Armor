#!/usr/bin/env bun
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tokenize } from "./src/lib/obfuscator/lexer";
import { parse } from "./src/lib/obfuscator/parser";
import { astToLua } from "./src/lib/obfuscator/unparser";
import { obfuscate } from "./src/lib/obfuscator/engine";
const source = readFileSync("examples/unparser/input.lua", "utf8");
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
function seeded(seed, fn) {
  const previous = Math.random;
  let s = seed;
  Math.random = () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = previous;
  }
}
const rows = [];
for (let i = 0; i < 12; i++) {
  let time = performance.now();
  const ast = parse(tokenize(source));
  const parsing = performance.now() - time;
  time = performance.now();
  astToLua(ast, { target: "lua51" });
  const readable = performance.now() - time;
  time = performance.now();
  astToLua(ast, { target: "lua51", mode: "compact" });
  const compact = performance.now() - time;
  time = performance.now();
  const output = seeded(42, () => obfuscate(source, { platform: "luau", optimizationLevel: 2, toggles: {}, code: source }));
  const generation = performance.now() - time;
  if (i >= 3) rows.push({ parse: parsing, readable, compact, generation, bytes: Buffer.byteLength(output) });
}
const runtime = process.env.LUAU_BIN;
const boundaries = {};
if (runtime) for (const native of [false, true]) {
  const code = `local x=0;local f=${native ? "LPY_NO_VIRTUALIZE(" : ""}function(n) x=x+n;return x end${native ? ")" : ""};for i=1,2000 do f(1) end;print(x)`;
  const output = seeded(42, () => obfuscate(code, { platform: "luau", optimizationLevel: 2, toggles: {}, code }));
  const dir = mkdtempSync(join(tmpdir(), "lpy-unparser-bench-"));
  const times = [];
  try {
    const file = join(dir, "case.luau");
    writeFileSync(file, `local t=os.clock();assert(loadstring(${JSON.stringify(output)}))();print(os.clock()-t)`);
    for (let i = 0; i < 7; i++) {
      const result = execFileSync(runtime, [file], { encoding: "utf8", timeout: 3e4 }).trim().split("\n");
      if (result[0] !== "2000") throw new Error("invalid benchmark result");
      if (i >= 2) times.push(Number(result[1]));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  boundaries[native ? "hybrid" : "vm"] = { seconds: times, bytes: Buffer.byteLength(output) };
}
console.log(JSON.stringify({ seed: 42, warmups: 3, samples: rows.length, sourceBytes: Buffer.byteLength(source), readableBytes: Buffer.byteLength(astToLua(parse(tokenize(source)), { target: "lua51" }).code), compactBytes: Buffer.byteLength(astToLua(parse(tokenize(source)), { target: "lua51", mode: "compact" }).code), medianMilliseconds: Object.fromEntries(["parse", "readable", "compact", "generation"].map((k) => [k, median(rows.map((r) => r[k]))])), productionBytes: rows[0].bytes, boundaries }, null, 2));
