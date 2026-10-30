import { mapChildren } from "./ast-walk";
const FIRST_CHARS = "_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const REST_CHARS = FIRST_CHARS + "0123456789";
function generateMinName(index) {
  let name = FIRST_CHARS[index % FIRST_CHARS.length];
  index = Math.floor(index / FIRST_CHARS.length);
  while (index > 0) {
    index--;
    name += REST_CHARS[index % REST_CHARS.length];
    index = Math.floor(index / REST_CHARS.length);
  }
  return name;
}
const RESERVED = /* @__PURE__ */ new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "goto",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
  "continue"
]);
function nextSafeName(counter) {
  let name;
  do {
    name = generateMinName(counter.value++);
  } while (RESERVED.has(name));
  return name;
}
function createScope(parent) {
  return { renames: /* @__PURE__ */ new Map(), parent };
}
function lookupName(scope, name) {
  const local = scope.renames.get(name);
  if (local) return local;
  if (scope.parent) return lookupName(scope.parent, name);
  return name;
}
function minifyBlock(block, scope, counter) {
  const newBody = [];
  for (const stmt of block.body) {
    newBody.push(minifyNode(stmt, scope, counter));
  }
  return { kind: "Block", body: newBody };
}
function minifyNode(node, scope, counter) {
  switch (node.kind) {
    case "Block":
      return minifyBlock(node, scope, counter);
    case "LocalDecl": {
      const exprs = node.exprs.map((e) => minifyNode(e, scope, counter));
      const newScope = createScope(scope);
      const newNames = node.names.map((name) => {
        const minName = nextSafeName(counter);
        newScope.renames.set(name, minName);
        return minName;
      });
      for (const [k, v] of newScope.renames) scope.renames.set(k, v);
      return {
        ...node,
        names: newNames,
        exprs
      };
    }
    case "LocalFunc": {
      const minName = nextSafeName(counter);
      scope.renames.set(node.name, minName);
      const bodyScope = createScope(scope);
      const minParams = node.params.map((p) => {
        if (p === "self") return "self";
        const mp = nextSafeName(counter);
        bodyScope.renames.set(p, mp);
        return mp;
      });
      return {
        ...node,
        name: minName,
        params: minParams,
        body: minifyBlock(node.body, bodyScope, counter)
      };
    }
    case "Assign":
      return {
        ...node,
        targets: node.targets.map((t) => minifyNode(t, scope, counter)),
        exprs: node.exprs.map((e) => minifyNode(e, scope, counter))
      };
    case "NameExpr":
      return { ...node, name: lookupName(scope, node.name) };
    case "If":
      return {
        ...node,
        cond: minifyNode(node.cond, scope, counter),
        then_: minifyBlock(node.then_, createScope(scope), counter),
        elseifs: node.elseifs.map((e) => ({
          cond: minifyNode(e.cond, scope, counter),
          body: minifyBlock(e.body, createScope(scope), counter)
        })),
        else_: node.else_ ? minifyBlock(node.else_, createScope(scope), counter) : void 0
      };
    case "While":
      return {
        ...node,
        cond: minifyNode(node.cond, scope, counter),
        body: minifyBlock(node.body, createScope(scope), counter)
      };
    case "Repeat": {
      const repeatScope = createScope(scope);
      const body = minifyBlock(node.body, repeatScope, counter);
      return {
        ...node,
        body,
        cond: minifyNode(node.cond, repeatScope, counter)
      };
    }
    case "NumericFor": {
      const forScope = createScope(scope);
      const minVar = nextSafeName(counter);
      forScope.renames.set(node.var_, minVar);
      return {
        ...node,
        var_: minVar,
        start: minifyNode(node.start, scope, counter),
        stop: minifyNode(node.stop, scope, counter),
        step: node.step ? minifyNode(node.step, scope, counter) : void 0,
        body: minifyBlock(node.body, forScope, counter)
      };
    }
    case "GenericFor": {
      const forScope = createScope(scope);
      const minNames = node.names.map((n) => {
        const mn = nextSafeName(counter);
        forScope.renames.set(n, mn);
        return mn;
      });
      return {
        ...node,
        names: minNames,
        iters: node.iters.map((it) => minifyNode(it, scope, counter)),
        body: minifyBlock(node.body, forScope, counter)
      };
    }
    case "DoBlock":
      return { ...node, body: minifyBlock(node.body, createScope(scope), counter) };
    case "Return":
      return { ...node, exprs: node.exprs.map((e) => minifyNode(e, scope, counter)) };
    case "FuncExpr": {
      const funcScope = createScope(scope);
      const minParams = node.params.map((p) => {
        if (p === "self") return "self";
        const mp = nextSafeName(counter);
        funcScope.renames.set(p, mp);
        return mp;
      });
      return {
        ...node,
        params: minParams,
        body: minifyBlock(node.body, funcScope, counter)
      };
    }
    case "Call":
      return {
        ...node,
        func: minifyNode(node.func, scope, counter),
        args: node.args.map((a) => minifyNode(a, scope, counter))
      };
    case "MethodCall":
      return {
        ...node,
        obj: minifyNode(node.obj, scope, counter),
        args: node.args.map((a) => minifyNode(a, scope, counter))
      };
    case "BinOp":
      return {
        ...node,
        left: minifyNode(node.left, scope, counter),
        right: minifyNode(node.right, scope, counter)
      };
    case "UnOp":
      return { ...node, expr: minifyNode(node.expr, scope, counter) };
    case "DotAccess":
      return { ...node, obj: minifyNode(node.obj, scope, counter) };
    case "IndexAccess":
      return {
        ...node,
        obj: minifyNode(node.obj, scope, counter),
        index: minifyNode(node.index, scope, counter)
      };
    case "TableCtor":
      return {
        ...node,
        fields: node.fields.map((f) => f.style === "sequence" ? { ...f, value: minifyNode(f.value, scope, counter) } : f.style === "named" ? { ...f, value: minifyNode(f.value, scope, counter) } : { ...f, key: minifyNode(f.key, scope, counter), value: minifyNode(f.value, scope, counter) })
      };
    case "ExprStmt":
      return { ...node, expr: minifyNode(node.expr, scope, counter) };
    case "CompoundAssign":
      return {
        ...node,
        target: minifyNode(node.target, scope, counter),
        expr: minifyNode(node.expr, scope, counter)
      };
    default:
      return mapChildren(node, (child) => minifyNode(child, scope, counter));
  }
}
function minify(ast) {
  const rootScope = createScope();
  const counter = { value: 0 };
  return minifyBlock(ast, rootScope, counter);
}
function minifySource(source) {
  let result = "";
  let i = 0;
  let inString = false;
  let stringChar = "";
  while (i < source.length) {
    const ch = source[i];
    if (inString) {
      result += ch;
      if (ch === "\\") {
        i++;
        if (i < source.length) result += source[i];
      } else if (ch === stringChar) inString = false;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      result += ch;
      i++;
      continue;
    }
    if (ch === "-" && source[i + 1] === "-") {
      if (source[i + 2] === "[") {
        let lvl = 0;
        let j = i + 3;
        while (j < source.length && source[j] === "=") {
          lvl++;
          j++;
        }
        if (source[j] === "[") {
          const close = "]" + "=".repeat(lvl) + "]";
          const ci = source.indexOf(close, j + 1);
          if (ci >= 0) {
            i = ci + close.length;
            continue;
          }
        }
      }
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (/\s/.test(ch)) {
      if (result.length > 0 && /[a-zA-Z0-9_]/.test(result[result.length - 1])) {
        let j = i;
        while (j < source.length && /\s/.test(source[j])) j++;
        if (j < source.length && /[a-zA-Z0-9_]/.test(source[j])) {
          result += " ";
        }
      }
      while (i < source.length && /\s/.test(source[i])) i++;
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}
export {
  RESERVED,
  generateMinName,
  minify,
  minifySource
};
