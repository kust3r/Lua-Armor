import { resolveBindings } from "./bindings";
import { mapChildren } from "./ast-walk";
import { astToLua } from "./unparser";
import { LuaDiagnostic } from "./diagnostics";
const name = (n) => ({ kind: "NameExpr", name: n });
const num = (v) => ({ kind: "NumberLit", value: v });
const idx = (obj, key) => ({ kind: "IndexAccess", obj, index: key });
const block = (body) => ({ kind: "Block", body });
const decl = (names, exprs) => ({ kind: "LocalDecl", names, exprs });
const assign = (target, expr) => ({ kind: "Assign", targets: [target], exprs: [expr] });
const table = (values) => ({ kind: "TableCtor", fields: values.map((value) => ({ style: "sequence", value })) });
function buildNativePrototype(original, parent, target, compileVirtual, compileNative) {
  const root = block([{ kind: "Return", exprs: [original] }]);
  const analysis = resolveBindings(root);
  const usedNames = /* @__PURE__ */ new Set();
  const nativeOwners = /* @__PURE__ */ new Set();
  const regions = /* @__PURE__ */ new Map();
  const useRegions = /* @__PURE__ */ new Map();
  let regionSerial = 0;
  function classify(n, region, isNative) {
    if (n.kind === "FuncExpr" || n.kind === "LocalFunc") {
      const nextNative = n === original || n.kind === "FuncExpr" && n.virtualization === "native";
      if (!nextNative || !isNative) region = ++regionSerial;
      isNative = nextNative;
      regions.set(n, region);
      if (isNative) nativeOwners.add(n);
    }
    if (n.kind === "NameExpr") useRegions.set(n, region);
    mapChildren(n, (child) => {
      classify(child, region, isNative);
      return child;
    });
  }
  classify(original, 0, true);
  const shared = /* @__PURE__ */ new Set();
  function findShared(n) {
    const binding = analysis.uses.get(n);
    if (binding && nativeOwners.has(binding.owner) && regions.get(binding.owner) !== useRegions.get(n)) shared.add(binding);
    mapChildren(n, (child) => {
      findShared(child);
      return child;
    });
  }
  findShared(original);
  const collect = (n) => {
    if (n.kind === "NameExpr") usedNames.add(n.name);
    for (const b of analysis.declarations.get(n) ?? []) usedNames.add(b.name);
    mapChildren(n, (c) => {
      collect(c);
      return c;
    });
  };
  collect(root);
  let serial = 0;
  const fresh = () => {
    let n = "";
    do
      n = "_lpyCell" + serial++;
    while (usedNames.has(n));
    usedNames.add(n);
    return n;
  };
  const uvName = fresh(), envName = fresh(), makeName = fresh();
  const cells = /* @__PURE__ */ new Map();
  const cellName = (b) => {
    let n = cells.get(b);
    if (!n) {
      n = fresh();
      cells.set(b, n);
    }
    return n;
  };
  const upvalues = [], upMap = /* @__PURE__ */ new Map(), protos = [];
  const external = (n) => {
    const source2 = parent.resolveForChild(n);
    if (!source2) throw new LuaDiagnostic("NATIVE_BINDING", "virtualize", n, target);
    let k = upMap.get(n);
    if (k === void 0) {
      k = upvalues.length;
      upMap.set(n, k);
      upvalues.push({ name: n, ...source2 });
    }
    return idx(name(uvName), num(k));
  };
  function ref(n) {
    if (n.kind !== "NameExpr") return n;
    const b = analysis.uses.get(n);
    if (b) return shared.has(b) ? idx(name(cellName(b)), num(1)) : n;
    const p = parent.resolveForChild(n.name);
    if (p) return idx(external(n.name), num(1));
    if (["getfenv", "setfenv", "debug"].includes(n.name)) throw new LuaDiagnostic("UNSUPPORTED_NATIVE_INTROSPECTION", "virtualize", n.name, target, n.span);
    return idx(name(envName), { kind: "StringLit", value: n.name });
  }
  const bindingDecls = (n) => analysis.declarations.get(n) ?? [];
  function lowerBlock(n) {
    return { ...n, comments: void 0, body: n.body.flatMap(lowerStmt) };
  }
  function nativeFunction(n) {
    const prologue = bindingDecls(n).filter((b) => shared.has(b)).map((b) => decl([cellName(b)], [table([name(b.name)])]));
    return { ...n, virtualization: void 0, body: block([...prologue, ...lowerBlock(n.body).body]) };
  }
  function childFactory(n) {
    const free = [];
    const freeMap = /* @__PURE__ */ new Map();
    const context = { locals: /* @__PURE__ */ new Map(), resolveForChild(identifier) {
      const binding = analysis.boundaries.get(n)?.get(identifier);
      if (binding && !shared.has(binding)) throw new LuaDiagnostic("NATIVE_UNSHARED_CAPTURE", "virtualize", identifier, target);
      const cell = binding ? name(cellName(binding)) : parent.resolveForChild(identifier) ? external(identifier) : void 0;
      if (!cell) return null;
      let k = freeMap.get(identifier);
      if (k === void 0) {
        k = free.length;
        freeMap.set(identifier, k);
        free.push({ name: identifier, cell });
      }
      return { source: 1, index: k };
    } };
    const child = n.virtualization === "native" ? compileNative(n, context) : compileVirtual(n.body, n.params, n.hasVararg, context);
    const childIndex = protos.length;
    protos.push(child);
    const vector = { kind: "TableCtor", fields: free.map((f, i) => ({ style: "computed", key: num(i), value: f.cell })) };
    return { kind: "Call", func: name(makeName), args: [num(childIndex), vector] };
  }
  function lowerExpr(n) {
    if (n.kind === "NameExpr") return ref(n);
    if (n.kind === "FuncExpr") return n.virtualization === "native" ? nativeFunction(n) : childFactory(n);
    if (n.kind === "DotAccess") return idx(lowerExpr(n.obj), { kind: "StringLit", value: n.field });
    if (n.kind === "StringLit") {
      const bytes = n.bytes ?? Array.from(new TextEncoder().encode(n.value));
      return { ...n, bytes };
    }
    return mapChildren(n, lowerExpr);
  }
  function lowerStmt(n) {
    if (n.kind === "LocalDecl") {
      const bs = bindingDecls(n);
      if (!bs.some((b) => shared.has(b))) return [{ ...n, exprs: n.exprs.map(lowerExpr) }];
      const temps = n.names.map(fresh);
      return [decl(temps, n.exprs.map(lowerExpr)), decl(bs.map((b) => shared.has(b) ? cellName(b) : b.name), bs.map((b, i) => shared.has(b) ? table([name(temps[i])]) : name(temps[i])))];
    }
    if (n.kind === "LocalFunc") {
      const b = bindingDecls(n)[0];
      if (!b) throw new LuaDiagnostic("NATIVE_BINDING", "virtualize", n.name);
      const fn = { kind: "FuncExpr", params: n.params, hasVararg: n.hasVararg, body: n.body };
      const boundary = analysis.boundaries.get(n);
      if (boundary) analysis.boundaries.set(fn, boundary);
      if (shared.has(b)) return [decl([cellName(b)], [table([])]), assign(idx(name(cellName(b)), num(1)), childFactory(fn))];
      return [decl([b.name], [childFactory(fn)])];
    }
    if (n.kind === "Block") return [lowerBlock(n)];
    if (n.kind === "If") return [{ ...n, cond: lowerExpr(n.cond), then_: lowerBlock(n.then_), elseifs: n.elseifs.map((b) => ({ cond: lowerExpr(b.cond), body: lowerBlock(b.body) })), else_: n.else_ && lowerBlock(n.else_) }];
    if (n.kind === "While" || n.kind === "Repeat") return [{ ...n, cond: lowerExpr(n.cond), body: lowerBlock(n.body) }];
    if (n.kind === "DoBlock") return [{ ...n, body: lowerBlock(n.body) }];
    if (n.kind === "NumericFor" || n.kind === "GenericFor") {
      const bs = bindingDecls(n), names = bs.map((b) => shared.has(b) ? fresh() : b.name);
      const prologue = bs.flatMap((b, i) => shared.has(b) ? [decl([cellName(b)], [table([name(names[i])])])] : []);
      const body = block([...prologue, ...lowerBlock(n.body).body]);
      if (n.kind === "NumericFor") return [{ ...n, var_: names[0], start: lowerExpr(n.start), stop: lowerExpr(n.stop), step: n.step && lowerExpr(n.step), body }];
      return [{ ...n, names, iters: n.iters.map(lowerExpr), body }];
    }
    return [mapChildren(n, lowerExpr)];
  }
  const native = nativeFunction(original);
  const factory = { kind: "FuncExpr", params: [uvName, envName, makeName], hasVararg: false, body: block([{ kind: "Return", exprs: [native] }]) };
  const source = astToLua(block([{ kind: "Return", exprs: [factory] }]), { target, mode: "compact", escapeAllBytes: true }).code.replace(/^return\s*/, "").replace(/;$/, "");
  return { instructions: [], constants: [], numParams: original.params.length, hasVararg: original.hasVararg, maxReg: 0, protos, upvalues, nativeSource: source };
}
export {
  buildNativePrototype
};
