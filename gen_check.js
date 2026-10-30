import { obfuscate } from "./src/lib/obfuscator/engine";
const src = require("fs").readFileSync("src/test/vm-runtime-regressions.test.js", "utf8").slice(0, 2e3);
for (let k = 0; k < 10; k++) {
  const out = obfuscate('print("hello"); local x=1; for i=1,5 do print(i*x) end', { code: "", platform: "roblox", optimizationLevel: 3, toggles: { intenseVm: true, gcFixes: true, robloxEnvLock: true } });
  const code = typeof out === "string" ? out : out.code;
  const buf = Buffer.from(code, "binary");
  let found = false;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b !== 9 && b !== 10 && b !== 13 && (b < 32 || b === 127 || b > 126)) {
      console.log("gen", k, "byte", b.toString(16), "at", i, "ctx=", JSON.stringify(code.slice(Math.max(0, i - 40), i + 40)));
      found = true;
      break;
    }
  }
  if (!found) console.log("gen", k, "clean len", code.length);
}
