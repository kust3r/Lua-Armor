import { buildNativePrototype } from "../native-functions";
import { elideUncapturedCloses } from "../close-elision";
import { LuaDiagnostic } from "../diagnostics";
import {
  compileLocalDecl,
  compileLocalFunc,
  compileAssign,
  compileCompoundAssign,
  compileIf,
  compileWhile,
  compileRepeat,
  compileNumericFor,
  compileGenericFor,
  compileDoBlock,
  compileReturn,
  compileExprStmt
} from "./statements";
import {
  compileNumberExpression,
  compileStringExpression,
  compileBoolExpression,
  compileNilExpression,
  compileVarargExpression,
  compileVariableExpression,
  compileBinOp,
  compileUnOp,
  compileCallExpression,
  compileMethodCallExpression,
  compileDotAccess,
  compileIndexAccess,
  compileTableConstructor,
  compileFuncExpression
} from "./expressions";
function shuffleOpcodes() {
  const names = [
    "LOADK",
    "LOADNIL",
    "LOADBOOL",
    "MOVE",
    "GETGLOBAL",
    "SETGLOBAL",
    "GETUPVAL",
    "SETUPVAL",
    "ADD",
    "SUB",
    "MUL",
    "DIV",
    "MOD",
    "POW",
    "UNM",
    "NOT",
    "LEN",
    "CONCAT",
    "EQ",
    "LT",
    "LE",
    "TEST",
    "TESTSET",
    "JMP",
    "JMPIF",
    "CALL",
    "TAILCALL",
    "RETURN",
    "FORPREP",
    "FORLOOP",
    "TFORLOOP",
    "NEWTABLE",
    "GETTABLE",
    "SETTABLE",
    "SETLIST",
    "SELF",
    "CLOSURE",
    "CLOSE",
    "VARARG",
    "FLOORDIV"
  ];
  const used = /* @__PURE__ */ new Set();
  const map = {};
  for (const name of names) {
    let value = 0;
    do
      value = Math.floor(Math.random() * 200) + 10;
    while (used.has(value));
    used.add(value);
    map[name] = value;
  }
  return map;
}
function compile(ast, params = [], hasVararg = false, target = "luau", policy = {}) {
  const opcodes = shuffleOpcodes();
  const compileNative = (fn, p) => buildNativePrototype(fn, p, target, compileProto, compileNative);
  function compileProto(block, paramNames, protoHasVararg, parent) {
    const instructions = [];
    const constants = [];
    const protos = [];
    const locals = /* @__PURE__ */ new Map();
    const scopes = [];
    const scopeSlots = [];
    const upvalues = [];
    const upvalueMap = /* @__PURE__ */ new Map();
    const loopStack = [];
    let nextReg = 0;
    let maxReg = 0;
    const MAX_REGS = 200;
    function markReg(reg) {
      if (reg > maxReg) maxReg = reg;
    }
    function allocTemp() {
      const reg = nextReg;
      markReg(reg);
      if (nextReg > MAX_REGS) {
        return reg;
      }
      return reg;
    }
    function withProtectedRegs(highWaterMark, fn) {
      const saved = nextReg;
      if (highWaterMark >= nextReg) nextReg = highWaterMark + 1;
      const result = fn();
      nextReg = saved;
      return result;
    }
    function addLocal(name) {
      const reg = nextReg++;
      const previous = locals.get(name);
      locals.set(name, reg);
      const scope = scopes[scopes.length - 1];
      if (scope && !scope.has(name)) scope.set(name, previous);
      scopeSlots[scopeSlots.length - 1]?.push(reg);
      markReg(reg);
      return reg;
    }
    function pushScope() {
      scopes.push(/* @__PURE__ */ new Map());
      scopeSlots.push([]);
    }
    function closeScopes(depth) {
      for (let i = scopeSlots.length - 1; i >= depth; i--) {
        for (const slot of scopeSlots[i]) emit(opcodes.CLOSE, slot, slot);
      }
    }
    function popScope() {
      closeScopes(scopes.length - 1);
      scopeSlots.pop();
      const scope = scopes.pop();
      if (!scope) return;
      for (const [name, previous] of scope) {
        if (previous === void 0) locals.delete(name);
        else locals.set(name, previous);
      }
    }
    function constIdx(value) {
      let index = constants.findIndex((c) => Object.is(c, value));
      if (index === -1) {
        index = constants.length;
        constants.push(value);
      }
      return index;
    }
    function emit(op, a = 0, b = 0, c = 0) {
      const idx = instructions.length;
      instructions.push([op, a, b, c]);
      return idx;
    }
    function addUpvalue(name, source, index) {
      const existing = upvalueMap.get(name);
      if (existing !== void 0) return existing;
      const upIndex = upvalues.length;
      upvalues.push({ name, source, index });
      upvalueMap.set(name, upIndex);
      return upIndex;
    }
    const ctx = {
      locals,
      resolveForChild(name) {
        const localIndex = locals.get(name);
        if (localIndex !== void 0) return { source: 0, index: localIndex };
        const ownUp = upvalueMap.get(name);
        if (ownUp !== void 0) return { source: 1, index: ownUp };
        if (!parent) return null;
        const inherited = parent.resolveForChild(name);
        if (!inherited) return null;
        const captured = addUpvalue(name, inherited.source, inherited.index);
        return { source: 1, index: captured };
      }
    };
    function resolveName(name) {
      const localIndex = locals.get(name);
      if (localIndex !== void 0) return { kind: "local", index: localIndex };
      const ownUp = upvalueMap.get(name);
      if (ownUp !== void 0) return { kind: "upvalue", index: ownUp };
      if (parent) {
        const inherited = parent.resolveForChild(name);
        if (inherited) {
          const captured = addUpvalue(name, inherited.source, inherited.index);
          return { kind: "upvalue", index: captured };
        }
      }
      return { kind: "global" };
    }
    function isMultiRetNode(n) {
      return n.kind === "Vararg" || n.kind === "Call" || n.kind === "MethodCall";
    }
    function emitLastMultiRet(lastArg, destReg) {
      if (lastArg.kind === "Vararg") {
        emit(opcodes.VARARG, destReg, 0);
      } else {
        compileMultiRetCallInto(lastArg, destReg, 0);
      }
    }
    function compileMultiRetCallInto(node, baseReg, numResults) {
      const cVal = numResults === 0 ? 0 : numResults + 1;
      if (node.kind === "Call") {
        const lastArg = node.args.length > 0 ? node.args[node.args.length - 1] : null;
        const lastIsMulti = lastArg && isMultiRetNode(lastArg);
        const topReg = baseReg + 1 + node.args.length;
        markReg(topReg);
        if (numResults > 0) markReg(baseReg + numResults - 1);
        if (lastIsMulti) {
          withProtectedRegs(topReg, () => {
            compileExprInto(node.func, baseReg);
            for (let i = 0; i < node.args.length - 1; i++) compileExprInto(node.args[i], baseReg + 1 + i);
          });
          emitLastMultiRet(lastArg, baseReg + node.args.length);
          emit(opcodes.CALL, baseReg, 0, cVal);
        } else {
          withProtectedRegs(topReg, () => {
            compileExprInto(node.func, baseReg);
            for (let i = 0; i < node.args.length; i++) compileExprInto(node.args[i], baseReg + 1 + i);
          });
          emit(opcodes.CALL, baseReg, node.args.length + 1, cVal);
        }
      } else if (node.kind === "MethodCall") {
        const lastArg = node.args.length > 0 ? node.args[node.args.length - 1] : null;
        const lastIsMulti = lastArg && isMultiRetNode(lastArg);
        const keyReg = baseReg + 2 + node.args.length;
        markReg(keyReg);
        if (numResults > 0) markReg(baseReg + numResults - 1);
        if (lastIsMulti) {
          withProtectedRegs(keyReg, () => {
            compileExprInto(node.obj, baseReg + 1);
            emit(opcodes.LOADK, keyReg, constIdx(node.method));
            emit(opcodes.GETTABLE, baseReg, baseReg + 1, keyReg);
            for (let i = 0; i < node.args.length - 1; i++) compileExprInto(node.args[i], baseReg + 2 + i);
          });
          emitLastMultiRet(lastArg, baseReg + 1 + node.args.length);
          emit(opcodes.CALL, baseReg, 0, cVal);
        } else {
          withProtectedRegs(keyReg, () => {
            compileExprInto(node.obj, baseReg + 1);
            emit(opcodes.LOADK, keyReg, constIdx(node.method));
            emit(opcodes.GETTABLE, baseReg, baseReg + 1, keyReg);
            for (let i = 0; i < node.args.length; i++) compileExprInto(node.args[i], baseReg + 2 + i);
          });
          emit(opcodes.CALL, baseReg, node.args.length + 2, cVal);
        }
      } else {
        compileExprInto(node, baseReg);
      }
    }
    function compileBlock(blockNode) {
      for (const stmt of blockNode.body) compileStmt(stmt);
    }
    function getCtx() {
      return {
        opcodes,
        wholeStringLiterals: policy.wholeStringLiterals,
        instructions,
        constants,
        protos,
        locals,
        scopes,
        upvalues,
        upvalueMap,
        get nextReg() {
          return nextReg;
        },
        set nextReg(v) {
          nextReg = v;
        },
        get maxReg() {
          return maxReg;
        },
        set maxReg(v) {
          maxReg = v;
        },
        parent,
        ctx,
        markReg,
        allocTemp,
        withProtectedRegs,
        addLocal,
        pushScope,
        popScope,
        closeScopes,
        constIdx,
        emit,
        addUpvalue,
        resolveName,
        isMultiRetNode,
        emitLastMultiRet,
        compileMultiRetCallInto,
        compileBlock,
        compileExprInto,
        compileStmt,
        compileProto,
        loopStack,
        pushLoop(continueTarget) {
          loopStack.push({ breakPatches: [], continuePatches: [], continueTarget, scopeDepth: scopes.length, continueScopeDepth: scopes.length });
        },
        popLoop() {
          const ctx2 = loopStack.pop();
          if (ctx2) {
            for (const idx of ctx2.continuePatches) {
              instructions[idx][1] = ctx2.continueTarget;
            }
            for (const idx of ctx2.breakPatches) {
              instructions[idx][1] = instructions.length + 1;
            }
          }
        },
        currentLoop() {
          return loopStack.length > 0 ? loopStack[loopStack.length - 1] : void 0;
        }
      };
    }
    function compileStmt(node) {
      const c = getCtx();
      switch (node.kind) {
        case "LocalDecl":
          compileLocalDecl(c, node);
          break;
        case "LocalFunc":
          compileLocalFunc(c, node);
          break;
        case "Assign":
          compileAssign(c, node);
          break;
        case "CompoundAssign":
          compileCompoundAssign(c, node);
          break;
        case "If":
          compileIf(c, node);
          break;
        case "While":
          compileWhile(c, node);
          break;
        case "Repeat":
          compileRepeat(c, node);
          break;
        case "NumericFor":
          compileNumericFor(c, node);
          break;
        case "GenericFor":
          compileGenericFor(c, node);
          break;
        case "DoBlock":
          compileDoBlock(c, node);
          break;
        case "Return":
          compileReturn(c, node);
          break;
        case "ExprStmt":
          compileExprStmt(c, node);
          break;
        case "Break": {
          const loop = c.currentLoop();
          if (loop) {
            closeScopes(loop.scopeDepth);
            const patchIdx = c.emit(c.opcodes.JMP, 0);
            loop.breakPatches.push(patchIdx);
          }
          break;
        }
        case "Continue": {
          const loop = c.currentLoop();
          if (loop) {
            closeScopes(loop.continueScopeDepth);
            loop.continuePatches.push(c.emit(c.opcodes.JMP, loop.continueTarget));
          }
          break;
        }
        default:
          throw new LuaDiagnostic("UNSUPPORTED_STATEMENT", "virtualize", node.kind, target, node.span);
      }
    }
    function compileExprInto(node, destReg) {
      markReg(destReg);
      const c = getCtx();
      switch (node.kind) {
        case "ParenExpr":
          compileExprInto(node.expr, destReg);
          break;
        case "IfExpr": {
          compileExprInto(node.cond, destReg);
          const jf = emit(opcodes.JMPIF, destReg, 0);
          compileExprInto(node.thenExpr, destReg);
          const je = emit(opcodes.JMP, 0);
          instructions[jf][2] = instructions.length + 1;
          compileExprInto(node.elseExpr, destReg);
          instructions[je][1] = instructions.length + 1;
          break;
        }
        case "NumberLit":
          compileNumberExpression(c, node, destReg);
          break;
        case "StringLit":
          compileStringExpression(c, node, destReg);
          break;
        case "BoolLit":
          compileBoolExpression(c, node, destReg);
          break;
        case "NilLit":
          compileNilExpression(c, node, destReg);
          break;
        case "Vararg":
          compileVarargExpression(c, node, destReg);
          break;
        case "NameExpr":
          compileVariableExpression(c, node, destReg);
          break;
        case "BinOp":
          compileBinOp(c, node, destReg);
          break;
        case "UnOp":
          compileUnOp(c, node, destReg);
          break;
        case "Call":
          compileCallExpression(c, node, destReg);
          break;
        case "MethodCall":
          compileMethodCallExpression(c, node, destReg);
          break;
        case "DotAccess":
          compileDotAccess(c, node, destReg);
          break;
        case "IndexAccess":
          compileIndexAccess(c, node, destReg);
          break;
        case "TableCtor":
          compileTableConstructor(c, node, destReg);
          break;
        case "FuncExpr": {
          if (node.virtualization === "native") {
            const child = compileNative(node, ctx);
            const k = protos.length;
            protos.push(child);
            emit(opcodes.CLOSURE, destReg, k);
          } else compileFuncExpression(c, node, destReg);
          break;
        }
        default:
          throw new LuaDiagnostic("UNSUPPORTED_EXPRESSION", "virtualize", node.kind, target, node.span);
      }
    }
    pushScope();
    for (const param of paramNames) addLocal(param);
    compileBlock(block);
    popScope();
    if (instructions.length === 0 || instructions[instructions.length - 1][0] !== opcodes.RETURN) {
      emit(opcodes.RETURN, 0, 1);
    }
    return elideUncapturedCloses({ instructions, constants, numParams: paramNames.length, hasVararg: protoHasVararg, maxReg, protos, upvalues }, opcodes);
  }
  return { proto: compileProto(ast, params, hasVararg), opcodes };
}
export {
  compile
};
