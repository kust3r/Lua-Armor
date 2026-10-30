import { serializeDiagnostic } from "./obfuscator/diagnostics";
import { obfuscateWithReport } from "./obfuscator/engine";
const ctx = self;
ctx.addEventListener("message", (e) => {
  const data = e.data;
  if (!data || data.type !== "obfuscate" || typeof data.jobId !== "string" || typeof data.code !== "string" || !data.options) return;
  if (!["roblox", "luau"].includes(data.options.platform) || ![1, 2, 3].includes(data.options.optimizationLevel) || !data.options.toggles || typeof data.options.toggles !== "object") {
    ctx.postMessage({ type: "error", jobId: data.jobId, message: "Configura\xE7\xF5es de ofusca\xE7\xE3o inv\xE1lidas." });
    return;
  }
  try {
    const { output, usedLevel, metadata } = obfuscateWithReport(data.code, data.options, (event) => {
      ctx.postMessage({ type: "progress", jobId: data.jobId, event });
    });
    ctx.postMessage({ type: "result", jobId: data.jobId, output, usedLevel, metadata });
  } catch (err) {
    ctx.postMessage({ type: "error", jobId: data.jobId, message: err instanceof Error ? err.message : "Generation failed", diagnostic: serializeDiagnostic(err) });
  }
});
ctx.postMessage({ type: "ready" });
