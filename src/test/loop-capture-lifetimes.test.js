import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { obfuscateWithReport } from "../lib/obfuscator/engine";
const runtime = process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau";
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "lpy-lifetimes-"));
  try {
    const file = join(dir, "case.luau");
    writeFileSync(file, source);
    return execFileSync(runtime, [file], { encoding: "utf8", timeout: 3e4 }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const cases = {
  eight: { source: `local f={};for i=1,8 do local captured=i;f[i]=function() return captured end end;for i=1,8 do print(f[i]());assert(f[i]()==i,'captura incorreta na posicao '..i) end`, expected: "1\n2\n3\n4\n5\n6\n7\n8" },
  siblings: { source: `local r,w={},{};for i=1,4 do local x=i;r[i]=function() return x end;w[i]=function(v) x=v end;x+=10 end;w[2](false);w[3](nil);print(r[1](),r[2](),r[3](),r[4]())`, expected: "11	false	nil	14" },
  control: { source: `local f={};for i=1,4 do f[i]=function() return i end end;print(f[1](),f[2](),f[3](),f[4]())` },
  generic: { source: `local f={};for i,v in ipairs({10,20,30,40}) do local x=v;f[i]=function() return i,x end;if i==2 then continue end;if i==3 then break end end;print(f[1]());print(f[2]());print(f[3]())` },
  while: { source: `local f={};local i=0;while i<4 do i+=1;local x=i;f[i]=function() return x end;if i==2 then continue end;if i==3 then break end end;print(f[1](),f[2](),f[3]())` },
  repeat: { source: `local f={};local i=0;repeat i+=1;local x=i;f[i]=function() return x end;if i==2 then continue end until x>=4;print(f[1](),f[2](),f[3](),f[4]())` },
  nested: { source: `local f={};for i=1,2 do for j=1,3 do local x=i*10+j;f[#f+1]=function() return x end;if j==2 then continue end end end;for i=1,#f do print(f[i]()) end` },
  shadowing: { source: `local f={};for i=1,3 do local x=i;f[#f+1]=function() return x end;local x=i+10;f[#f+1]=function() return x end end;do local x=100;print(x) end;for i=1,#f do print(f[i]()) end` },
  escapedError: { source: `local f;local function make() local x=5;f=function(v) if v then x=v end;return x end;error('sentinel',0) end;print(pcall(make));print(f(),f(7),f())` },
  hybrid: { source: `local f={};for i=1,4 do local x=i;f[i]=LPY_NO_VIRTUALIZE(function(v) if v then x+=v end;return x end);if i==2 then continue end end;print(f[1](10),f[2](20),f[1](),f[3](),f[4]())` },
  returned: { source: `local function make() local f={};for i=1,3 do local x=i;f[i]=function(v) if v then x+=v end;return x end;if i==2 then return f end end end;local a=make();local b=make();print(a[1](10),a[2](20),b[1](),b[2]())` }
};
describe.skipIf(!existsSync(runtime))("capture storage lifetimes", () => {
  for (const [label, c] of Object.entries(cases)) it(label, () => {
    const expected = run(c.source.split("LPY_NO_VIRTUALIZE").join(""));
    if (c.expected !== void 0) expect(expected).toBe(c.expected);
    for (const level of [1, 2, 3]) {
      for (const gcFixes of [false, true]) {
        const report = obfuscateWithReport(c.source, { code: c.source, platform: "luau", optimizationLevel: level, toggles: { gcFixes } });
        expect(report.usedLevel).toBe(level);
        expect(run(report.output)).toBe(expected);
      }
    }
  }, 12e4);
});
