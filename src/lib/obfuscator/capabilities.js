const dialectOf = (target) => target === "roblox" ? "luau" : target;
const CAPABILITIES = {
  luau: { continue: true, compound: true, ifExpression: true, integerDivision: true, bitwise: false, integer64: false, binary: true },
  lua51: { continue: false, compound: false, ifExpression: false, integerDivision: false, bitwise: false, integer64: false, binary: false },
  lua52: { continue: false, compound: false, ifExpression: false, integerDivision: false, bitwise: false, integer64: false, binary: false },
  lua53: { continue: false, compound: false, ifExpression: false, integerDivision: true, bitwise: true, integer64: true, binary: false },
  lua54: { continue: false, compound: false, ifExpression: false, integerDivision: true, bitwise: true, integer64: true, binary: false },
  luajit: { continue: false, compound: false, ifExpression: false, integerDivision: false, bitwise: false, integer64: false, binary: false }
};
export {
  CAPABILITIES,
  dialectOf
};
