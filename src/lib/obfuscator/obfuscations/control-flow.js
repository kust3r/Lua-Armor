let _stateCounter = 0;
function nextStateId() {
  return _stateCounter++;
}
const FLATTENABLE = /* @__PURE__ */ new Set(["If", "While", "Repeat"]);
const isFlattenable = (stmt) => FLATTENABLE.has(stmt.kind);
function generateOpaquePredicate(alwaysTrue) {
  const n = Math.floor(Math.random() * 100) + 2;
  if (alwaysTrue) {
    return {
      kind: "BinOp",
      op: ">=",
      left: { kind: "BinOp", op: "*", left: { kind: "NumberLit", value: n }, right: { kind: "NumberLit", value: n } },
      right: { kind: "NumberLit", value: 0 }
    };
  }
  return {
    kind: "BinOp",
    op: "<",
    left: { kind: "BinOp", op: "*", left: { kind: "NumberLit", value: n }, right: { kind: "NumberLit", value: n } },
    right: { kind: "NumberLit", value: 0 }
  };
}
function hoistTopLevelLocals(block) {
  const names = [];
  const seen = /* @__PURE__ */ new Set();
  const body = [];
  const remember = (name) => {
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  };
  for (const stmt of block.body) {
    if (stmt.kind === "LocalDecl") {
      const node = stmt;
      node.names.forEach(remember);
      if (node.exprs.length > 0) {
        body.push({
          kind: "Assign",
          targets: node.names.map((name) => ({ kind: "NameExpr", name })),
          exprs: node.exprs
        });
      }
      continue;
    }
    if (stmt.kind === "LocalFunc") {
      const node = stmt;
      remember(node.name);
      body.push({
        kind: "Assign",
        targets: [{ kind: "NameExpr", name: node.name }],
        exprs: [{ kind: "FuncExpr", params: node.params, hasVararg: node.hasVararg, body: node.body }]
      });
      continue;
    }
    body.push(stmt);
  }
  const decls = names.length ? [{ kind: "LocalDecl", names, exprs: [] }] : [];
  return { block: { kind: "Block", body }, decls };
}
function flattenBlock(block) {
  const stmts = block.body;
  if (stmts.length === 0) {
    const endState2 = nextStateId();
    return [{ id: endState2, body: [], next: null }];
  }
  let currentBody = [];
  const groups = [];
  for (const stmt of stmts) {
    if (isFlattenable(stmt)) {
      if (currentBody.length > 0) {
        groups.push({ stmts: [...currentBody] });
        currentBody = [];
      }
      groups.push({ stmts: [], controlFlow: stmt });
    } else {
      currentBody.push(stmt);
    }
  }
  if (currentBody.length > 0) groups.push({ stmts: currentBody });
  const groupIds = groups.map(() => nextStateId());
  const endState = nextStateId();
  const states = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const stateId = groupIds[i];
    const after = i < groups.length - 1 ? groupIds[i + 1] : endState;
    if (!group.controlFlow) {
      states.push({ id: stateId, body: group.stmts, next: after });
      continue;
    }
    const cf = group.controlFlow;
    if (cf.kind === "If") {
      const ifNode = cf;
      const branches = [
        { cond: ifNode.cond, body: ifNode.then_ },
        ...ifNode.elseifs || []
      ];
      let failState = nextStateId();
      states.push({ id: failState, body: ifNode.else_ ? ifNode.else_.body : [], next: after });
      for (let b = branches.length - 1; b >= 0; b--) {
        const bodyState = nextStateId();
        states.push({ id: bodyState, body: branches[b].body.body, next: after });
        const testState = nextStateId();
        states.push({
          id: testState,
          body: [],
          next: null,
          condNext: { cond: branches[b].cond, trueState: bodyState, falseState: failState }
        });
        failState = testState;
      }
      states.push({ id: stateId, body: [], next: failState });
    } else {
      states.push({ id: stateId, body: [cf], next: after });
    }
  }
  states.push({ id: endState, body: [], next: null });
  const entryIdx = states.findIndex((s) => s.id === groupIds[0]);
  if (entryIdx > 0) states.unshift(states.splice(entryIdx, 1)[0]);
  return states;
}
function generateDispatcher(states, stateVarName) {
  const body = [];
  const go = (target) => ({
    kind: "Assign",
    targets: [{ kind: "NameExpr", name: stateVarName }],
    exprs: [{ kind: "NumberLit", value: target }]
  });
  const initialState = states.length > 0 ? states[0].id : 0;
  body.push({
    kind: "LocalDecl",
    names: [stateVarName],
    exprs: [{ kind: "NumberLit", value: initialState }]
  });
  const shuffledStates = [...states];
  for (let i = shuffledStates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledStates[i], shuffledStates[j]] = [shuffledStates[j], shuffledStates[i]];
  }
  const elseifs = [];
  let firstCond = null;
  let firstBody = null;
  for (let i = 0; i < shuffledStates.length; i++) {
    const state = shuffledStates[i];
    const stateBody = [...state.body];
    const last = stateBody[stateBody.length - 1];
    const endsInJump = !!last && (last.kind === "Return" || last.kind === "Break");
    if (state.condNext) {
      stateBody.push({
        kind: "If",
        cond: state.condNext.cond,
        then_: { kind: "Block", body: [go(state.condNext.trueState)] },
        elseifs: [],
        else_: { kind: "Block", body: [go(state.condNext.falseState)] }
      });
    } else if (!endsInJump) {
      if (state.next !== null) {
        stateBody.push(go(state.next));
      } else {
        stateBody.push({ kind: "Break" });
      }
    }
    if (Math.random() < 0.2 && stateBody.length > 1) {
      const pred = generateOpaquePredicate(false);
      stateBody.splice(0, 0, {
        kind: "If",
        cond: pred,
        then_: { kind: "Block", body: [{ kind: "Break" }] },
        elseifs: []
      });
    }
    const cond = {
      kind: "BinOp",
      op: "==",
      left: { kind: "NameExpr", name: stateVarName },
      right: { kind: "NumberLit", value: state.id }
    };
    const blockBody = { kind: "Block", body: stateBody };
    if (i === 0) {
      firstCond = cond;
      firstBody = blockBody;
    } else {
      elseifs.push({ cond, body: blockBody });
    }
  }
  if (!firstCond || !firstBody) {
    return { kind: "Block", body };
  }
  const whileBody = {
    kind: "Block",
    body: [{
      kind: "If",
      cond: firstCond,
      then_: firstBody,
      elseifs,
      else_: { kind: "Block", body: [{ kind: "Break" }] }
    }]
  };
  body.push({
    kind: "While",
    cond: { kind: "BoolLit", value: true },
    body: whileBody
  });
  return { kind: "Block", body };
}
function flattenControlFlow(ast) {
  if (!ast.body.some(isFlattenable)) return ast;
  _stateCounter = Math.floor(Math.random() * 1e3);
  if (ast.body.some((n) => n.kind === "LocalDecl" || n.kind === "LocalFunc")) return ast;
  const hoisted = hoistTopLevelLocals(ast);
  const states = flattenBlock(hoisted.block);
  const stateVar = "_sf" + Math.floor(1e5 + Math.random() * 9e5);
  const dispatcher = generateDispatcher(states, stateVar);
  return { kind: "Block", body: [...hoisted.decls, ...dispatcher.body] };
}
export {
  flattenBlock,
  flattenControlFlow,
  generateOpaquePredicate
};
