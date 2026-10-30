#!/usr/bin/env bun
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeToggles } from "./src/lib/obfuscator/normalize-toggles";
import { regenerateSource } from "./src/lib/obfuscator/source-emission";
import { obfuscateWithReport } from "./src/lib/obfuscator/engine";
import { bundle } from "./src/lib/obfuscator/bundle";
import { DEFAULT_NAME_CONFIG } from "./src/lib/obfuscator/types";
const HERE = dirname(fileURLToPath(import.meta.url));
function die(msg, code = 1) {
  process.stderr.write(`lurapy: ${msg}
`);
  process.exit(code);
}
function printHelp() {
  const src = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const block = src.match(/\/\*\*([\s\S]*?)\*\//)?.[1] ?? "";
  process.stdout.write(block.replace(/^\s*\*\s?/gm, "") + "\n");
}
function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      flags.help = true;
      continue;
    }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      const isFlag = ["readable", "bundle", "print-config", "keep-comments", "cooperative-yield"].includes(key);
      if (isFlag || !next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}
function loadConfig(path) {
  const defaults = {
    platform: "luau",
    preset: "medium",
    seed: null,
    readable: false,
    bundle: false,
    names: { minLength: 1, maxLength: 8, style: "mangled" },
    toggles: {}
  };
  if (!existsSync(path)) return defaults;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return {
      ...defaults,
      ...raw,
      names: { ...defaults.names, ...raw.names ?? {} },
      toggles: normalizeToggles({ ...defaults.toggles, ...raw.toggles ?? {} })
    };
  } catch (e) {
    die(`failed to parse ${path}: ${e.message}`);
  }
}
const PRESET_TO_LEVEL = {
  minify: 1,
  weak: 1,
  medium: 2,
  strong: 3
};
const PRESET_TOGGLES = {
  minify: { antiTamper: false, antiDebug: false, envLock: false, intenseVm: false, vmCompression: false },
  weak: { envLock: true },
  medium: { antiTamper: true, antiDebug: true, envLock: true },
  strong: { antiTamper: true, antiDebug: true, envLock: true, intenseVm: true, hardcodeGlobals: true }
};
function mergeToggles(...layers) {
  const out = {};
  for (const l of layers) for (const k of Object.keys(l)) if (k !== "disableLineInfo") out[k] = l[k];
  return out;
}
async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    process.exit(0);
  }
  const configPath = flags.config ?? join(HERE, "configs.json");
  const cfg = loadConfig(configPath);
  if (flags.loader && flags.loader !== "direct" && flags.loader !== "dynamic") die("--loader must be direct or dynamic");
  if (flags.platform) cfg.platform = flags.platform;
  if (flags.preset) cfg.preset = flags.preset;
  if (flags.seed) cfg.seed = Number(flags.seed);
  if (flags.readable) cfg.readable = true;
  if (flags.bundle) cfg.bundle = true;
  const onList = flags.on ? String(flags.on).split(",").map((s) => s.trim()).filter(Boolean) : [];
  const offList = flags.off ? String(flags.off).split(",").map((s) => s.trim()).filter(Boolean) : [];
  if ([...onList, ...offList].includes("disableLineInfo")) die("Disable line information has been removed");
  const cliOn = Object.fromEntries(onList.map((k) => [k, true]));
  const cliOff = Object.fromEntries(offList.map((k) => [k, false]));
  const toggles = normalizeToggles(mergeToggles(PRESET_TOGGLES[cfg.preset] ?? {}, cfg.toggles, cliOn, cliOff));
  if (flags["print-config"]) {
    process.stdout.write(JSON.stringify({ ...cfg, toggles, configPath }, null, 2) + "\n");
    process.exit(0);
  }
  if (positionals.length === 0) {
    printHelp();
    process.exit(1);
  }
  const inputPath = resolve(positionals[0]);
  if (!existsSync(inputPath)) die(`input not found: ${inputPath}`);
  const outputPath = positionals[1] ? resolve(positionals[1]) : join(dirname(inputPath), basename(inputPath, extname(inputPath)) + ".obf" + extname(inputPath));
  let source;
  if (cfg.bundle) {
    source = await bundle(inputPath);
  } else {
    source = readFileSync(inputPath, "utf8");
  }
  if (flags["emit-source"]) {
    const mode = String(flags["emit-source"]);
    if (mode !== "readable" && mode !== "compact") die("--emit-source must be readable or compact");
    const result = regenerateSource(source, { target: cfg.platform, mode, comments: !!flags["keep-comments"] });
    writeFileSync(outputPath, result.code, "utf8");
    return;
  }
  const nameConfig = {
    ...DEFAULT_NAME_CONFIG,
    minLength: cfg.names.minLength,
    maxLength: cfg.names.maxLength,
    nameStyle: cfg.names.style,
    seed: cfg.seed
  };
  const t0 = performance.now();
  const report = obfuscateWithReport(source, {
    platform: cfg.platform,
    toggles,
    optimizationLevel: PRESET_TO_LEVEL[cfg.preset] ?? 2,
    code: source,
    nameConfig,
    // Level 3 uses Hardened VM v4.3 for Luau/Roblox. Keep an explicit emergency
    // rollback while the legacy backend remains available for compatibility.
    ...PRESET_TO_LEVEL[cfg.preset] === 3 && (cfg.platform === "luau" || cfg.platform === "roblox") && process.env.LURAPY_LEGACY_LEVEL3 !== "1" ? { hardenedVmVersion: 4 } : {},
    execution: { loader: flags.loader === "dynamic" ? "dynamic" : "direct", cooperativeYield: flags["cooperative-yield"] === true }
  });
  const output = report.output;
  writeFileSync(outputPath, output, "utf8");
  const dt = (performance.now() - t0).toFixed(1);
  const outputBytes = Buffer.byteLength(output), sourceBytes = Buffer.byteLength(source);
  const ratio = (outputBytes / Math.max(1, sourceBytes)).toFixed(2);
  process.stderr.write(
    `lurapy: ${basename(inputPath)} \u2192 ${basename(outputPath)}  (${sourceBytes}B \u2192 ${outputBytes}B, \xD7${ratio}, ${dt}ms, preset=${cfg.preset}, level=${report.usedLevel}, platform=${cfg.platform}, validation=structural, seed=${report.metadata.seed}, attempts=${report.metadata.attempts}, engine=${report.metadata.engineVersion})
`
  );
}
main().catch((e) => die(e.stack ?? String(e)));
