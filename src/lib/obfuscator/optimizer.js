import { mapChildren } from "./ast-walk";
import { utf8Bytes } from "./literal-values";
function foldConstants(node) {
  if (node.kind === "BinOp") {
    const left = foldConstants(node.left);
    const right = foldConstants(node.right);
    if (left.kind === "NumberLit" && right.kind === "NumberLit") {
      const l = left.value;
      const r = right.value;
      let result = null;
      switch (node.op) {
        case "+":
          result = l + r;
          break;
        case "-":
          result = l - r;
          break;
        case "*":
          result = l * r;
          break;
        case "/":
          if (r !== 0) result = l / r;
          break;
        case "%":
          if (r !== 0) result = l - Math.floor(l / r) * r;
          break;
        case "^":
          result = Math.pow(l, r);
          break;
        case "//":
          if (r !== 0) result = Math.floor(l / r);
          break;
      }
      if (result !== null && isFinite(result)) {
        return { kind: "NumberLit", value: result };
      }
    }
    if (node.op === ".." && left.kind === "StringLit" && right.kind === "StringLit") {
      const value = left.value + right.value;
      return { kind: "StringLit", value, valueAtParse: value, bytes: [...left.bytes ?? utf8Bytes(left.value), ...right.bytes ?? utf8Bytes(right.value)] };
    }
    if (node.op === "and") {
      if (left.kind === "BoolLit" && !left.value) return left;
      if (left.kind === "NilLit") return left;
      if (left.kind === "BoolLit" && left.value) return { kind: "ParenExpr", expr: right };
    }
    if (node.op === "or") {
      if (left.kind === "BoolLit" && left.value) return left;
      if (left.kind === "BoolLit" && !left.value) return { kind: "ParenExpr", expr: right };
      if (left.kind === "NilLit") return { kind: "ParenExpr", expr: right };
    }
    if (left.kind === "NumberLit" && right.kind === "NumberLit") {
      const lv = left.value;
      const rv = right.value;
      switch (node.op) {
        case "==":
          return { kind: "BoolLit", value: lv === rv };
        case "~=":
          return { kind: "BoolLit", value: lv !== rv };
        case "<":
          return { kind: "BoolLit", value: lv < rv };
        case ">":
          return { kind: "BoolLit", value: lv > rv };
        case "<=":
          return { kind: "BoolLit", value: lv <= rv };
        case ">=":
          return { kind: "BoolLit", value: lv >= rv };
      }
    }
    return { ...node, left, right };
  }
  if (node.kind === "UnOp") {
    const expr = foldConstants(node.expr);
    if (node.op === "-" && expr.kind === "NumberLit") {
      return { kind: "NumberLit", value: -expr.value };
    }
    if (node.op === "not" && expr.kind === "BoolLit") {
      return { kind: "BoolLit", value: !expr.value };
    }
    if (node.op === "not" && expr.kind === "NilLit") {
      return { kind: "BoolLit", value: true };
    }
    if (node.op === "#" && expr.kind === "StringLit") {
      return { kind: "NumberLit", value: (expr.bytes ?? utf8Bytes(expr.value)).length };
    }
    return { ...node, expr };
  }
  return node;
}
function eliminateDeadCode(block) {
  const newBody = [];
  let reachable = true;
  for (const stmt of block.body) {
    if (!reachable) continue;
    if (stmt.kind === "Return" || stmt.kind === "Break" || stmt.kind === "Continue") {
      newBody.push(stmt);
      reachable = false;
      continue;
    }
    if (stmt.kind === "DoBlock" && stmt.body.body.length === 0) continue;
    if (stmt.kind === "While" && stmt.cond.kind === "BoolLit" && !stmt.cond.value) continue;
    if (stmt.kind === "If" && stmt.cond.kind === "BoolLit" && !stmt.cond.value && stmt.elseifs.length === 0) {
      if (stmt.else_) {
        newBody.push({ kind: "DoBlock", body: stmt.else_ });
      }
      continue;
    }
    if (stmt.kind === "If" && stmt.cond.kind === "BoolLit" && stmt.cond.value) {
      newBody.push({ kind: "DoBlock", body: stmt.then_ });
      continue;
    }
    newBody.push(stmt);
  }
  return { kind: "Block", body: newBody };
}
function removeUnreachableBranches(node) {
  if (node.kind === "If") {
    const cond = foldConstants(node.cond);
    if (cond.kind === "BoolLit" && cond.value) {
      return { kind: "DoBlock", body: node.then_ };
    }
    if (cond.kind === "BoolLit" && !cond.value) {
      if (node.elseifs.length > 0) {
        const first = node.elseifs[0];
        return {
          kind: "If",
          cond: first.cond,
          then_: first.body,
          elseifs: node.elseifs.slice(1),
          else_: node.else_
        };
      }
      if (node.else_) return { kind: "DoBlock", body: node.else_ };
      return { kind: "DoBlock", body: { kind: "Block", body: [] } };
    }
  }
  return node;
}
function optimizeNode(node) {
  node = foldConstants(node);
  node = removeUnreachableBranches(node);
  const result = mapChildren(node, optimizeNode);
  return result.kind === "Block" ? eliminateDeadCode(result) : foldConstants(result);
}
function optimize(ast) {
  return optimizeNode(ast);
}
export {
  eliminateDeadCode,
  foldConstants,
  optimize,
  removeUnreachableBranches
};
