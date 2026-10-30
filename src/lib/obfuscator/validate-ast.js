import { AST_KINDS } from "./parser";
import { CAPABILITIES, dialectOf } from "./capabilities";
import { LuaDiagnostic } from "./diagnostics";
import { mapChildren } from "./ast-walk";
const EXPRESSION_KINDS = ["NumberLit", "StringLit", "BoolLit", "NilLit", "NameExpr", "BinOp", "UnOp", "Call", "MethodCall", "DotAccess", "IndexAccess", "TableCtor", "FuncExpr", "Vararg", "ParenExpr", "IfExpr"];
const expressions = new Set(EXPRESSION_KINDS);
const reserved = new Set("and break do else elseif end false for function goto if in local nil not or repeat return then true until while".split(" "));
function validateAst(ast, target = "luau", phase = "emit") {
  const caps = CAPABILITIES[dialectOf(target)];
  const fail = (node, code, feature, path) => {
    throw new LuaDiagnostic(code, phase, `${node.kind}: ${feature}`, target, node.span, path);
  };
  const name = (value, node, path) => {
    if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(value) || reserved.has(value) || value === "continue" && caps.continue) fail(node, "INVALID_IDENTIFIER", value, path);
  };
  const lvalue = (n, path) => {
    if (!["NameExpr", "DotAccess", "IndexAccess"].includes(n.kind)) fail(n, "INVALID_LVALUE", n.kind, path);
  };
  function check(node, path, loops, varargs) {
    if (!node || typeof node !== "object" || typeof node.kind !== "string") throw new LuaDiagnostic("INVALID_NODE", phase, "missing node kind", target, void 0, path);
    if (!(node.kind in AST_KINDS)) fail(node, "UNKNOWN_NODE", String(node.kind), path);
    if (node.luauInterpolation && dialectOf(target) !== "luau") fail(node, "UNSUPPORTED_FEATURE", "interpolation requires Luau format conversion", path);
    if (node.kind === "Block") {
      node.body.forEach((n, i2) => {
        if (expressions.has(n.kind)) fail(n, "EXPRESSION_AS_STATEMENT", n.kind, `${path}.body[${i2}]`);
        if (n.kind === "Return" && i2 !== node.body.length - 1) fail(n, "RETURN_POSITION", "return must end its block", path);
        if (dialectOf(target) === "lua51" && n.kind === "Break" && i2 !== node.body.length - 1) fail(n, "BREAK_POSITION", "break must end its block in Lua 5.1", path);
        check(n, `${path}.body[${i2}]`, loops, varargs);
      });
      return;
    }
    const lexicalEnvironment = !["luau", "roblox", "lua51", "luajit"].includes(target);
    if (node.kind === "NameExpr") {
      name(node.name, node, path);
      if (node.name === "_ENV" && phase === "virtualize" && lexicalEnvironment) fail(node, "UNSUPPORTED_VM_ENV", "lexical _ENV is not implemented by this VM", path);
    }
    if (node.kind === "DotAccess") name(node.field, node, path);
    if (node.kind === "MethodCall") name(node.method, node, path);
    if (node.kind === "LocalDecl") {
      if (node.names.includes("LPY_NO_VIRTUALIZE")) fail(node, "RESERVED_MACRO", "LPY_NO_VIRTUALIZE", path);
      if (node.names.includes("_ENV") && phase === "virtualize" && lexicalEnvironment) fail(node, "UNSUPPORTED_VM_ENV", "lexical _ENV", path);
      if (!node.names.length) fail(node, "EMPTY_DECLARATION", "no names", path);
      node.names.forEach((n) => name(n, node, path));
    }
    if (node.kind === "GenericFor") node.names.forEach((n) => name(n, node, path));
    if (node.kind === "NumericFor") name(node.var_, node, path);
    if (node.kind === "Assign") {
      if (!node.targets.length || !node.exprs.length) fail(node, "INVALID_ASSIGNMENT", "empty list", path);
      node.targets.forEach((n) => lvalue(n, path));
    }
    if (node.kind === "CompoundAssign") {
      lvalue(node.target, path);
      if (!caps.compound) fail(node, "UNSUPPORTED_FEATURE", "compound assignment", path);
      if (!["+=", "-=", "*=", "/=", "//=", "%=", "^=", "..="].includes(node.op)) fail(node, "INVALID_OPERATOR", node.op, path);
    }
    if (node.kind === "Continue" && !caps.continue) fail(node, "UNSUPPORTED_FEATURE", "continue", path);
    if ((node.kind === "Break" || node.kind === "Continue") && loops === 0) fail(node, "INVALID_LOOP_CONTROL", node.kind, path);
    if (node.kind === "Vararg" && !varargs) fail(node, "INVALID_VARARG", "vararg outside vararg function", path);
    if (node.kind === "ExprStmt" && !["Call", "MethodCall"].includes(node.expr.kind)) fail(node, "INVALID_STATEMENT", "only calls are expression statements", path);
    if (node.kind === "IfExpr" && !caps.ifExpression) fail(node, "UNSUPPORTED_FEATURE", "conditional expression", path);
    if (node.kind === "BinOp") {
      if (!["or", "and", "<", ">", "<=", ">=", "==", "~=", "|", "~", "&", "<<", ">>", "..", "+", "-", "*", "/", "//", "%", "^"].includes(node.op)) fail(node, "INVALID_OPERATOR", node.op, path);
      if (node.op === "//" && !caps.integerDivision) fail(node, "UNSUPPORTED_FEATURE", "integer division", path);
      if (["|", "~", "&", "<<", ">>"].includes(node.op) && (!caps.bitwise || phase === "virtualize")) fail(node, "UNSUPPORTED_FEATURE", "native integer bitwise operations", path);
    }
    if (node.kind === "UnOp") {
      if (!["not", "-", "#", "~"].includes(node.op)) fail(node, "INVALID_OPERATOR", node.op, path);
      if (node.op === "~" && (!caps.bitwise || phase === "virtualize")) fail(node, "UNSUPPORTED_FEATURE", "native integer bitwise operation", path);
    }
    if (node.kind === "NumberLit") {
      if (node.exact && Object.is(node.value, node.exact.valueAtParse)) {
        if (/^0[bB]|_/.test(node.exact.lexeme) && !caps.binary) fail(node, "UNSUPPORTED_FEATURE", "binary/underscored numeral", path);
        if (node.exact.integer && caps.integer64 && phase === "virtualize") fail(node, "UNSUPPORTED_VM_INTEGER", "integer subtype is not represented by the VM", path);
        if (node.exact.integer && !Number.isSafeInteger(node.value) && phase === "virtualize") fail(node, "UNSUPPORTED_VM_INTEGER", "integer precision exceeds VM Number", path);
        if (!Number.isFinite(node.value)) fail(node, "NUMERIC_OVERFLOW", "literal outside supported range", path);
      }
    }
    if (node.kind === "TableCtor") node.fields.forEach((f, i2) => {
      if (f.style === "named" && (f.key?.kind !== "StringLit" || !/^[A-Za-z_][A-Za-z_0-9]*$/.test(f.key.value) || reserved.has(f.key.value))) fail(node, "INVALID_TABLE_FIELD", `named field ${i2}`, path);
    });
    if (node.kind === "LocalFunc" || node.kind === "FuncExpr") {
      if (node.kind === "LocalFunc") name(node.name, node, path);
      node.params.forEach((p) => {
        name(p, node, path);
        if (p === "LPY_NO_VIRTUALIZE") fail(node, "RESERVED_MACRO", p, path);
      });
      check(node.body, `${path}.body`, 0, node.hasVararg);
      return;
    }
    const isLoop = ["While", "Repeat", "NumericFor", "GenericFor"].includes(node.kind);
    let i = 0;
    mapChildren(node, (child) => {
      check(child, `${path}.${i++}:${child.kind}`, isLoop && child.kind === "Block" ? loops + 1 : loops, varargs);
      return child;
    });
  }
  check(ast, "root", 0, true);
}
export {
  EXPRESSION_KINDS,
  validateAst
};
