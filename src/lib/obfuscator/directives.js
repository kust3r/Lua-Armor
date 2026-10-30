import { LuaDiagnostic } from "./diagnostics";
function sourceDirectives(ast, target, phase) {
  const result = [];
  for (const trivia of ast.comments ?? []) {
    if (!trivia.directive) continue;
    const directive = trivia.text.trim();
    const recognized = ["--!strict", "--!nonstrict", "--!nocheck"].includes(directive);
    if (!recognized || target !== "luau" && target !== "roblox" || phase === "virtualize") {
      throw new LuaDiagnostic("UNSUPPORTED_DIRECTIVE", phase, `${directive}: cannot transfer this directive to ${target} ${phase}`, target);
    }
    result.push(directive);
  }
  return result;
}
export {
  sourceDirectives
};
