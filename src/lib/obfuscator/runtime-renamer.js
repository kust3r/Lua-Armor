import { resolveBindings } from "./bindings";
import { walk } from "./ast-walk";
import { parse } from "./parser";
import { tokenize } from "./lexer";
import { astToLua } from "./unparser";
import { numberLiteral } from "./literal-values";
const reserved = new Set("and break do else elseif end false for function goto if in local nil not or repeat return then true until while continue type export _ENV _G".split(" "));
function renameRuntimeBindings(source, seed, presentation = {}) {
  const ast = parse(tokenize(source));
  const analysis = resolveBindings(ast);
  const occupied = new Set(reserved);
  walk(ast, (node) => {
    if (node.kind === "NameExpr" && !analysis.uses.has(node)) occupied.add(node.name);
  });
  let state = (seed ^ 2654435769) >>> 0;
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  for (let i = alphabet.length - 1; i > 0; i--) {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    const j = state % (i + 1);
    [alphabet[i], alphabet[j]] = [alphabet[j], alphabet[i]];
  }
  let counter = 0;
  const spelling = (index) => {
    let n = index, name = "";
    do {
      name = alphabet[n % 52] + name;
      n = Math.floor(n / 52) - 1;
    } while (n >= 0);
    return name;
  };
  const names = /* @__PURE__ */ new Map();
  for (const binding of analysis.bindings) {
    if (binding.name === "_ENV") {
      names.set(binding.id, "_ENV");
      continue;
    }
    const forbidden = new Set(occupied);
    if (presentation.reuseNames !== false) for (const id of analysis.conflicts.get(binding.id) ?? []) {
      const name2 = names.get(id);
      if (name2) forbidden.add(name2);
    }
    let index = presentation.reuseNames === false ? counter : 0;
    while (forbidden.has(spelling(index))) index++;
    const name = spelling(index);
    names.set(binding.id, name);
    if (presentation.reuseNames === false) {
      counter = index + 1;
      occupied.add(name);
    }
  }
  const before = [];
  walk(ast, (node) => {
    const declarations = analysis.declarations.get(node);
    if (declarations) {
      const values = declarations.map((b) => names.get(b.id) ?? b.name);
      if (node.kind === "LocalDecl" || node.kind === "GenericFor") node.names = values;
      else if (node.kind === "NumericFor") node.var_ = values[0];
      else if (node.kind === "LocalFunc") {
        node.name = values[0];
        node.params = (analysis.declarations.get(node.body) ?? []).map((b) => names.get(b.id) ?? b.name);
      } else if (node.kind === "FuncExpr") node.params = values;
      else if (node.kind === "Block") {
        const owner = declarations[0]?.owner;
        if (owner?.kind === "LocalFunc") owner.params = values;
      }
    }
    if (node.kind === "NameExpr") {
      const binding = analysis.uses.get(node);
      before.push(binding?.id ?? node.name);
      if (binding) node.name = names.get(binding.id) ?? node.name;
    }
    if (node.kind === "NumberLit" && presentation.decimalNumbers) {
      const decimal = node.exact?.integer ?? numberLiteral(node.value);
      node.exact = { lexeme: decimal, valueAtParse: node.value, integer: node.exact?.integer };
    }
  });
  const code = astToLua(ast, { target: "luau", mode: "compact", protectedLiteralText: ["Roblox"] }).code;
  if (presentation.reuseNames !== false) {
    const reparsed = parse(tokenize(code)), resolved = resolveBindings(reparsed);
    const after = [];
    walk(reparsed, (n) => {
      if (n.kind === "NameExpr") after.push(resolved.uses.get(n)?.id ?? n.name);
    });
    if (before.length !== after.length || before.some((v, i) => v !== after[i])) throw new Error("E_BINDING_RENAME");
  }
  return code;
}
export {
  renameRuntimeBindings
};
