import { bytesToBinary, utf8Bytes } from "../literal-values";
function compileNumberExpression(c, node, destReg) {
  c.emit(c.opcodes.LOADK, destReg, c.constIdx(node.value));
}
function compileStringExpression(c, node, destReg) {
  const str = bytesToBinary(node.bytes && (node.valueAtParse === void 0 || node.valueAtParse === node.value) ? node.bytes : utf8Bytes(node.value));
  if (c.wholeStringLiterals || str.length <= 3) {
    c.emit(c.opcodes.LOADK, destReg, c.constIdx(str));
    return;
  }
  const numParts = Math.min(2 + Math.floor(Math.random() * 2), Math.max(2, Math.ceil(str.length / 3)));
  const partSize = Math.ceil(str.length / numParts);
  const parts = [];
  for (let i = 0; i < str.length; i += partSize) {
    parts.push(str.slice(i, i + partSize));
  }
  if (parts.length <= 1) {
    c.emit(c.opcodes.LOADK, destReg, c.constIdx(str));
    return;
  }
  const baseReg = Math.max(c.nextReg, destReg + 1);
  c.markReg(baseReg + parts.length - 1);
  c.withProtectedRegs(baseReg + parts.length - 1, () => {
    for (let i = 0; i < parts.length; i++) {
      c.emit(c.opcodes.LOADK, baseReg + i, c.constIdx(parts[i]));
    }
  });
  c.emit(c.opcodes.CONCAT, destReg, baseReg, baseReg + parts.length - 1);
}
function compileBoolExpression(c, _node, destReg) {
  c.emit(c.opcodes.LOADBOOL, destReg, _node.value ? 1 : 0, 0);
}
function compileNilExpression(c, _node, destReg) {
  c.emit(c.opcodes.LOADNIL, destReg, destReg);
}
function compileVarargExpression(c, _node, destReg) {
  c.emit(c.opcodes.VARARG, destReg, 2);
}
function compileVariableExpression(c, node, destReg) {
  const resolution = c.resolveName(node.name);
  if (resolution.kind === "local") {
    if (resolution.index !== destReg) c.emit(c.opcodes.MOVE, destReg, resolution.index);
  } else if (resolution.kind === "upvalue") {
    c.emit(c.opcodes.GETUPVAL, destReg, resolution.index);
  } else {
    c.emit(c.opcodes.GETGLOBAL, destReg, c.constIdx(node.name));
  }
}
function compileBinOp(c, node, destReg) {
  if (node.op === "and") {
    c.compileExprInto(node.left, destReg);
    const jump = c.emit(c.opcodes.JMPIF, destReg, 0);
    c.compileExprInto(node.right, destReg);
    c.instructions[jump][2] = c.instructions.length + 1;
    return;
  }
  if (node.op === "or") {
    c.compileExprInto(node.left, destReg);
    const jump = c.emit(c.opcodes.JMPIF, destReg, 0, 3);
    c.compileExprInto(node.right, destReg);
    c.instructions[jump][2] = c.instructions.length + 1;
    return;
  }
  const leftReg = Math.max(c.nextReg, destReg + 1);
  const rightReg = leftReg + 1;
  c.markReg(rightReg);
  c.withProtectedRegs(rightReg, () => {
    c.compileExprInto(node.left, leftReg);
    c.compileExprInto(node.right, rightReg);
  });
  const opMap = {
    "+": c.opcodes.ADD,
    "-": c.opcodes.SUB,
    "*": c.opcodes.MUL,
    "/": c.opcodes.DIV,
    "%": c.opcodes.MOD,
    "^": c.opcodes.POW,
    "//": c.opcodes.FLOORDIV,
    "..": c.opcodes.CONCAT,
    "==": c.opcodes.EQ,
    "<": c.opcodes.LT,
    "<=": c.opcodes.LE,
    "~=": c.opcodes.EQ,
    ">": c.opcodes.LT,
    ">=": c.opcodes.LE
  };
  const op = opMap[node.op];
  if (node.op === ">" || node.op === ">=") {
    c.emit(op, destReg, rightReg, leftReg);
  } else if (node.op === "~=") {
    c.emit(op, destReg, leftReg, rightReg);
    c.emit(c.opcodes.NOT, destReg, destReg);
  } else {
    c.emit(op, destReg, leftReg, rightReg);
  }
}
function compileUnOp(c, node, destReg) {
  c.compileExprInto(node.expr, destReg);
  if (node.op === "-") c.emit(c.opcodes.UNM, destReg, destReg);
  else if (node.op === "not") c.emit(c.opcodes.NOT, destReg, destReg);
  else if (node.op === "#") c.emit(c.opcodes.LEN, destReg, destReg);
}
function compileCallExpression(c, node, destReg) {
  const base = Math.max(c.nextReg, destReg + 1);
  const lastArg = node.args.length > 0 ? node.args[node.args.length - 1] : null;
  const lastIsMulti = lastArg && c.isMultiRetNode(lastArg);
  if (lastIsMulti) {
    const topReg = base + node.args.length;
    c.markReg(topReg);
    c.withProtectedRegs(topReg, () => {
      c.compileExprInto(node.func, base);
      for (let i = 0; i < node.args.length - 1; i++) {
        c.compileExprInto(node.args[i], base + 1 + i);
      }
    });
    c.emitLastMultiRet(lastArg, base + node.args.length);
    c.emit(c.opcodes.CALL, base, 0, 2);
  } else {
    const topReg = base + node.args.length;
    c.markReg(topReg);
    c.withProtectedRegs(topReg, () => {
      c.compileExprInto(node.func, base);
      for (let i = 0; i < node.args.length; i++) {
        c.compileExprInto(node.args[i], base + 1 + i);
      }
    });
    c.emit(c.opcodes.CALL, base, node.args.length + 1, 2);
  }
  if (destReg !== base) c.emit(c.opcodes.MOVE, destReg, base);
}
function compileMethodCallExpression(c, node, destReg) {
  const base = Math.max(c.nextReg, destReg + 1);
  const lastArg = node.args.length > 0 ? node.args[node.args.length - 1] : null;
  const lastIsMulti = lastArg && c.isMultiRetNode(lastArg);
  if (lastIsMulti) {
    const keyReg = base + 2 + node.args.length;
    c.markReg(keyReg);
    c.withProtectedRegs(keyReg, () => {
      c.compileExprInto(node.obj, base + 1);
      c.emit(c.opcodes.LOADK, keyReg, c.constIdx(node.method));
      c.emit(c.opcodes.GETTABLE, base, base + 1, keyReg);
      for (let i = 0; i < node.args.length - 1; i++) {
        c.compileExprInto(node.args[i], base + 2 + i);
      }
    });
    c.emitLastMultiRet(lastArg, base + 1 + node.args.length);
    c.emit(c.opcodes.CALL, base, 0, 2);
  } else {
    const keyReg = base + 2 + node.args.length;
    c.markReg(keyReg);
    c.withProtectedRegs(keyReg, () => {
      c.compileExprInto(node.obj, base + 1);
      c.emit(c.opcodes.LOADK, keyReg, c.constIdx(node.method));
      c.emit(c.opcodes.GETTABLE, base, base + 1, keyReg);
      for (let i = 0; i < node.args.length; i++) {
        c.compileExprInto(node.args[i], base + 2 + i);
      }
    });
    c.emit(c.opcodes.CALL, base, node.args.length + 2, 2);
  }
  if (destReg !== base) c.emit(c.opcodes.MOVE, destReg, base);
}
function compileDotAccess(c, node, destReg) {
  const objReg = destReg;
  const keyReg = Math.max(c.nextReg, destReg + 1);
  c.markReg(keyReg);
  c.withProtectedRegs(keyReg, () => {
    c.compileExprInto(node.obj, objReg);
  });
  c.emit(c.opcodes.LOADK, keyReg, c.constIdx(node.field));
  c.emit(c.opcodes.GETTABLE, destReg, objReg, keyReg);
}
function compileIndexAccess(c, node, destReg) {
  const objReg = destReg;
  const keyReg = Math.max(c.nextReg, destReg + 1);
  c.markReg(keyReg);
  c.withProtectedRegs(keyReg, () => {
    c.compileExprInto(node.obj, objReg);
    c.compileExprInto(node.index, keyReg);
  });
  c.emit(c.opcodes.GETTABLE, destReg, objReg, keyReg);
}
function compileTableConstructor(c, node, destReg) {
  c.emit(c.opcodes.NEWTABLE, destReg);
  let arrayIndex = 1;
  const lastFieldIdx = node.fields.length - 1;
  for (let fi = 0; fi < node.fields.length; fi++) {
    const field = node.fields[fi];
    const isLast = fi === lastFieldIdx;
    const isArrayField = !field.key;
    if (isLast && isArrayField && c.isMultiRetNode(field.value)) {
      const baseReg = destReg + 1;
      c.markReg(baseReg);
      c.emitLastMultiRet(field.value, baseReg);
      c.emit(c.opcodes.SETLIST, destReg, 0, arrayIndex - 1);
    } else {
      const keyReg = Math.max(c.nextReg, destReg + 1);
      const valueReg = keyReg + 1;
      c.markReg(valueReg);
      c.withProtectedRegs(valueReg, () => {
        if (field.key) c.compileExprInto(field.key, keyReg);
        else c.emit(c.opcodes.LOADK, keyReg, c.constIdx(arrayIndex++));
        c.compileExprInto(field.value, valueReg);
      });
      c.emit(c.opcodes.SETTABLE, destReg, keyReg, valueReg);
    }
  }
}
function compileFuncExpression(c, node, destReg) {
  const child = c.compileProto(node.body, node.params, node.hasVararg, c.ctx);
  const protoIndex = c.protos.length;
  c.protos.push(child);
  c.emit(c.opcodes.CLOSURE, destReg, protoIndex);
}
export {
  compileBinOp,
  compileBoolExpression,
  compileCallExpression,
  compileDotAccess,
  compileFuncExpression,
  compileIndexAccess,
  compileMethodCallExpression,
  compileNilExpression,
  compileNumberExpression,
  compileStringExpression,
  compileTableConstructor,
  compileUnOp,
  compileVarargExpression,
  compileVariableExpression
};
