import { walk } from "./ast-walk";
import { resolveBindings } from "./bindings";
import { parse } from "./parser";
import { tokenize } from "./lexer";
import { astToLua } from "./unparser";
function pureNumeric(node) {
  if (node.kind === "NumberLit") return Number.isFinite(node.value) ? node.value : void 0;
  if (node.kind === "ParenExpr") return pureNumeric(node.expr);
  if (node.kind === "UnOp" && node.op === "-") {
    const n = pureNumeric(node.expr);
    return n === void 0 ? void 0 : -n;
  }
  if (node.kind !== "BinOp" || !["+", "-", "*"].includes(node.op)) return void 0;
  const left = pureNumeric(node.left), right = pureNumeric(node.right);
  if (left === void 0 || right === void 0) return void 0;
  const value = node.op === "+" ? left + right : node.op === "-" ? left - right : left * right;
  return Number.isFinite(value) ? value : void 0;
}
function removeUnusedNumericTables(source) {
  const ast = parse(tokenize(source)), analysis = resolveBindings(ast), used = /* @__PURE__ */ new Set();
  walk(ast, (node) => {
    if (node.kind === "NameExpr") {
      const b = analysis.uses.get(node);
      if (b) used.add(b.id);
    }
  });
  const discarded = /* @__PURE__ */ new Set();
  walk(ast, (node) => {
    if (node.kind !== "LocalDecl" || node.names.length !== 1 || node.exprs.length !== 1) return;
    const binding = analysis.declarations.get(node)?.[0], table = node.exprs[0];
    if (!binding || used.has(binding.id) || table.kind !== "TableCtor" || !table.fields.length) return;
    if (table.fields.every((field) => field.style === "sequence" && pureNumeric(field.value) !== void 0)) discarded.add(node);
  });
  walk(ast, (node) => {
    if (node.kind === "Block") node.body = node.body.filter((statement) => {
      if (discarded.has(statement)) return false;
      if (statement.kind === "DoBlock" && statement.body.body.length > 0 && statement.body.body.every((s) => discarded.has(s))) return false;
      return true;
    });
  });
  return { code: astToLua(ast, { target: "luau", mode: "compact", protectedLiteralText: ["Roblox"] }).code, removed: discarded.size };
}
export {
  removeUnusedNumericTables
};
