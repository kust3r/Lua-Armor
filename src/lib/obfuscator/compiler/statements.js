function compileValues(c, exprs, count, base) {
  let expanded = false;
  for (let i = 0; i < exprs.length; i++) {
    const expr = exprs[i], remaining = count - i;
    if (i === exprs.length - 1 && remaining > 1 && c.isMultiRetNode(expr)) {
      if (expr.kind === "Vararg") c.emit(c.opcodes.VARARG, base + i, remaining + 1);
      else c.compileMultiRetCallInto(expr, base + i, remaining);
      expanded = true;
    } else c.compileExprInto(expr, base + i);
  }
  if (!expanded) for (let i = exprs.length; i < count; i++) c.emit(c.opcodes.LOADNIL, base + i, base + i);
}
function compileLocalDecl(c, node) {
  const base = c.nextReg, count = node.names.length, protectedEnd = base + count + Math.max(count, node.exprs.length) + 2;
  c.markReg(protectedEnd);
  c.withProtectedRegs(protectedEnd, () => compileValues(c, node.exprs, count, base + count));
  const regs = node.names.map((name) => c.addLocal(name));
  for (let i = 0; i < count; i++) c.emit(c.opcodes.MOVE, regs[i], base + count + i);
}
function compileLocalFunc(c, node) {
  const reg = c.addLocal(node.name);
  const child = c.compileProto(node.body, node.params, node.hasVararg, c.ctx);
  const protoIndex = c.protos.length;
  c.protos.push(child);
  c.emit(c.opcodes.CLOSURE, reg, protoIndex);
}
function compileAssign(c, node) {
  const base = c.nextReg;
  const count = node.targets.length;
  const rhs = base + count * 2;
  const end = rhs + Math.max(count, node.exprs.length) + 2;
  c.markReg(end);
  c.withProtectedRegs(end, () => {
    node.targets.forEach((target, i) => {
      if (target.kind === "DotAccess" || target.kind === "IndexAccess") {
        c.compileExprInto(target.obj, base + i * 2);
        if (target.kind === "DotAccess") c.emit(c.opcodes.LOADK, base + i * 2 + 1, c.constIdx(target.field));
        else c.compileExprInto(target.index, base + i * 2 + 1);
      }
    });
    compileValues(c, node.exprs, count, rhs);
  });
  node.targets.forEach((target, i) => {
    if (target.kind === "NameExpr") {
      const r = c.resolveName(target.name);
      if (r.kind === "local") c.emit(c.opcodes.MOVE, r.index, rhs + i);
      else if (r.kind === "upvalue") c.emit(c.opcodes.SETUPVAL, rhs + i, r.index);
      else c.emit(c.opcodes.SETGLOBAL, rhs + i, c.constIdx(target.name));
    } else c.emit(c.opcodes.SETTABLE, base + i * 2, base + i * 2 + 1, rhs + i);
  });
}
function compileAssignmentTarget(c, target, valueNode) {
  if (target.kind === "NameExpr") {
    const resolution = c.resolveName(target.name);
    if (resolution.kind === "local") {
      c.compileExprInto(valueNode, resolution.index);
    } else if (resolution.kind === "upvalue") {
      const temp = c.allocTemp();
      c.withProtectedRegs(temp, () => c.compileExprInto(valueNode, temp));
      c.emit(c.opcodes.SETUPVAL, temp, resolution.index);
    } else {
      const temp = c.allocTemp();
      c.withProtectedRegs(temp, () => c.compileExprInto(valueNode, temp));
      c.emit(c.opcodes.SETGLOBAL, temp, c.constIdx(target.name));
    }
    return;
  }
  if (target.kind === "DotAccess") {
    const objReg = c.nextReg;
    const keyReg = objReg + 1;
    const valReg = objReg + 2;
    c.markReg(valReg);
    c.withProtectedRegs(valReg, () => {
      c.compileExprInto(target.obj, objReg);
      c.emit(c.opcodes.LOADK, keyReg, c.constIdx(target.field));
      c.compileExprInto(valueNode, valReg);
    });
    c.emit(c.opcodes.SETTABLE, objReg, keyReg, valReg);
    return;
  }
  if (target.kind === "IndexAccess") {
    const objReg = c.nextReg;
    const keyReg = objReg + 1;
    const valReg = objReg + 2;
    c.markReg(valReg);
    c.withProtectedRegs(valReg, () => {
      c.compileExprInto(target.obj, objReg);
      c.compileExprInto(target.index, keyReg);
      c.compileExprInto(valueNode, valReg);
    });
    c.emit(c.opcodes.SETTABLE, objReg, keyReg, valReg);
  }
}
function compileCompoundAssign(c, node) {
  const target = node.target;
  const op = node.op.replace("=", "");
  const opMap = {
    "+": c.opcodes.ADD,
    "-": c.opcodes.SUB,
    "*": c.opcodes.MUL,
    "/": c.opcodes.DIV,
    "%": c.opcodes.MOD,
    "^": c.opcodes.POW,
    "..": c.opcodes.CONCAT,
    "//": c.opcodes.FLOORDIV
  };
  const opcode = opMap[op] ?? c.opcodes.ADD;
  if (target.kind === "NameExpr") {
    const temp = c.nextReg;
    c.markReg(temp + 1);
    const resolution = c.resolveName(target.name);
    if (resolution.kind === "local") c.emit(c.opcodes.MOVE, temp, resolution.index);
    else if (resolution.kind === "upvalue") c.emit(c.opcodes.GETUPVAL, temp, resolution.index);
    else c.emit(c.opcodes.GETGLOBAL, temp, c.constIdx(target.name));
    c.withProtectedRegs(temp + 1, () => c.compileExprInto(node.expr, temp + 1));
    c.emit(opcode, temp, temp, temp + 1);
    if (resolution.kind === "local") c.emit(c.opcodes.MOVE, resolution.index, temp);
    else if (resolution.kind === "upvalue") c.emit(c.opcodes.SETUPVAL, temp, resolution.index);
    else c.emit(c.opcodes.SETGLOBAL, temp, c.constIdx(target.name));
  } else if (target.kind === "DotAccess") {
    const objReg = c.nextReg;
    const keyReg = objReg + 1;
    const valReg = objReg + 2;
    const exprReg = objReg + 3;
    c.markReg(exprReg);
    c.withProtectedRegs(exprReg, () => {
      c.compileExprInto(target.obj, objReg);
      c.emit(c.opcodes.LOADK, keyReg, c.constIdx(target.field));
      c.emit(c.opcodes.GETTABLE, valReg, objReg, keyReg);
      c.compileExprInto(node.expr, exprReg);
    });
    c.emit(opcode, valReg, valReg, exprReg);
    c.emit(c.opcodes.SETTABLE, objReg, keyReg, valReg);
  } else if (target.kind === "IndexAccess") {
    const objReg = c.nextReg;
    const keyReg = objReg + 1;
    const valReg = objReg + 2;
    const exprReg = objReg + 3;
    c.markReg(exprReg);
    c.withProtectedRegs(exprReg, () => {
      c.compileExprInto(target.obj, objReg);
      c.compileExprInto(target.index, keyReg);
      c.emit(c.opcodes.GETTABLE, valReg, objReg, keyReg);
      c.compileExprInto(node.expr, exprReg);
    });
    c.emit(opcode, valReg, valReg, exprReg);
    c.emit(c.opcodes.SETTABLE, objReg, keyReg, valReg);
  }
}
function compileIf(c, node) {
  const condReg = c.allocTemp();
  c.withProtectedRegs(condReg, () => c.compileExprInto(node.cond, condReg));
  const jumpFalse = c.emit(c.opcodes.JMPIF, condReg, 0);
  c.pushScope();
  c.compileBlock(node.then_);
  c.popScope();
  const endJumps = [];
  if (node.elseifs.length > 0 || node.else_) endJumps.push(c.emit(c.opcodes.JMP, 0));
  c.instructions[jumpFalse][2] = c.instructions.length + 1;
  for (const elseifBranch of node.elseifs) {
    const elseifReg = c.allocTemp();
    c.withProtectedRegs(elseifReg, () => c.compileExprInto(elseifBranch.cond, elseifReg));
    const elseifJump = c.emit(c.opcodes.JMPIF, elseifReg, 0);
    c.pushScope();
    c.compileBlock(elseifBranch.body);
    c.popScope();
    endJumps.push(c.emit(c.opcodes.JMP, 0));
    c.instructions[elseifJump][2] = c.instructions.length + 1;
  }
  if (node.else_) {
    c.pushScope();
    c.compileBlock(node.else_);
    c.popScope();
  }
  for (const jump of endJumps) c.instructions[jump][1] = c.instructions.length + 1;
}
function compileWhile(c, node) {
  const loopStart = c.instructions.length;
  const condReg = c.allocTemp();
  c.withProtectedRegs(condReg, () => c.compileExprInto(node.cond, condReg));
  const jumpFalse = c.emit(c.opcodes.JMPIF, condReg, 0);
  c.pushLoop(loopStart + 1);
  c.pushScope();
  c.compileBlock(node.body);
  c.popScope();
  c.emit(c.opcodes.JMP, loopStart + 1);
  c.popLoop();
  c.instructions[jumpFalse][2] = c.instructions.length + 1;
}
function compileRepeat(c, node) {
  const loopStart = c.instructions.length;
  c.pushLoop(0);
  c.pushScope();
  const repeatContext = c.currentLoop();
  if (repeatContext) repeatContext.continueScopeDepth = c.scopes.length;
  c.compileBlock(node.body);
  const condStart = c.instructions.length + 1;
  const repeatLoop = c.currentLoop();
  if (repeatLoop) repeatLoop.continueTarget = condStart;
  const condReg = c.allocTemp();
  c.withProtectedRegs(condReg, () => c.compileExprInto(node.cond, condReg));
  c.popScope();
  c.emit(c.opcodes.JMPIF, condReg, c.instructions.length + 3, 1);
  c.emit(c.opcodes.JMP, loopStart + 1);
  c.popLoop();
}
function compileNumericFor(c, node) {
  const outerIndex = c.locals.get(node.var_);
  c.pushScope();
  const indexReg = c.addLocal(node.var_);
  const limitReg = c.nextReg++;
  const stepReg = c.nextReg++;
  const visibleReg = c.nextReg++;
  c.markReg(visibleReg);
  c.withProtectedRegs(visibleReg, () => {
    if (outerIndex === void 0) c.locals.delete(node.var_);
    else c.locals.set(node.var_, outerIndex);
    c.compileExprInto(node.start, indexReg);
    c.compileExprInto(node.stop, limitReg);
    if (node.step) c.compileExprInto(node.step, stepReg);
    else c.emit(c.opcodes.LOADK, stepReg, c.constIdx(1));
    c.locals.set(node.var_, visibleReg);
  });
  const prep = c.emit(c.opcodes.FORPREP, indexReg, 0);
  const bodyStart = c.instructions.length;
  c.pushLoop(0);
  c.pushScope();
  c.compileBlock(node.body);
  c.popScope();
  const iterationClose = c.emit(c.opcodes.CLOSE, indexReg, visibleReg);
  const loop = c.emit(c.opcodes.FORLOOP, indexReg, bodyStart + 1);
  const numericLoop = c.currentLoop();
  if (numericLoop) numericLoop.continueTarget = iterationClose + 1;
  c.popLoop();
  c.instructions[prep][2] = loop + 1;
  c.popScope();
}
function compileGenericFor(c, node) {
  c.pushScope();
  const iterReg = c.nextReg++;
  const stateReg = c.nextReg++;
  const ctrlReg = c.nextReg++;
  c.markReg(ctrlReg);
  c.withProtectedRegs(ctrlReg + node.iters.length + 2, () => compileValues(c, node.iters, 3, iterReg));
  const loopStart = c.instructions.length;
  c.emit(c.opcodes.TFORLOOP, iterReg, 0, node.names.length);
  const exitJump = c.emit(c.opcodes.JMP, 0);
  c.pushLoop(loopStart + 1);
  for (let i = 0; i < node.names.length; i++) {
    const loopVar = c.addLocal(node.names[i]);
    c.emit(c.opcodes.MOVE, loopVar, iterReg + 3 + i);
  }
  c.pushScope();
  c.compileBlock(node.body);
  c.popScope();
  const close = c.emit(c.opcodes.CLOSE, iterReg + 3, iterReg + 2 + node.names.length);
  c.emit(c.opcodes.JMP, loopStart + 1);
  const genericLoop = c.currentLoop();
  if (genericLoop) genericLoop.continueTarget = close + 1;
  c.popLoop();
  c.instructions[exitJump][1] = c.instructions.length + 1;
  c.popScope();
}
function compileDoBlock(c, node) {
  c.pushScope();
  c.compileBlock(node.body);
  c.popScope();
}
function compileReturn(c, node) {
  if (node.exprs.length === 0) {
    c.emit(c.opcodes.RETURN, 0, 1);
    return;
  }
  const base = c.nextReg;
  const lastIdx = node.exprs.length - 1;
  for (let i = 0; i < lastIdx; i++) {
    c.markReg(base + i);
    c.withProtectedRegs(base + i, () => c.compileExprInto(node.exprs[i], base + i));
  }
  const lastExpr = node.exprs[lastIdx];
  if (c.isMultiRetNode(lastExpr)) {
    c.markReg(base + lastIdx);
    if (lastExpr.kind === "Vararg") {
      c.emit(c.opcodes.VARARG, base + lastIdx, 0);
    } else {
      c.compileMultiRetCallInto(lastExpr, base + lastIdx, 0);
    }
    c.emit(c.opcodes.RETURN, base, 0);
  } else {
    c.markReg(base + lastIdx);
    c.withProtectedRegs(base + lastIdx, () => c.compileExprInto(lastExpr, base + lastIdx));
    c.emit(c.opcodes.RETURN, base, node.exprs.length + 1);
  }
}
function compileExprStmt(c, node) {
  if (node.expr.kind === "Call" || node.expr.kind === "MethodCall") {
    c.compileExprInto(node.expr, c.nextReg);
  }
}
export {
  compileAssign,
  compileCompoundAssign,
  compileDoBlock,
  compileExprStmt,
  compileGenericFor,
  compileIf,
  compileLocalDecl,
  compileLocalFunc,
  compileNumericFor,
  compileRepeat,
  compileReturn,
  compileWhile
};
