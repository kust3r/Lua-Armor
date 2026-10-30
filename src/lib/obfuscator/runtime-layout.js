import { resolveBindings } from "./bindings";
import { walk } from "./ast-walk";
import { parse } from "./parser";
import { tokenize } from "./lexer";
import { astToLua } from "./unparser";
function distributeRuntimeHelpers(source, helperNames) {
  const ast = parse(tokenize(source));
  let runtime;
  let entry;
  walk(ast, (n) => {
    if (runtime || n.kind !== "TableCtor") return;
    const field = n.fields.find((f) => f.style === "named" && f.key.value === "x" && f.value.kind === "FuncExpr");
    if (field?.value.kind === "FuncExpr" && helperNames.every((name) => {
      let found = false;
      walk(field.value, (child) => {
        if (child.kind === "LocalDecl" && child.names.includes(name) && child.exprs[0]?.kind === "FuncExpr") found = true;
      });
      return found;
    })) {
      runtime = n;
      entry = field.value;
    }
  });
  if (!runtime || !entry?.params[0]) throw new Error("E_RUNTIME_LAYOUT");
  const table = runtime, receiver = entry.params[0];
  const analysis = resolveBindings(ast);
  const selected = /* @__PURE__ */ new Set();
  const selectedBindings = /* @__PURE__ */ new Set();
  const selectedFunctions = /* @__PURE__ */ new Set();
  walk(entry, (n) => {
    if (n.kind === "LocalDecl" && helperNames.includes(n.names[0]) && n.exprs[0]?.kind === "FuncExpr") {
      const b = analysis.declarations.get(n)?.[0];
      if (b) selectedBindings.add(b.id);
      selectedFunctions.add(n.exprs[0]);
    }
  });
  for (const fn of selectedFunctions) walk(fn, (n) => {
    if (n.kind === "NameExpr" && selectedBindings.has(analysis.uses.get(n)?.id ?? -1)) throw new Error("E_RUNTIME_HELPER_DEPENDENCY");
  });
  const receiverBinding = analysis.declarations.get(entry)?.[0];
  const keys = new Set(table.fields.flatMap((f) => f.style === "named" ? [f.key.value] : []));
  for (const [index, helperName] of helperNames.entries()) {
    let declaration, fn, binding;
    walk(entry, (n) => {
      if (n.kind === "LocalDecl" && n.names.length === 1 && n.names[0] === helperName && n.exprs[0]?.kind === "FuncExpr") {
        declaration = n;
        fn = n.exprs[0];
        binding = analysis.declarations.get(n)?.[0];
      }
    });
    if (!declaration || !fn || !binding) throw new Error("E_RUNTIME_HELPER");
    const localBindings = /* @__PURE__ */ new Set();
    walk(fn, (n) => {
      for (const b of analysis.declarations.get(n) ?? []) localBindings.add(b.id);
    });
    const captures = /* @__PURE__ */ new Map();
    walk(fn, (n) => {
      if (n.kind === "NameExpr") {
        const b = analysis.uses.get(n);
        if (b && !localBindings.has(b.id)) captures.set(b.id, b);
      }
    });
    walk(ast, (n) => {
      const targets = n.kind === "Assign" ? n.targets : n.kind === "CompoundAssign" ? [n.target] : [];
      for (const target of targets) if (target.kind === "NameExpr") {
        const b = analysis.uses.get(target);
        if (b && captures.has(b.id)) throw new Error("E_RUNTIME_MUTABLE_CAPTURE");
      }
    });
    let key = `_h${index}`;
    while (keys.has(key)) key += "_";
    keys.add(key);
    const dependencies = [...captures.values()];
    const allNames = new Set(analysis.bindings.map((b) => b.name));
    walk(ast, (n) => {
      if (n.kind === "NameExpr") allNames.add(n.name);
    });
    const aliases = dependencies.map((b) => {
      let alias = `_dep${b.id}`;
      while (allNames.has(alias)) alias += "_";
      allNames.add(alias);
      return alias;
    });
    walk(fn, (n) => {
      if (n.kind === "NameExpr") {
        const b = analysis.uses.get(n);
        const depIndex = dependencies.findIndex((d) => d.id === b?.id);
        if (depIndex >= 0) n.name = aliases[depIndex];
      }
    });
    fn.params = [...aliases, ...fn.params];
    const rewritten = /* @__PURE__ */ new Set();
    walk(entry, (n) => {
      if (n.kind === "Call" && n.func.kind === "NameExpr" && analysis.uses.get(n.func)?.id === binding?.id) {
        const visible = analysis.boundaries.get(n.func);
        if (dependencies.some((b) => visible?.get(b.name)?.id !== b.id) || visible?.get(receiver)?.id !== receiverBinding?.id) throw new Error("E_RUNTIME_SHADOWED_DEPENDENCY");
        rewritten.add(n.func);
        n.func = { kind: "DotAccess", obj: { kind: "NameExpr", name: receiver }, field: key };
        n.args = [...dependencies.map((b) => ({ kind: "NameExpr", name: b.name })), ...n.args];
      }
    });
    walk(entry, (n) => {
      if (n.kind === "NameExpr" && analysis.uses.get(n)?.id === binding?.id && !rewritten.has(n)) throw new Error("E_RUNTIME_HELPER_ESCAPE");
    });
    table.fields.push({ style: "named", key: { kind: "StringLit", value: key }, value: fn });
    selected.add(declaration);
  }
  walk(entry, (n) => {
    if (n.kind === "Block") n.body = n.body.filter((st) => !selected.has(st));
  });
  return astToLua(ast, { target: "luau", mode: "compact", protectedLiteralText: ["Roblox"] }).code;
}
export {
  distributeRuntimeHelpers
};
