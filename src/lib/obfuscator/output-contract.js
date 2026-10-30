import { tokenize } from "./lexer";
import { LuaDiagnostic } from "./diagnostics";
function validateArtifactContract(source) {
  const reject = (feature) => {
    throw new LuaDiagnostic("INVALID_ARTIFACT", "emit", feature);
  };
  if (/[\r\n]/.test(source)) reject("artifact must contain one physical line");
  for (const token of tokenize(source)) {
    if (token.type !== "string") continue;
    if (token.value.includes("Roblox")) {
      if (token.raw?.includes("Roblox")) reject("forbidden plaintext literal");
    }
    const raw = token.raw ?? "";
    if (raw[0] !== '"' && raw[0] !== "'") continue;
    for (let i = 1; i < raw.length - 1; i++) {
      if (raw[i] !== "\\") continue;
      const next = raw[++i];
      if (next === "x" || next === "u") reject("hexadecimal/unicode string escape");
      if (/\d/.test(next ?? "")) {
        if (!/^\d{3}$/.test(raw.slice(i, i + 3))) reject("byte escape must contain three decimal digits");
        i += 2;
      }
    }
  }
}
export {
  validateArtifactContract
};
