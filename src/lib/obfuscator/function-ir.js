const binary = /* @__PURE__ */ new Set(["ADD", "SUB", "MUL", "DIV", "MOD", "POW", "FLOORDIV", "EQ", "LT", "LE"]);
const arithmetic = /* @__PURE__ */ new Set(["ADD", "SUB", "MUL", "DIV", "MOD", "POW", "FLOORDIV"]);
const range = (lo, hi) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);
const unique = (xs) => [...new Set(xs)];
const ordered = (xs) => [...xs].sort((a, b) => typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b)));
const emptyEffects = () => ({ mayThrow: false, mayInvokeMetamethod: false, mayYield: false, readsEnvironment: false, writesEnvironment: false, readsHeap: false, writesHeap: false, readsUpvalue: false, writesUpvalue: false, allocates: false, captures: false, closes: false });
function successors(name, pc, a, b, c) {
  switch (name) {
    case "RETURN":
    case "TAILCALL":
      return [];
    case "JMP":
      return [a];
    case "JMPIF":
      return c >= 0 && c <= 3 ? unique([pc + 1, b]) : [pc + 1];
    case "FORPREP":
      return unique([pc + 1, b + 1]);
    case "FORLOOP":
      return unique([pc + 1, b]);
    case "TEST":
    case "TESTSET":
    case "TFORLOOP":
      return [pc + 1, pc + 2];
    case "LOADBOOL":
      return [pc + 1 + (c !== 0 ? 1 : 0)];
    default:
      return [pc + 1];
  }
}
function analyzePrototype(proto, opcodes, path = "root") {
  if (proto.nativeSource !== void 0) throw new Error("IR_NATIVE_UNSUPPORTED");
  if (!Number.isInteger(proto.maxReg) || proto.maxReg < 0 || proto.maxReg > 1e5) throw new Error("IR_REGISTER_BOUND");
  const names = /* @__PURE__ */ new Map();
  for (const [key, value] of Object.entries(opcodes)) {
    if (names.has(value)) throw new Error("IR_DUPLICATE_OPCODE");
    names.set(value, key);
  }
  const captured = unique(proto.protos.flatMap((child) => child.upvalues.filter((u) => u.source === 0).map((u) => u.index)));
  for (const slot of captured) if (!Number.isInteger(slot) || slot < 0 || slot > proto.maxReg) throw new Error("IR_CAPTURE_BOUNDS");
  const constants = [];
  const open = (start) => [...range(start, proto.maxReg), "TOP", "TAIL"];
  const operations = proto.instructions.map(([code, a, b, c], i) => {
    const name = names.get(code);
    if (!name) throw new Error("IR_UNKNOWN_OPCODE");
    if (![a, b, c].every((v) => Number.isInteger(v) && v >= 0 && v <= 1e6)) throw new Error("IR_OPERAND_BOUNDS");
    let reads = [], writes = [], mayWrites = [];
    const e = emptyEffects();
    const meta = () => {
      e.mayThrow = true;
      e.mayInvokeMetamethod = true;
      e.mayYield = true;
      e.readsHeap = true;
      e.writesHeap = true;
      e.readsEnvironment = true;
      e.writesEnvironment = true;
      e.readsUpvalue = true;
      e.writesUpvalue = true;
    };
    const call = () => {
      meta();
    };
    if (binary.has(name)) {
      reads = [b, c];
      writes = [a];
      meta();
    } else switch (name) {
      case "LOADK":
      case "LOADBOOL":
        writes = [a];
        break;
      case "LOADNIL":
        writes = range(a, b);
        break;
      case "MOVE":
      case "NOT":
        reads = [b];
        writes = [a];
        break;
      case "GETGLOBAL":
        writes = [a];
        meta();
        e.readsEnvironment = true;
        break;
      case "SETGLOBAL":
        reads = [a];
        meta();
        e.writesEnvironment = true;
        break;
      case "GETUPVAL":
        writes = [a];
        e.readsUpvalue = true;
        break;
      case "SETUPVAL":
        reads = [a];
        e.writesUpvalue = true;
        break;
      case "GETTABLE":
        reads = [b, c];
        writes = [a];
        meta();
        break;
      case "SETTABLE":
        reads = [a, b, c];
        meta();
        break;
      case "NEWTABLE":
        writes = [a];
        e.allocates = true;
        e.mayThrow = true;
        break;
      case "SELF":
        reads = [b, c];
        writes = [a, a + 1];
        meta();
        break;
      case "UNM":
      case "LEN":
        reads = [b];
        writes = [a];
        meta();
        break;
      case "CONCAT":
        reads = range(b, c);
        writes = [a];
        meta();
        break;
      case "TEST":
      case "JMPIF":
        reads = [a];
        break;
      case "TESTSET":
        reads = [b];
        mayWrites = [a];
        break;
      case "JMP":
        break;
      case "CALL":
      case "TAILCALL":
        reads = b === 0 ? unique([a, ...open(a + 1)]) : range(a, a + b - 1);
        call();
        if (name === "CALL") {
          if (c === 0) {
            writes = ["TOP"];
            mayWrites = [...range(a, proto.maxReg), "TAIL"];
          } else writes = range(a, a + c - 2);
        }
        break;
      case "RETURN":
        reads = b === 0 ? open(a) : range(a, a + b - 2);
        break;
      case "VARARG":
        if (b === 0) {
          writes = ["TOP"];
          mayWrites = [...range(a, proto.maxReg), "TAIL"];
        } else writes = range(a, a + b - 2);
        break;
      case "FORPREP":
        reads = range(a, a + 2);
        writes = range(a, a + 2);
        mayWrites = [a + 3];
        meta();
        break;
      case "FORLOOP":
        reads = range(a, a + 2);
        writes = [a];
        mayWrites = [a + 3];
        meta();
        break;
      case "TFORLOOP":
        reads = range(a, a + 2);
        writes = range(a + 3, a + 2 + c);
        mayWrites = [a + 2];
        call();
        break;
      case "SETLIST":
        reads = b === 0 ? unique([a, ...open(a + 1)]) : range(a, a + b);
        meta();
        break;
      case "CLOSE":
        reads = range(a, b);
        e.closes = true;
        e.allocates = true;
        e.mayThrow = true;
        break;
      case "CLOSURE": {
        const child = proto.protos[b];
        if (!child) throw new Error("IR_CHILD_BOUNDS");
        reads = child.upvalues.filter((u) => u.source === 0).map((u) => u.index);
        writes = [a];
        e.captures = true;
        e.allocates = true;
        e.mayThrow = true;
        e.readsUpvalue = child.upvalues.some((u) => u.source === 1);
        break;
      }
      default:
        throw new Error("IR_UNMODELED_OPCODE");
    }
    if (e.mayInvokeMetamethod || e.writesUpvalue) {
      reads.push(...captured);
      mayWrites.push(...captured);
    }
    const numeric = [...reads, ...writes, ...mayWrites].filter((x) => typeof x === "number");
    if (numeric.some((r) => r > proto.maxReg)) throw new Error("IR_REGISTER_BOUNDS");
    if (name === "LOADK" || name === "GETGLOBAL" || name === "SETGLOBAL") {
      if (b >= proto.constants.length) throw new Error("IR_CONSTANT_BOUNDS");
      constants.push({ id: `${path}:${i + 1}:B`, pc: i + 1, operand: "B", poolIndex: b });
    }
    const edges = successors(name, i + 1, a, b, c);
    if (edges.some((p) => p < 1 || p > proto.instructions.length + 1)) throw new Error("IR_EDGE_BOUNDS");
    return { pc: i + 1, name, a, b, c, reads: unique(reads), writes: unique(writes), mayWrites: unique(mayWrites), effects: e, successors: edges };
  });
  const leaders = new Set(operations.length ? [1] : []);
  for (const op of operations) {
    if (op.successors.length !== 1 || op.successors[0] !== op.pc + 1) {
      for (const target of op.successors) if (target <= operations.length) leaders.add(target);
      if (op.pc < operations.length) leaders.add(op.pc + 1);
    }
  }
  const starts = [...leaders].sort((a, b) => a - b);
  const blocks = starts.map((start, i) => {
    const part = operations.slice(start - 1, (starts[i + 1] ?? operations.length + 1) - 1);
    const last = part[part.length - 1];
    if (!last) throw new Error("IR_EMPTY_BLOCK");
    return {
      id: start,
      operations: part,
      successors: last.successors,
      predecessors: [],
      terminator: last.name === "RETURN" || last.name === "TAILCALL" ? "return" : last.successors.length > 1 ? "conditional" : last.successors[0] !== last.pc + 1 ? "branch" : "fallthrough",
      exceptionalExit: part.some((op) => op.effects.mayThrow),
      liveIn: [],
      liveOut: []
    };
  });
  const byId = new Map(blocks.map((b) => [b.id, b]));
  for (const block of blocks) for (const target of block.successors) {
    const dest = byId.get(target);
    if (dest) dest.predecessors.push(block.id);
    else if (target !== operations.length + 1) throw new Error("IR_NOT_BLOCK_ENTRY");
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of [...blocks].reverse()) {
      const out = new Set(captured);
      for (const target of block.successors) for (const slot of byId.get(target)?.liveIn ?? []) out.add(slot);
      const live = new Set(out);
      for (const op of [...block.operations].reverse()) {
        for (const slot of op.writes) if (typeof slot !== "number" || !captured.includes(slot)) live.delete(slot);
        for (const slot of op.reads) live.add(slot);
      }
      const nextIn = ordered(live), nextOut = ordered(out);
      if (JSON.stringify(nextIn) !== JSON.stringify(block.liveIn) || JSON.stringify(nextOut) !== JSON.stringify(block.liveOut)) changed = true;
      block.liveIn = nextIn;
      block.liveOut = nextOut;
    }
  }
  return { path, entry: 1, exit: operations.length + 1, blocks, constants, captured, children: proto.protos.map((child, i) => analyzePrototype(child, opcodes, `${path}.${i}`)) };
}
function macroEligibility(ir) {
  const result = [];
  for (const block of ir.blocks) {
    const after = /* @__PURE__ */ new Map();
    const live = new Set(block.liveOut);
    for (const op of [...block.operations].reverse()) {
      after.set(op.pc, new Set(live));
      for (const r of op.writes) if (typeof r !== "number" || !ir.captured.includes(r)) live.delete(r);
      for (const r of op.reads) live.add(r);
    }
    const add = (pattern, ops, temps, valid, extra = []) => {
      const end = ops[ops.length - 1];
      if (!end) return;
      const reasons = [...extra];
      if (!valid) reasons.push("operand-or-alias-mismatch");
      if (temps.some((t) => ir.captured.includes(t))) reasons.push("captured-intermediate");
      if (temps.some((t) => after.get(end.pc)?.has(t))) reasons.push("intermediate-live-after-region");
      if (temps.some((t) => ops.slice(1).filter((op) => op.reads.includes(t)).length !== 1)) reasons.push("intermediate-not-single-consumer");
      const requiresEffectContract = ops.some((op) => op.effects.mayThrow || op.effects.mayInvokeMetamethod || op.effects.mayYield);
      result.push({ pattern, pcs: ops.map((op) => op.pc), eligible: reasons.length === 0, reasons: unique(reasons), requiresEffectContract });
    };
    for (let i = 0; i < block.operations.length; i++) {
      const x = block.operations[i], y = block.operations[i + 1], z = block.operations[i + 2];
      if (!y) continue;
      if (x.name === "LOADK" && z && ["EQ", "LT", "LE"].includes(y.name) && z.name === "JMPIF")
        add("LOADK_COMPARE_BRANCH", [x, y, z], [x.a, y.a], (y.b === x.a || y.c === x.a) && y.a !== x.a && z.a === y.a && !(y.b === x.a && y.c === x.a));
      if (x.name === "GETGLOBAL" && y.name === "GETTABLE")
        add("GLOBAL_TABLE", [x, y], [x.a], y.b === x.a && y.c !== x.a && y.a !== x.a);
      if (x.name === "GETTABLE" && y.name === "CALL")
        add(
          "TABLE_CALL",
          [x, y],
          [x.a],
          y.a === x.a && y.b > 0 && y.c === 1 && x.b !== x.a && x.c !== x.a,
          y.b === 0 || y.c === 0 ? ["open-call-range"] : []
        );
      if (arithmetic.has(x.name) && arithmetic.has(y.name) && z?.name === "RETURN")
        add("ARITHMETIC_RETURN", [x, y, z], [x.a, y.a], (y.b === x.a || y.c === x.a) && y.a !== x.a && z.a === y.a && z.b === 2 && !(y.b === x.a && y.c === x.a));
      if (x.name === "LOADK" && y.name === "SETTABLE")
        add("LOADK_SETTABLE", [x, y], [x.a], y.c === x.a && y.a !== x.a && y.b !== x.a);
    }
  }
  return [...result, ...ir.children.flatMap(macroEligibility)];
}
export {
  analyzePrototype,
  macroEligibility,
  successors
};
