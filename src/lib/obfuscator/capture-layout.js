function capturedRegisters(proto) {
  const slots = [...new Set(proto.protos.flatMap((child) => child.upvalues.filter((u) => u.source === 0).map((u) => u.index)))];
  for (const slot of slots) {
    if (!Number.isInteger(slot) || slot < 0 || slot > proto.maxReg) throw new Error("Capture register outside prototype layout");
  }
  return slots;
}
export {
  capturedRegisters
};
