import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { obfuscateWithReport } from "@/lib/obfuscator/engine";
const luau = process.env.LUAU_BIN ?? "/nix/store/95x1rdpz2jq2kn4vbwqk2nyl44g0f3wk-luau-0.703/bin/luau";
const KONTRA_BENCH = `
local function executarCalculos()
  local resultado=0
  for i=1,12000 do
    resultado=resultado+math.sin(i*0.01)+math.cos(i*0.02)
    resultado=math.sqrt(math.abs(resultado))
  end
  return resultado
end

local seed=42
local function nextInt(lo,hi)
  seed=(seed*1103515245+12345)%2147483648
  return lo+(seed%(hi-lo+1))
end

local word="KONTRA"
local totalCalcs=0
local result=""
for i=1,#word do
  local tries=0
  repeat
    executarCalculos()
    tries=tries+1
    totalCalcs=totalCalcs+1
  until tries>=1 and nextInt(1,4)==1
  result=result..word:sub(i,i)
end
print(result)
print("TOTAL_CALCS",totalCalcs)
`;
function runLuau(source, timeout = 12e4) {
  const dir = mkdtempSync(join(tmpdir(), "vm-bench-"));
  try {
    const path = join(dir, "bench.luau");
    writeFileSync(path, source, "utf8");
    return execFileSync(luau, [path], { encoding: "utf8", timeout }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function runTimed(source, timeout = 12e4, useLoadstring = false) {
  const dir = mkdtempSync(join(tmpdir(), "vm-bench-"));
  try {
    const path = join(dir, "bench.luau");
    let timed;
    if (useLoadstring) {
      timed = `local _t0=os.clock();assert(loadstring(${JSON.stringify(source)}))();local _t1=os.clock();print("ELAPSED",string.format("%.6f",_t1-_t0))`;
    } else {
      timed = `local _t0=os.clock();
${source}
local _t1=os.clock();print("ELAPSED",string.format("%.6f",_t1-_t0))`;
    }
    writeFileSync(path, timed, "utf8");
    const raw = execFileSync(luau, [path], { encoding: "utf8", timeout }).trim();
    const lines = raw.split("\n");
    const elapsedLine = lines.find((l) => l.startsWith("ELAPSED"));
    const elapsed = elapsedLine ? parseFloat(elapsedLine.split("	")[1]) : -1;
    const output = lines.filter((l) => !l.startsWith("ELAPSED")).join("\n");
    return { output, elapsed };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
describe.skipIf(!existsSync(luau))("VM deterministic benchmark", () => {
  it("original script produces KONTRA with deterministic calc count", () => {
    const result = runLuau(KONTRA_BENCH);
    const lines = result.split("\n");
    expect(lines[0]).toBe("KONTRA");
    expect(lines[1]).toMatch(/^TOTAL_CALCS\t\d+$/);
    console.log("Original:", lines[1]);
  }, 3e4);
  for (const level of [1, 2, 3]) {
    it(`level ${level}: measures execution time original vs obfuscated`, () => {
      const origSamples = [];
      let origOutput = "";
      for (let s = 0; s < 3; s++) {
        const r = runTimed(KONTRA_BENCH);
        origSamples.push(r.elapsed);
        origOutput = r.output;
      }
      const obf = obfuscateWithReport(KONTRA_BENCH, {
        platform: "luau",
        optimizationLevel: level,
        code: KONTRA_BENCH,
        toggles: { intenseVm: false, gcFixes: true }
      });
      const obfSamples = [];
      let obfOutput = "";
      for (let s = 0; s < 3; s++) {
        const r = runTimed(obf.output, 12e4, true);
        obfSamples.push(r.elapsed);
        obfOutput = r.output;
      }
      expect(obfOutput).toBe(origOutput);
      const origMedian = origSamples.sort((a, b) => a - b)[1];
      const obfMedian = obfSamples.sort((a, b) => a - b)[1];
      const ratio = obfMedian / origMedian;
      console.log(`Level ${level}: original=${origMedian.toFixed(3)}s obfuscated=${obfMedian.toFixed(3)}s ratio=${ratio.toFixed(1)}x`);
      console.log(`  Original samples: ${origSamples.map((s) => s.toFixed(3)).join(", ")}`);
      console.log(`  Obfuscated samples: ${obfSamples.map((s) => s.toFixed(3)).join(", ")}`);
      console.log(`  Output size: ${obf.output.length} bytes`);
    }, 3e5);
  }
});
