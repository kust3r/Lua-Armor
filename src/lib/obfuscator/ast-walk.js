import { unreachable } from "./diagnostics";
function mapChildren(node, visit) {
  const block = (n) => visit(n);
  switch (node.kind) {
    case "Block":
      return { ...node, body: node.body.map(visit) };
    case "LocalDecl":
      return { ...node, exprs: node.exprs.map(visit) };
    case "LocalFunc":
    case "FuncExpr":
      return { ...node, body: block(node.body) };
    case "Assign":
      return { ...node, targets: node.targets.map(visit), exprs: node.exprs.map(visit) };
    case "CompoundAssign":
      return { ...node, target: visit(node.target), expr: visit(node.expr) };
    case "If":
      return { ...node, cond: visit(node.cond), then_: block(node.then_), elseifs: node.elseifs.map((b) => ({ cond: visit(b.cond), body: block(b.body) })), else_: node.else_ && block(node.else_) };
    case "IfExpr":
      return { ...node, cond: visit(node.cond), thenExpr: visit(node.thenExpr), elseExpr: visit(node.elseExpr) };
    case "While":
    case "Repeat":
      return { ...node, cond: visit(node.cond), body: block(node.body) };
    case "NumericFor":
      return { ...node, start: visit(node.start), stop: visit(node.stop), step: node.step && visit(node.step), body: block(node.body) };
    case "GenericFor":
      return { ...node, iters: node.iters.map(visit), body: block(node.body) };
    case "DoBlock":
      return { ...node, body: block(node.body) };
    case "Return":
      return { ...node, exprs: node.exprs.map(visit) };
    case "ExprStmt":
    case "UnOp":
    case "ParenExpr":
      return { ...node, expr: visit(node.expr) };
    case "BinOp":
      return { ...node, left: visit(node.left), right: visit(node.right) };
    case "Call":
      return { ...node, func: visit(node.func), args: node.args.map(visit) };
    case "MethodCall":
      return { ...node, obj: visit(node.obj), args: node.args.map(visit) };
    case "DotAccess":
      return { ...node, obj: visit(node.obj) };
    case "IndexAccess":
      return { ...node, obj: visit(node.obj), index: visit(node.index) };
    case "TableCtor":
      return { ...node, fields: node.fields.map((f) => f.style === "sequence" ? { ...f, value: visit(f.value) } : f.style === "named" ? { ...f, key: visit(f.key), value: visit(f.value) } : { ...f, key: visit(f.key), value: visit(f.value) }) };
    case "NumberLit":
    case "StringLit":
    case "BoolLit":
    case "NilLit":
    case "NameExpr":
    case "Vararg":
    case "Break":
    case "Continue":
      return { ...node };
    default:
      return unreachable(node);
  }
}
function walk(node, visit) {
  visit(node);
  mapChildren(node, (child) => {
    walk(child, visit);
    return child;
  });
}
function transform(node, visit) {
  return visit(mapChildren(node, (child) => transform(child, visit)));
}
export {
  mapChildren,
  transform,
  walk
};
