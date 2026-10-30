import { CAPABILITIES, dialectOf } from "../capabilities";
import { LuaDiagnostic } from "../diagnostics";
const OP_MAP = {
  "or": { prec: 1, assoc: "left" },
  "and": { prec: 2, assoc: "left" },
  "<": { prec: 3, assoc: "none" },
  ">": { prec: 3, assoc: "none" },
  "<=": { prec: 3, assoc: "none" },
  ">=": { prec: 3, assoc: "none" },
  "~=": { prec: 3, assoc: "none" },
  "==": { prec: 3, assoc: "none" },
  "|": { prec: 4, assoc: "left" },
  "~": { prec: 5, assoc: "left" },
  "&": { prec: 6, assoc: "left" },
  "<<": { prec: 7, assoc: "left" },
  ">>": { prec: 7, assoc: "left" },
  "..": { prec: 8, assoc: "right" },
  "+": { prec: 9, assoc: "left" },
  "-": { prec: 9, assoc: "left" },
  "*": { prec: 10, assoc: "left" },
  "/": { prec: 10, assoc: "left" },
  "//": { prec: 10, assoc: "left" },
  "%": { prec: 10, assoc: "left" },
  "^": { prec: 12, assoc: "right" }
};
const UNARY_PREC = 11;
function getOp(op, target = "luau") {
  const value = OP_MAP[op];
  const c = CAPABILITIES[dialectOf(target)];
  if (!value || ["|", "~", "&", "<<", ">>"].includes(op) && !c.bitwise || op === "//" && !c.integerDivision) throw new LuaDiagnostic("UNSUPPORTED_OPERATOR", "emit", op, target);
  return value;
}
function needsParens(parentOp, childOp, side, target = "luau") {
  const p = getOp(parentOp, target), c = getOp(childOp, target);
  if (c.prec < p.prec) return true;
  if (c.prec === p.prec) {
    if (p.assoc === "none") return true;
    if (p.assoc === "left" && side === "right") return true;
    if (p.assoc === "right" && side === "left") return true;
  }
  return false;
}
export {
  UNARY_PREC,
  getOp,
  needsParens
};
