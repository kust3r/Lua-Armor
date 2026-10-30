import { capturedRegisters } from "./capture-layout";
function elideUncapturedCloses(proto, opcodes) {
  const captured = capturedRegisters(proto);
  const instructions = proto.instructions;
  const kept = instructions.map((instruction, index) => {
    if (instruction[0] !== opcodes.CLOSE) return true;
    if (captured.some((slot) => slot >= instruction[1] && slot <= instruction[2])) return true;
    const previous = instructions[index - 1];
    return previous !== void 0 && (previous[0] === opcodes.TEST || previous[0] === opcodes.TESTSET || previous[0] === opcodes.TFORLOOP || previous[0] === opcodes.LOADBOOL && previous[3] !== 0);
  });
  const positions = /* @__PURE__ */ new Map();
  let next = 1;
  for (let index = 0; index < instructions.length; index++) {
    positions.set(index + 1, next);
    if (kept[index]) next++;
  }
  positions.set(instructions.length + 1, next);
  const target = (old) => {
    const mapped = positions.get(old);
    if (mapped === void 0) throw new Error("Invalid jump target during CLOSE elision");
    return mapped;
  };
  const compacted = instructions.flatMap((instruction, index) => {
    if (!kept[index]) return [];
    const copy = [...instruction];
    if (copy[0] === opcodes.JMP) copy[1] = target(copy[1]);
    if ([opcodes.JMPIF, opcodes.FORPREP, opcodes.FORLOOP].includes(copy[0])) copy[2] = target(copy[2]);
    return [copy];
  });
  return { ...proto, instructions: compacted };
}
export {
  elideUncapturedCloses
};
