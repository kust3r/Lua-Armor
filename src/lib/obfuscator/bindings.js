import { mapChildren } from "./ast-walk";
function resolveBindings(root) {
  const uses = /* @__PURE__ */ new WeakMap(), declarations = /* @__PURE__ */ new WeakMap(), bindings = [];
  const conflicts = /* @__PURE__ */ new Map();
  const boundaries = /* @__PURE__ */ new WeakMap();
  const boundary = (n, s) => {
    const visible = /* @__PURE__ */ new Map();
    for (const scope of s) for (const [key, binding] of scope) visible.set(key, binding);
    boundaries.set(n, visible);
  };
  const add = (n, names, scopes, owner) => {
    const list = names.map((name) => {
      const b = { id: bindings.length, name, owner };
      const adjacent = /* @__PURE__ */ new Set();
      for (const scope of scopes) for (const other of scope.values()) {
        adjacent.add(other.id);
        conflicts.get(other.id)?.add(b.id);
      }
      conflicts.set(b.id, adjacent);
      bindings.push(b);
      scopes[scopes.length - 1].set(name, b);
      return b;
    });
    declarations.set(n, list);
    return list;
  };
  const lookup = (s, name) => {
    for (let i = s.length - 1; i >= 0; i--) {
      const b = s[i].get(name);
      if (b) return b;
    }
  };
  function block(n, scopes, owner, fresh = true) {
    const s = fresh ? [...scopes, /* @__PURE__ */ new Map()] : scopes;
    n.body.forEach((node) => visit(node, s, owner));
  }
  function visit(n, s, owner) {
    if (n.kind === "NameExpr") {
      boundary(n, s);
      const b = lookup(s, n.name);
      if (b) uses.set(n, b);
      return;
    }
    if (n.kind === "LocalDecl") {
      n.exprs.forEach((e) => visit(e, s, owner));
      add(n, n.names, s, owner);
      return;
    }
    if (n.kind === "LocalFunc") {
      add(n, [n.name], s, owner);
      boundary(n, s);
      const fs = [...s, /* @__PURE__ */ new Map()];
      const p = add(n.body, n.params, fs, n);
      declarations.set(n.body, p);
      block(n.body, fs, n, false);
      return;
    }
    if (n.kind === "FuncExpr") {
      boundary(n, s);
      const fs = [...s, /* @__PURE__ */ new Map()];
      add(n, n.params, fs, n);
      block(n.body, fs, n, false);
      return;
    }
    if (n.kind === "Block") {
      block(n, s, owner);
      return;
    }
    if (n.kind === "Repeat") {
      const rs = [...s, /* @__PURE__ */ new Map()];
      block(n.body, rs, owner, false);
      visit(n.cond, rs, owner);
      return;
    }
    if (n.kind === "NumericFor") {
      visit(n.start, s, owner);
      visit(n.stop, s, owner);
      if (n.step) visit(n.step, s, owner);
      const fs = [...s, /* @__PURE__ */ new Map()];
      add(n, [n.var_], fs, owner);
      block(n.body, fs, owner, false);
      return;
    }
    if (n.kind === "GenericFor") {
      n.iters.forEach((e) => visit(e, s, owner));
      const fs = [...s, /* @__PURE__ */ new Map()];
      add(n, n.names, fs, owner);
      block(n.body, fs, owner, false);
      return;
    }
    mapChildren(n, (child) => {
      visit(child, s, owner);
      return child;
    });
  }
  block(root, [/* @__PURE__ */ new Map()], root, false);
  return { uses, declarations, bindings, boundaries, conflicts };
}
export {
  resolveBindings
};
