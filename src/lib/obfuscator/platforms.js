const T_INTENSE_VM = {
  id: "intenseVm",
  label: "Intense VM Structure",
  description: "Adiciona camadas extras de processamento \xE0 VM para dificultar a an\xE1lise de suas fun\xE7\xF5es.",
  star: true,
  defaultValue: true
};
const T_GC_FIXES = {
  id: "gcFixes",
  label: "Enable GC Fixes",
  description: "Libera blocos cifrados de strings ap\xF3s decodific\xE1-los, reduzindo a mem\xF3ria retida pelo loader.",
  defaultValue: false
};
const T_PACKER = {
  id: "packer",
  label: "Packer Base85 + Gzip (estilo 25ms)",
  description: "Re-empacota o output final num loader min\xFAsculo estilo 25ms: Base85(gzip(c\xF3digo)) + bootstrap que usa EncodingService:DecompressBuffer. S\xF3 funciona em Roblox (precisa de EncodingService e buffer).",
  star: true,
  defaultValue: false
};
const T_COMPACT_LOADER = {
  id: "vmCompression",
  label: "Compactar Output (Loader LZW)",
  description: "Re-empacota o output inteiro num loader compacto usando compress\xE3o LZW + Base92. Resultado fica MUITO menor mas exige loadstring/load dispon\xEDvel no ambiente (Roblox executors normalmente suportam).",
  star: true,
  defaultValue: false
};
const T_INLINE_GLOBALS = {
  id: "hardcodeGlobals",
  label: "Inline de Globais",
  description: "Copia o ambiente global (_G/getgenv) para uma tabela local no in\xEDcio da execu\xE7\xE3o. Levemente mais r\xE1pido e independente de mudan\xE7as posteriores no _G, mas exp\xF5e os nomes de globais usados no c\xF3digo.",
  defaultValue: false
};
const T_CONFUSE_NAMES = {
  id: "confuseNames",
  label: "Nomes Enganosos",
  description: "Em vez de nomes aleat\xF3rios curtos, usa nomes que parecem reais (index, iterator, loadstring, callback, etc.) para confundir quem tenta ler o c\xF3digo manualmente.",
  defaultValue: false
};
const T_DEBUG_TRAP = {
  id: "debugLib",
  label: "Trap de Debug (Anti-Hook cl\xE1ssico)",
  description: 'Insere chamadas a debug.sethook e debug.getinfo no loop da VM. \u26A0\uFE0F ARRISCADO: pode travar em executors sem debug completo. Prefira o "Anti-Debug" novo se poss\xEDvel.',
  defaultValue: false
};
const T_ANTI_TAMPER = {
  id: "antiTamper",
  label: "Anti-Tamper (Integridade)",
  description: "Embute um blob constante + checksum verificado em runtime. Qualquer reformatador, beautifier ou decompilador que toque no literal quebra a checagem e o script aborta silenciosamente.",
  star: true,
  defaultValue: false
};
const T_ANTI_DEBUG = {
  id: "antiDebug",
  label: "Anti-Debug (Hook Detection)",
  description: "Detecta debug.gethook ativo e stubs falsos de debug.sethook. Aborta o script se um decompilador estiver rodando. Mais seguro que o Trap cl\xE1ssico \u2014 n\xE3o chama sethook.",
  star: true,
  defaultValue: false
};
const T_ENV_LOCK = {
  id: "envLock",
  label: "Verifica\xE7\xE3o de Ambiente",
  description: "Confere que string.char, string.byte, string.sub e table.concat s\xE3o fun\xE7\xF5es reais antes de executar. Pega executors com sandboxing ou hooks que substituem primitivas.",
  defaultValue: false
};
const T_ROBLOX_ENV_LOCK = {
  id: "robloxEnvLock",
  label: "Roblox Env Lock",
  description: "Injeta chamadas a task.defer, Vector3.new, Vector2.new e game:GetService antes do payload. Fora do Roblox o script aborta silenciosamente \u2014 dificulta an\xE1lise em sandboxes/desobfuscadores externos.",
  star: true,
  defaultValue: true
};
const FORCED_TOGGLES = {
  intenseVm: true
};
const PLATFORMS = [
  { id: "roblox", label: "Roblox", toggles: [T_INTENSE_VM, T_GC_FIXES] },
  { id: "luau", label: "LuaU", toggles: [T_INTENSE_VM, T_GC_FIXES] },
  { id: "luajit", label: "LuaJIT", toggles: [T_INTENSE_VM, T_GC_FIXES] },
  { id: "lua54", label: "Lua 5.4", toggles: [T_INTENSE_VM, T_GC_FIXES] },
  { id: "lua53", label: "Lua 5.3", toggles: [T_INTENSE_VM, T_GC_FIXES] },
  { id: "lua52", label: "Lua 5.2", toggles: [T_INTENSE_VM, T_GC_FIXES] },
  { id: "lua51", label: "Lua 5.1", toggles: [T_INTENSE_VM, T_GC_FIXES] }
];
const VM_PLATFORMS = PLATFORMS.filter((p) => p.id === "luau" || p.id === "roblox");
function restoreVmPlatform(saved) {
  return saved === "luau" ? "luau" : "roblox";
}
void [T_PACKER, T_COMPACT_LOADER, T_INLINE_GLOBALS, T_CONFUSE_NAMES, T_DEBUG_TRAP, T_ANTI_TAMPER, T_ANTI_DEBUG, T_ENV_LOCK, T_ROBLOX_ENV_LOCK];
export {
  FORCED_TOGGLES,
  PLATFORMS,
  VM_PLATFORMS,
  restoreVmPlatform
};
