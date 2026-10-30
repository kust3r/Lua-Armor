const arithmetic = /* @__PURE__ */ new Set(["ADD", "SUB", "MUL", "DIV", "MOD", "POW", "FLOORDIV"]);
function selectHardenedFusions(ir, proto) {
  const result = [];
  const captured = new Set(ir.captured);
  for (const block of ir.blocks) {
    const after = /* @__PURE__ */ new Map();
    const live = new Set(block.liveOut);
    for (const op of [...block.operations].reverse()) {
      after.set(op.pc, new Set(live));
      for (const w of op.writes) if (typeof w !== "number" || !captured.has(w)) live.delete(w);
      for (const r of op.reads) live.add(r);
    }
    const numeric = /* @__PURE__ */ new Set();
    for (let i = 0; i < block.operations.length; i++) {
      const x = block.operations[i], y = block.operations[i + 1], z = block.operations[i + 2];
      const dead = (slot, end) => !captured.has(slot) && !after.get(end.pc)?.has(slot);
      if (x.name === "GETTABLE" && y?.name === "CALL" && y.a === x.a && y.b > 0 && y.c > 1 && !captured.has(x.a)) result.push({ pattern: "TABLE_CALL", pcs: [x.pc, y.pc] });
      if (x.name === "GETGLOBAL" && y?.name === "LOADK" && z?.name === "GETTABLE" && z.b === x.a && z.c === y.a && y.a !== x.a && !captured.has(x.a) && !captured.has(y.a) && (z.a === x.a || dead(x.a, z)) && (z.a === y.a || dead(y.a, z))) result.push({ pattern: "GLOBAL_KEY_TABLE", pcs: [x.pc, y.pc, z.pc] });
      if (x.name === "CALL" && y?.name === "JMPIF" && x.a === y.a && x.c === 2 && x.b > 0 && dead(x.a, y)) result.push({ pattern: "CALL_BRANCH", pcs: [x.pc, y.pc] });
      if (arithmetic.has(x.name) && y?.name === "RETURN" && y.a === x.a && y.b === 2 && numeric.has(x.b) && numeric.has(x.c) && !captured.has(x.a)) result.push({ pattern: "ARITHMETIC_RETURN", pcs: [x.pc, y.pc] });
      const wasNumeric = x.name === "MOVE" && numeric.has(x.b) || arithmetic.has(x.name) && numeric.has(x.b) && numeric.has(x.c);
      for (const w of [...x.writes, ...x.mayWrites]) if (typeof w === "number") numeric.delete(w);
      if (wasNumeric || x.name === "LOADK" && typeof proto?.constants[x.b] === "number") numeric.add(x.a);
    }
  }
  return result;
}
export {
  selectHardenedFusions
};
