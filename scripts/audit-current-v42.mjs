import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { obfuscateWithReport } from "../src/lib/obfuscator/engine";
import { tokenize } from "../src/lib/obfuscator/lexer";
import { DEFAULT_NAME_CONFIG } from "../src/lib/obfuscator/types";

const [sourceArg, controllerArg, luraphArg, legacyArg, outputArg = "audit/current-v42"] = process.argv.slice(2);
if (!sourceArg || !controllerArg || !luraphArg || !legacyArg) {
  console.error("usage: vite-node scripts/audit-current-v42.mjs <source.lua> <controller.luau> <luraph.lua> <legacy.lua> [output-dir]");
  process.exit(2);
}

const sourcePath = resolve(sourceArg);
const controllerPath = resolve(controllerArg);
const luraphPath = resolve(luraphArg);
const legacyPath = resolve(legacyArg);
const outputDir = resolve(outputArg);
const runtime = process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau";
const source = readFileSync(sourcePath, "utf8");
const controller = readFileSync(controllerPath, "utf8") + "\nenv.setfenv=setfenv;\n";
mkdirSync(outputDir, { recursive: true });

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const byteLength = (value) => Buffer.byteLength(value);
const literals = [...new Set(tokenize(source).filter((token) => token.type === "string").map((token) => token.value))];
const longLiterals = literals.filter((value) => byteLength(value) >= 6);
const literalBytes = literals.map((value) => Buffer.from(value));
const longLiteralBytes = longLiterals.map((value) => Buffer.from(value));
const fixedWindowRepeat = (text, width = 64) => {
  const compact = text.replace(/\s+/g, "");
  const counts = new Map();
  let total = 0;
  for (let at = 0; at + width <= compact.length; at += width) {
    const chunk = compact.slice(at, at + width);
    counts.set(chunk, (counts.get(chunk) ?? 0) + 1);
    total++;
  }
  const repeated = [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  return { width, total, repeated, ratio: total ? repeated / total : 0 };
};
const metrics = (name, text) => ({
  name,
  bytes: byteLength(text),
  sha256: sha256(text),
  lines: text.split(/\r?\n/).length,
  functionTokens: (text.match(/\bfunction\b/g) ?? []).length,
  elseifTokens: (text.match(/\belseif\b/g) ?? []).length,
  directLongLiterals: longLiterals.filter((value) => text.includes(value)).length,
  longLiteralDenominator: longLiterals.length,
  legacyArithmeticDirectory: /local\s+\w+=\{\[0\]=\([^}]{500,}\[100\]=\(/s.test(text),
  decimalStringCharRuns: (text.match(/\b\w+\((?:\d{1,3},){3,}\d{1,3}\)/g) ?? []).length,
  fixedWindowRepeat64: fixedWindowRepeat(text)
});

const seeds = [7, 42, 1337];
const artifacts = [];
const generatedOutputs = [];
const runLuau = (code) => {
  const runDir = mkdtempSync(join(tmpdir(), "lurapy-v42-audit-"));
  try {
    const runFile = join(runDir, "main.luau");
    writeFileSync(runFile, code);
    return execFileSync(runtime, [runFile], { encoding: "utf8", timeout: 6e4, maxBuffer: 32 * 1024 * 1024 });
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
};
for (const seed of seeds) {
  const report = obfuscateWithReport(source, {
    code: source,
    platform: "luau",
    optimizationLevel: 3,
    hardenedVmVersion: 4,
    toggles: { antiTamper: true, antiDebug: true, envLock: true, intenseVm: true, gcFixes: true, hardcodeGlobals: true },
    nameConfig: { ...DEFAULT_NAME_CONFIG, seed }
  });
  const file = join(outputDir, `KB-Lurapy-v4.2-${seed}.luau`);
  writeFileSync(file, report.output);
  const execution = runLuau(`${controller}\nexecute(function(...) ${report.output} end)`);
  const checksums = [...execution.matchAll(/Checksum: ([^\s]+)/g)].map((match) => Number(match[1]));
  artifacts.push({ seed, file: basename(file), metadata: report.metadata, checksums, lifecycle: execution.includes("MOCK_LIFECYCLE_OK"), ...metrics(`Lurapy v4.2 seed ${seed}`, report.output) });
  generatedOutputs.push({ seed, output: report.output });
}

const hookedController = (hook) => {
  const setup = `
local captures={}
local originalString=env.string
local originalTable=env.table
local stringCopy={};for k,v in pairs(originalString) do stringCopy[k]=v end
local tableCopy={};for k,v in pairs(originalTable) do tableCopy[k]=v end
env.string=stringCopy;env.table=tableCopy
local function capture(v) if type(v)=='string' then captures[#captures+1]=v end return v end
${hook === "concat" ? "local original=originalTable.concat;tableCopy.concat=function(...) return capture(original(...)) end" : `local original=originalString.${hook};stringCopy.${hook}=function(...) return capture(original(...)) end`}
`;
  return controller
    .replace("local function execute(chunk)", `${setup}\nlocal function execute(chunk)`)
    .replace("local start=clock();chunk();local initialized=clock()-start", "local start=clock();chunk();local initialized=clock()-start\n for _,value in ipairs(captures) do local h='';for i=1,#value do h=h..originalString.format('%02x',originalString.byte(value,i)) end;print('HOOK',h) end");
};
const hooks = [];
for (const { seed, output } of generatedOutputs) for (const hook of ["char", "sub", "format", "concat"]) {
  const stdout = runLuau(`${hookedController(hook)}\nexecute(function(...) ${output} end)`);
  const captured = [...stdout.matchAll(/^HOOK\s+([0-9a-f]*)$/gm)].map((match) => Buffer.from(match[1], "hex"));
  const capturedHex = new Set(captured.map((value) => value.toString("hex")));
  hooks.push({
    seed,
    hook,
    callsReturningStrings: captured.length,
    maximumReturnedBytes: Math.max(0, ...captured.map((value) => value.length)),
    exactLexicalValues: literalBytes.filter((value) => capturedHex.has(value.toString("hex"))).length,
    exactLongValues: longLiteralBytes.filter((value) => capturedHex.has(value.toString("hex"))).length,
    lifecycle: stdout.includes("MOCK_LIFECYCLE_OK")
  });
}

const comparisons = [
  metrics("Luraph v15.1 supplied", readFileSync(luraphPath, "utf8")),
  metrics("Lurapy supplied legacy sample", readFileSync(legacyPath, "utf8"))
];
const result = {
  generatedAt: new Date().toISOString(),
  inputs: {
    source: { file: basename(sourcePath), bytes: byteLength(source), sha256: sha256(source) },
    controller: { file: basename(controllerPath), sha256: sha256(readFileSync(controllerPath)) },
    luraph: { file: basename(luraphPath), sha256: sha256(readFileSync(luraphPath)) },
    legacy: { file: basename(legacyPath), sha256: sha256(readFileSync(legacyPath)) }
  },
  literalPopulation: { unique: literals.length, long: longLiterals.length },
  artifacts,
  hooks,
  comparisons
};
writeFileSync(join(outputDir, "audit.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
