import { generateHardenedVM, assertHardenedOptions } from "./hardened-v4";
import { normalizeToggles } from "./normalize-toggles";
import { assertExternalGenerationAllowed, withGenerationSession, observeGeneration } from "./generation-session";
import { withRandomDomains } from "./generation-random";
import { validateArtifactContract } from "./output-contract";
import { renameRuntimeBindings } from "./runtime-renamer";
import { ENGINE_VERSION, effectiveSeed, byteLength } from "./generation-context";
import { sourceDirectives } from "./directives";
import { walk } from "./ast-walk";
import { validateAst } from "./validate-ast";
import { LuaDiagnostic, serializeDiagnostic } from "./diagnostics";
import { DEFAULT_NAME_CONFIG } from "./types";
import { tokenize } from "./lexer";
import { parse } from "./parser";
import { compile } from "./compiler";
import { generateVM, validateLuaOutput, hideBuiltinNames } from "./vm-codegen";
import { flattenControlFlow } from "./obfuscations/control-flow";
import { applyHardening, hardeningFromToggles } from "./obfuscations/hardening";
import { configureNames, withNameState } from "./names";
import { preprocessMacros } from "./macros";
import { packLua } from "./packer";
import { wrapWithLZMA } from "./lzma-wrapper";
function notify(observer, event) {
  observeGeneration(observer ? () => observer(event) : void 0);
}
function tryObfuscate(input, level, nameConfig, toggles, target = "luau", diagnostic = false, observer, attempt = 1, audit, session) {
  notify(observer, { phase: 0, status: "running", attempt });
  const config = { ...nameConfig || DEFAULT_NAME_CONFIG };
  if (toggles?.confuseNames) {
    config.nameStyle = "confuse";
  }
  configureNames(config);
  const pre = preprocessMacros(input);
  if (pre.errors.length > 0) {
    throw new Error(`Macro error: ${pre.errors.join("; ")}`);
  }
  if (toggles?.directOutput && pre.used.some((name) => name === "LPY_ENCFUNC" || name === "LPY_FUNCENC")) {
    throw new LuaDiagnostic("UNSUPPORTED_DYNAMIC_MACRO", "virtualize", "LPY_ENCFUNC requires explicit dynamic loader mode", target);
  }
  const tokens = tokenize(pre.code);
  const ast = parse(tokens);
  sourceDirectives(ast, target, "virtualize");
  validateAst(ast, target, "virtualize");
  if (target !== "luau" && target !== "roblox") throw new LuaDiagnostic("UNSUPPORTED_VM_TARGET", "virtualize", "legacy VM emitter is not dialect-safe; use explicit source emission for this target", target);
  walk(ast, (n) => {
    if (n.kind === "FuncExpr" && n.virtualization === "native" && toggles?.hardcodeGlobals) throw new LuaDiagnostic("UNSUPPORTED_NATIVE_GLOBAL_SNAPSHOT", "virtualize", "hardcodeGlobals with native functions", target, n.span);
  });
  const finalAst = level >= 3 ? flattenControlFlow(ast) : ast;
  const { proto, opcodes } = compile(finalAst, [], false, target);
  notify(observer, { phase: 0, status: "done", attempt });
  notify(observer, { phase: 1, status: "running", attempt });
  let emission;
  const raw = generateVM(proto, opcodes, level, { ...toggles, diagnosticInstructionLimit: diagnostic && toggles?.diagnosticInstructionLimit === true }, diagnostic, audit ? (report) => {
    emission = report;
  } : void 0, session);
  let body = raw;
  const hardening = hardeningFromToggles(toggles || {}, nameConfig?.seed ?? void 0);
  body = applyHardening(body, hardening, level);
  body = hideBuiltinNames(body);
  const finalize = (source) => {
    const renamed = renameRuntimeBindings(source, nameConfig?.seed ?? 0, { reuseNames: toggles?.legacyRuntimeNames !== true, decimalNumbers: toggles?.legacyNumberFormat !== true });
    if (audit && emission) {
      const finalBytes = byteLength(renamed);
      observeGeneration(() => audit({ ...emission, finalBytes, transforms: [{ name: "hardening-hiding-wrapping", bytes: byteLength(source) - emission.rawBytes }, { name: "binding-renaming-and-compaction", bytes: finalBytes - byteLength(source) }] }));
    }
    return renamed;
  };
  if (toggles?.packer) {
    body = packLua(body);
    notify(observer, { phase: 1, status: "done", attempt });
    return finalize(body);
  }
  if (toggles?.lzmaWrapper) {
    body = wrapWithLZMA(body);
  } else if (toggles?.directOutput) {
    body = `return(function(...)${body} end)(...)`;
  }
  notify(observer, { phase: 1, status: "done", attempt });
  return finalize(body);
}
function platformToggles(options) {
  const p = options.platform;
  return {
    ...normalizeToggles(options.toggles),
    singleDispatchTree: options.toggles.partitionedDispatch !== true,
    // Never let a non-Roblox platform accidentally inherit Roblox-only probes.
    robloxEnvLock: p === "roblox" && options.toggles.robloxEnvLock !== false,
    // LZMA wrapper uses buffer API — Luau/Roblox only
    lzmaWrapper: options.execution?.loader === "dynamic",
    vmCompression: options.execution?.loader === "dynamic" && options.toggles.vmCompression === true,
    packer: options.execution?.loader === "dynamic" && options.toggles.packer === true,
    directOutput: options.execution?.loader !== "dynamic",
    // Roblox VM shares a time budget across nested calls; yielding is not free
    // and must only happen after measured work, never a fixed instruction count.
    robloxYield: options.execution?.cooperativeYield === true
  };
}
function validateOutput(output) {
  try {
    validateArtifactContract(output);
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Invalid artifact" };
  }
  return validateLuaOutput(output);
}
function obfuscateWithRetry(input, requestedLevel, nameConfig, toggles, target = "luau", observer, audit, session) {
  let sequence = 0;
  const levels = [requestedLevel];
  if (requestedLevel > 1) levels.push(requestedLevel - 1);
  if (requestedLevel > 2) levels.push(1);
  for (const level of levels) {
    const maxAttempts = level === requestedLevel ? 5 : 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const output = tryObfuscate(input, level, nameConfig, toggles, target, false, observer, ++sequence, audit, session);
        notify(observer, { phase: 2, status: "running", attempt: sequence });
        const validation = validateOutput(output);
        if (validation.valid) {
          notify(observer, { phase: 2, status: "done", attempt: sequence });
          return { output, usedLevel: level, retried: level !== requestedLevel || attempt > 0, attempts: sequence };
        }
      } catch (error) {
        if (error instanceof LuaDiagnostic) throw error;
        continue;
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    try {
      const output = tryObfuscate(input, 1, nameConfig, toggles, target, false, observer, ++sequence, audit, session);
      notify(observer, { phase: 2, status: "running", attempt: sequence });
      const validation = validateOutput(output);
      if (validation.valid) {
        notify(observer, { phase: 2, status: "done", attempt: sequence });
        return { output, usedLevel: 1, retried: true, attempts: sequence };
      }
    } catch (error) {
      if (error instanceof LuaDiagnostic) throw error;
      continue;
    }
  }
  throw new Error("N\xE3o foi poss\xEDvel gerar uma sa\xEDda estruturalmente v\xE1lida ap\xF3s reduzir o n\xEDvel.");
}
async function obfuscateWithSteps(input, options, onProgress) {
  assertExternalGenerationAllowed();
  let steps = ["Preparing & Compiling", "Obfuscating", "Finishing Up"].map((label) => ({ label, status: "pending", progress: 0 }));
  try {
    return obfuscateWithReport(input, options, (event) => {
      if (event.phase === 0 && event.status === "running") steps = steps.map((step) => ({ ...step, status: "pending", progress: 0 }));
      steps[event.phase] = { ...steps[event.phase], status: event.status, progress: event.status === "done" ? 100 : 0 };
      onProgress(steps.map((step) => ({ ...step })));
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    const active = Math.max(0, steps.findIndex((step) => step.status === "running"));
    steps[active] = { ...steps[active], status: "error", error: message };
    onProgress(steps);
    return { output: "", error: message, diagnostic: serializeDiagnostic(error) };
  }
}
function obfuscate(input, options) {
  return obfuscateWithReport(input, options).output;
}
function obfuscateWithReport(input, options, observer, audit) {
  return withGenerationSession((session) => withNameState(() => {
    const result = obfuscateInSession(input, options, session, observer, audit);
    return { ...result, callbackErrors: [...session.callbackErrors] };
  }));
}
function obfuscateInSession(input, options, session, observer, audit) {
  notify(observer, { phase: 0, status: "running", attempt: 1 });
  const syntax = validateLuaSyntax(input);
  if (!syntax.valid) {
    if (syntax.diagnostic) {
      syntax.diagnostic.target ??= options.platform;
      throw syntax.diagnostic;
    }
    throw new Error(syntax.error || "Invalid Lua syntax");
  }
  const seed = effectiveSeed(options.nameConfig?.seed);
  const names = { ...DEFAULT_NAME_CONFIG, ...options.nameConfig, seed };
  const toggles = platformToggles(options);
  return withGenerationSeed(seed, () => {
    const candidate = options.hardenedVmVersion === 4;
    let result;
    if (candidate) {
      assertHardenedOptions(options.optimizationLevel, options.execution?.loader === "dynamic", options.execution?.cooperativeYield === true);
      if (options.platform !== "luau" && options.platform !== "roblox") throw new LuaDiagnostic("UNSUPPORTED_VM_TARGET", "virtualize", "v4 candidate emits Luau only", options.platform);
      const pre = preprocessMacros(input);
      if (pre.errors.length) throw new Error(pre.errors.join("; "));
      if (pre.used.some((n) => n === "LPY_ENCFUNC" || n === "LPY_FUNCENC")) throw new LuaDiagnostic("UNSUPPORTED_DYNAMIC_MACRO", "virtualize", "v4 direct mode does not compile dynamic source", options.platform);
      const ast = parse(tokenize(pre.code));
      sourceDirectives(ast, options.platform, "virtualize");
      validateAst(ast, options.platform, "virtualize");
      const compiled = compile(ast, [], false, options.platform, { wholeStringLiterals: true });
      notify(observer, { phase: 0, status: "done", attempt: 1 });
      notify(observer, { phase: 1, status: "running", attempt: 1 });
      const generated = generateHardenedVM(compiled.proto, compiled.opcodes, options.hardenedVmMode ?? "full");
      const hardened = applyHardening(generated.code, hardeningFromToggles(toggles, seed), 3);
      const output2 = renameRuntimeBindings(`return(function(...) ${hardened} end)(...)`, seed, { reuseNames: true, decimalNumbers: true });
      notify(observer, { phase: 1, status: "done", attempt: 1 });
      notify(observer, { phase: 2, status: "running", attempt: 1 });
      const checked = validateOutput(output2);
      if (!checked.valid) throw new Error(checked.error ?? "v4 output rejected");
      notify(observer, { phase: 2, status: "done", attempt: 1 });
      result = { output: output2, usedLevel: 3, attempts: 1 };
    } else result = obfuscateWithRetry(input, options.optimizationLevel, names, toggles, options.platform, observer, audit, session);
    const { output, usedLevel, attempts } = result;
    const metadata = { engineVersion: ENGINE_VERSION, ...candidate ? { hardenedVmVersion: 4, hardenedVmRevision: 3, hardenedVmMode: options.hardenedVmMode ?? "full" } : {}, seed, requestedLevel: options.optimizationLevel, usedLevel, attempts, platform: options.platform, toggles, names: { charset: names.charset, minLength: names.minLength, maxLength: names.maxLength, nameStyle: names.nameStyle ?? "mangled" }, execution: { loader: options.execution?.loader ?? "direct", cooperativeYield: options.execution?.cooperativeYield === true }, validation: "structural" };
    return { output, usedLevel, validation: "structural", metadata };
  });
}
function validateLuaSyntax(code) {
  try {
    const pre = preprocessMacros(code);
    if (pre.errors.length > 0) {
      return { valid: false, error: pre.errors.join("; ") };
    }
    const tokens = tokenize(pre.code);
    parse(tokens);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Lua syntax error",
      diagnostic: error instanceof LuaDiagnostic ? error : void 0
    };
  }
}
function obfuscateDiagnostic(input, options, diagnostic = true) {
  return withGenerationSession((session) => withNameState(() => {
    const seed = effectiveSeed(options.nameConfig?.seed);
    return withGenerationSeed(seed, () => tryObfuscate(input, options.optimizationLevel, { ...DEFAULT_NAME_CONFIG, ...options.nameConfig, seed }, { ...platformToggles(options), robloxYield: true, robloxEnvLock: false }, options.platform, diagnostic, void 0, 1, void 0, session));
  }));
}
function withGenerationSeed(seed, emit) {
  return seed == null ? emit() : withRandomDomains(seed, emit);
}
export {
  obfuscate,
  obfuscateDiagnostic,
  obfuscateWithReport,
  obfuscateWithSteps,
  validateLuaSyntax
};
