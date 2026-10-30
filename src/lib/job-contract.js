const emptyPhases = () => Array.from({ length: 3 }, () => ({ status: "pending", progress: 0 }));
function applyPhase(phases, event) {
  const next = event.phase === 0 && event.status === "running" ? emptyPhases() : phases.map((p) => ({ ...p }));
  next[event.phase] = { status: event.status, progress: event.status === "done" ? 100 : 0 };
  return next;
}
function estimatedCompletion(phases, artifactReady) {
  return artifactReady ? 100 : Math.min(99, Math.round(phases.filter((p) => p.status === "done").length / 3 * 100));
}
const supportedFile = (name) => /\.(lua|luau|txt)$/i.test(name);
const artifactName = (name) => `${name.replace(/\.(lua|luau|txt)$/i, "") || "script"}-Obfuscated.lua`;
function sessionArtifactName(input, output) {
  if (input.inputKind === "attachment") {
    const base = input.fileName.replace(/\.(lua|luau|txt)$/i, "");
    const separator = base.indexOf("-");
    return separator > 0 ? `${base.slice(0, separator)}-Obfuscated.lua` : `${base}-Obfuscated.lua`;
  }
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(output)) hash = Math.imul(hash ^ byte, 16777619);
  return `Obfuscated-${(hash >>> 0).toString(16).padStart(8, "0")}.lua`;
}
function formatKb(bytes) {
  const size = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  let unit = 0;
  let value = size;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  if (Math.round(value * 100) / 100 >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: unit === 0 ? 0 : 2 })} ${units[unit]}`;
}
function downloadArtifact(blob, name, exactName = false) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exactName ? name : artifactName(name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 6e4);
}
export {
  applyPhase,
  artifactName,
  downloadArtifact,
  emptyPhases,
  estimatedCompletion,
  formatKb,
  sessionArtifactName,
  supportedFile
};
