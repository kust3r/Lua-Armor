import { describe, it, expect } from "vitest";
import { wrapWithLZMA } from "@/lib/obfuscator/lzma-wrapper";
import { configureNames } from "@/lib/obfuscator/names";
import { DEFAULT_NAME_CONFIG } from "@/lib/obfuscator/types";
import { writeFileSync, existsSync } from "fs";
import { execFileSync } from "child_process";
const luau = process.env.LUAU_BIN ?? "/nix/store/95x1rdpz2jq2kn4vbwqk2nyl44g0f3wk-luau-0.703/bin/luau";
function runInScriptEnvironment(source, setup = "") {
  const wrapped = wrapWithLZMA(source);
  const script = `local env=setmetatable({_G={},marker="SCRIPT_ENV"},{__index=getfenv(1)})
${setup}
local fn,err=loadstring(${JSON.stringify(wrapped)})
assert(fn,err)
setfenv(fn,env)
fn()`;
  writeFileSync("/tmp/test-wrapper-environment.lua", script);
  return execFileSync(luau, ["/tmp/test-wrapper-environment.lua"], { encoding: "utf8", timeout: 15e3 });
}
describe.skipIf(!existsSync(luau))("Luraph-style wrapper", () => {
  it("loads when Roblox-style shared _G has no builtins", () => {
    expect(runInScriptEnvironment('print("LOADER_OK")').trim()).toBe("LOADER_OK");
  });
  it("preserves the compiled script environment", () => {
    expect(runInScriptEnvironment("print(marker)").trim()).toBe("SCRIPT_ENV");
  });
  it("keeps decoder temporaries local in a read-only environment", () => {
    expect(runInScriptEnvironment('print("READONLY_OK")', "table.freeze(env)").trim()).toBe("READONLY_OK");
  });
  it("roundtrips comment-like text and quotes without physical output newlines", () => {
    const value = '--[=[comment?]=] "quoted" \\slash\nnext';
    const source = `print(${JSON.stringify(value)})`;
    const wrapped = wrapWithLZMA(source);
    expect(wrapped.split("\n").length).toBe(1);
    expect(runInScriptEnvironment(source)).toBe(value + "\n");
  });
  it("wraps and executes simple code", () => {
    configureNames({ ...DEFAULT_NAME_CONFIG, seed: 42 });
    const wrapped = wrapWithLZMA('print("wrapped OK")');
    expect(wrapped).toContain("return(function(");
    expect(wrapped).toContain("buffer.create");
    expect(wrapped).toContain("buffer.readu8");
    expect(wrapped).toContain("table.move");
    expect(wrapped).toContain("buffer.copy");
    expect(wrapped).toContain("buffer.writeu8");
    expect(wrapped).toContain("table.pack");
    expect(wrapped).toContain("table.create");
    expect(wrapped).toContain('n="n"');
    expect(wrapped).toContain("getfenv(1)");
    expect(wrapped).toContain("buffer.tostring");
    expect(wrapped).toContain("buffer.fromstring");
    writeFileSync("/tmp/test-wrapper.lua", wrapped);
    const out = execFileSync(luau, ["/tmp/test-wrapper.lua"], { encoding: "utf8", timeout: 15e3 });
    expect(out.trim()).toBe("wrapped OK");
  }, 3e4);
  it("does not let a payload suffix consume the closing long-string delimiter", () => {
    const original = Math.random;
    let state = 42;
    Math.random = () => {
      state = Math.imul(state, 1664525) + 1013904223 >>> 0;
      return state / 4294967296;
    };
    try {
      for (let i = 0; i < 80; i++) expect(runInScriptEnvironment('print("DELIMITER_OK")').trim()).toBe("DELIMITER_OK");
    } finally {
      Math.random = original;
    }
  });
  it("wraps large code", () => {
    configureNames({ ...DEFAULT_NAME_CONFIG, seed: 42 });
    let code = "";
    for (let i = 0; i < 500; i++) {
      code += `local v${i} = ${Math.floor(Math.random() * 99999)}
`;
    }
    code += 'print("LARGE_OK")';
    const wrapped = wrapWithLZMA(code);
    writeFileSync("/tmp/test-wrapper-lg.lua", wrapped);
    const out = execFileSync(luau, ["/tmp/test-wrapper-lg.lua"], { encoding: "utf8", timeout: 15e3 });
    expect(out.trim()).toBe("LARGE_OK");
  }, 3e4);
});
