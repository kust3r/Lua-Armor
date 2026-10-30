import { LuaDiagnostic } from "./diagnostics";
import { transform } from "./ast-walk";
const AST_KINDS = {
  Block: true,
  LocalDecl: true,
  LocalFunc: true,
  Assign: true,
  CompoundAssign: true,
  If: true,
  While: true,
  Repeat: true,
  NumericFor: true,
  GenericFor: true,
  DoBlock: true,
  Return: true,
  Break: true,
  Continue: true,
  ExprStmt: true,
  NumberLit: true,
  StringLit: true,
  BoolLit: true,
  NilLit: true,
  NameExpr: true,
  BinOp: true,
  UnOp: true,
  Call: true,
  MethodCall: true,
  DotAccess: true,
  IndexAccess: true,
  TableCtor: true,
  FuncExpr: true,
  Vararg: true,
  ParenExpr: true,
  IfExpr: true
};
function parse(tokens) {
  let pos = 0;
  const copySpan = (span) => span ? { ...span } : void 0;
  function cur() {
    return tokens[pos] || { type: "eof", value: "", line: 0 };
  }
  function curIs(v) {
    const c = cur();
    return c.value === v && c.type !== "string" && c.type !== "number";
  }
  function peek(v) {
    if (!v) return true;
    return curIs(v);
  }
  function peekType(t) {
    return cur().type === t;
  }
  function eat(v) {
    const t = cur();
    if (v && t.value !== v) throw new LuaDiagnostic("EXPECTED_TOKEN", "parse", `Expected '${v}' got '${t.value}'`, void 0, t.span);
    pos++;
    return t;
  }
  function match(v) {
    const c = cur();
    if (c.value === v && c.type !== "string" && c.type !== "number") {
      pos++;
      return true;
    }
    return false;
  }
  function skipLocalTypeAnnotation() {
    if (curIs(":")) throw new LuaDiagnostic("UNSUPPORTED_TYPES", "parse", "type annotation", void 0, cur().span);
  }
  function parseBlock(terminators = ["end"]) {
    const body = [];
    while (!terminators.some((t) => curIs(t)) && cur().type !== "eof") {
      const token = cur();
      const stmt = parseStatement();
      if (stmt) Object.assign(stmt, { span: copySpan(token.span) });
      if (stmt) body.push(stmt);
      match(";");
    }
    return { kind: "Block", body };
  }
  function parseStatement() {
    const t = cur();
    if (t.type === "ident" && (t.value === "type" && tokens[pos + 1]?.type === "keyword" && tokens[pos + 1]?.value === "function" || t.value === "export" && tokens[pos + 1]?.value === "type" && tokens[pos + 2]?.type === "keyword" && tokens[pos + 2]?.value === "function")) {
      throw new LuaDiagnostic("UNSUPPORTED_TYPE_FUNCTION", "parse", "Luau type functions are not supported", void 0, t.span);
    }
    if (["goto", "::"].includes(t.value) || t.value === "type" && tokens[pos + 1]?.type === "ident" || t.value === "export" && tokens[pos + 1]?.value === "type") throw new LuaDiagnostic("UNSUPPORTED_SYNTAX", "parse", t.value, void 0, t.span);
    if (t.type === "keyword" || t.type === "ident") {
      if (t.value === "local") return parseLocal();
      if (t.value === "if") return parseIf();
      if (t.value === "while") return parseWhile();
      if (t.value === "repeat") return parseRepeat();
      if (t.value === "for") return parseFor();
      if (t.value === "do") return parseDo();
      if (t.value === "return") return parseReturn();
      if (t.value === "break") {
        eat();
        return { kind: "Break" };
      }
      if (t.value === "continue") {
        eat();
        return { kind: "Continue" };
      }
      if (t.value === "function") return parseFuncStatement();
    }
    const expr = parseExpr();
    if (curIs("::")) throw new LuaDiagnostic("UNSUPPORTED_CAST", "parse", "type cast or label", void 0, cur().span);
    const compOps = ["+=", "-=", "*=", "/=", "//=", "%=", "^=", "..="];
    if (cur().type === "op" && compOps.includes(cur().value)) {
      const op = eat().value;
      const rhs = parseExpr();
      return { kind: "CompoundAssign", op, target: expr, expr: rhs };
    }
    if (curIs("<")) throw new LuaDiagnostic("UNSUPPORTED_ATTRIBUTE", "parse", "variable attributes", void 0, cur().span);
    if (curIs("=")) {
      eat("=");
      const targets = [expr];
      const exprs = [parseExpr()];
      while (match(",")) exprs.push(parseExpr());
      return { kind: "Assign", targets, exprs };
    }
    if (curIs(",") && isLValue(expr)) {
      const targets = [expr];
      while (match(",")) targets.push(parseExpr());
      eat("=");
      const exprs = [parseExpr()];
      while (match(",")) exprs.push(parseExpr());
      return { kind: "Assign", targets, exprs };
    }
    return { kind: "ExprStmt", expr };
  }
  function isLValue(n) {
    return n.kind === "NameExpr" || n.kind === "DotAccess" || n.kind === "IndexAccess";
  }
  function parseLocal() {
    eat("local");
    if (curIs("function")) {
      eat("function");
      const name = eat().value;
      if (name === "LPY_NO_VIRTUALIZE") throw new LuaDiagnostic("RESERVED_MACRO", "parse", name);
      return parseFuncBody(name, true);
    }
    const names = [eat().value];
    if (names[0] === "LPY_NO_VIRTUALIZE") throw new LuaDiagnostic("RESERVED_MACRO", "parse", "LPY_NO_VIRTUALIZE");
    skipLocalTypeAnnotation();
    while (match(",")) {
      names.push(eat().value);
      skipLocalTypeAnnotation();
    }
    let exprs = [];
    if (match("=")) {
      exprs.push(parseExpr());
      while (match(",")) exprs.push(parseExpr());
    }
    return { kind: "LocalDecl", names, exprs };
  }
  function parseFuncBody(name, isLocal) {
    if (curIs("<")) {
      throw new LuaDiagnostic("UNSUPPORTED_TYPES", "parse", "generic type parameters", void 0, cur().span);
      let depth = 1;
      pos++;
      while (pos < tokens.length && depth > 0) {
        if (cur().value === "<") depth++;
        else if (cur().value === ">") depth--;
        pos++;
      }
    }
    eat("(");
    const params = [];
    let hasVararg = false;
    while (!curIs(")")) {
      if (curIs("...")) {
        eat();
        hasVararg = true;
        skipLocalTypeAnnotation();
        break;
      }
      params.push(eat().value);
      skipLocalTypeAnnotation();
      if (!match(",")) break;
    }
    eat(")");
    skipLocalTypeAnnotation();
    const body = parseBlock(["end"]);
    eat("end");
    if (name && isLocal) {
      return { kind: "LocalFunc", name, params, hasVararg, body };
    }
    if (name) {
      const funcExpr = { kind: "FuncExpr", params, hasVararg, body };
      return { kind: "Assign", targets: [{ kind: "NameExpr", name }], exprs: [funcExpr] };
    }
    return { kind: "FuncExpr", params, hasVararg, body };
  }
  function parseFuncStatement() {
    eat("function");
    let name = eat().value;
    let target = { kind: "NameExpr", name };
    while (match(".")) {
      const field = eat().value;
      target = { kind: "DotAccess", obj: target, field };
      name += "." + field;
    }
    if (curIs(":")) {
      eat(":");
      const method = eat().value;
      if (curIs("<")) {
        throw new LuaDiagnostic("UNSUPPORTED_TYPES", "parse", "generic type parameters", void 0, cur().span);
        let depth = 1;
        pos++;
        while (pos < tokens.length && depth > 0) {
          if (cur().value === "<") depth++;
          else if (cur().value === ">") depth--;
          pos++;
        }
      }
      eat("(");
      const params2 = ["self"];
      let hasVararg2 = false;
      while (!curIs(")")) {
        if (curIs("...")) {
          eat();
          hasVararg2 = true;
          skipLocalTypeAnnotation();
          break;
        }
        params2.push(eat().value);
        skipLocalTypeAnnotation();
        if (!match(",")) break;
      }
      eat(")");
      skipLocalTypeAnnotation();
      const body2 = parseBlock(["end"]);
      eat("end");
      const funcExpr2 = { kind: "FuncExpr", params: params2, hasVararg: hasVararg2, body: body2 };
      const methodTarget = { kind: "DotAccess", obj: target, field: method };
      return { kind: "Assign", targets: [methodTarget], exprs: [funcExpr2] };
    }
    if (curIs("<")) {
      throw new LuaDiagnostic("UNSUPPORTED_TYPES", "parse", "generic type parameters", void 0, cur().span);
      let depth = 1;
      pos++;
      while (pos < tokens.length && depth > 0) {
        if (cur().value === "<") depth++;
        else if (cur().value === ">") depth--;
        pos++;
      }
    }
    eat("(");
    const params = [];
    let hasVararg = false;
    while (!curIs(")")) {
      if (curIs("...")) {
        eat();
        hasVararg = true;
        skipLocalTypeAnnotation();
        break;
      }
      params.push(eat().value);
      skipLocalTypeAnnotation();
      if (!match(",")) break;
    }
    eat(")");
    skipLocalTypeAnnotation();
    const body = parseBlock(["end"]);
    eat("end");
    const funcExpr = { kind: "FuncExpr", params, hasVararg, body };
    return { kind: "Assign", targets: [target], exprs: [funcExpr] };
  }
  function parseIf() {
    eat("if");
    const cond = parseExpr();
    eat("then");
    const then_ = parseBlock(["else", "elseif", "end"]);
    const elseifs = [];
    while (curIs("elseif")) {
      eat("elseif");
      const ec = parseExpr();
      eat("then");
      const eb = parseBlock(["else", "elseif", "end"]);
      elseifs.push({ cond: ec, body: eb });
    }
    let else_;
    if (match("else")) {
      else_ = parseBlock(["end"]);
    }
    eat("end");
    return { kind: "If", cond, then_, elseifs, else_ };
  }
  function parseWhile() {
    eat("while");
    const cond = parseExpr();
    eat("do");
    const body = parseBlock(["end"]);
    eat("end");
    return { kind: "While", cond, body };
  }
  function parseRepeat() {
    eat("repeat");
    const body = parseBlock(["until"]);
    eat("until");
    const cond = parseExpr();
    return { kind: "Repeat", body, cond };
  }
  function parseFor() {
    eat("for");
    const firstName = eat().value;
    skipLocalTypeAnnotation();
    if (match("=")) {
      const start = parseExpr();
      eat(",");
      const stop = parseExpr();
      let step;
      if (match(",")) step = parseExpr();
      eat("do");
      const body2 = parseBlock(["end"]);
      eat("end");
      return { kind: "NumericFor", var_: firstName, start, stop, step, body: body2 };
    }
    const names = [firstName];
    while (match(",")) {
      names.push(eat().value);
      skipLocalTypeAnnotation();
    }
    eat("in");
    const iters = [parseExpr()];
    while (match(",")) iters.push(parseExpr());
    eat("do");
    const body = parseBlock(["end"]);
    eat("end");
    return { kind: "GenericFor", names, iters, body };
  }
  function parseDo() {
    eat("do");
    const body = parseBlock(["end"]);
    eat("end");
    return { kind: "DoBlock", body };
  }
  function parseReturn() {
    eat("return");
    const exprs = [];
    if (cur().type !== "eof" && !curIs("end") && !curIs("else") && !curIs("elseif") && !curIs("until") && !curIs(";")) {
      exprs.push(parseExpr());
      while (match(",")) exprs.push(parseExpr());
    }
    return { kind: "Return", exprs };
  }
  function parseExpr() {
    if (curIs("::")) throw new LuaDiagnostic("UNSUPPORTED_CAST", "parse", "type cast", void 0, cur().span);
    if (curIs("if")) {
      return parseIfExpr();
    }
    const token = cur();
    const node = parseOr();
    return { ...node, span: copySpan(token.span) };
  }
  function parseIfExpr(headTok = "if") {
    eat(headTok);
    const cond = parseExpr();
    eat("then");
    const thenExpr = parseExpr();
    const elseExpr = curIs("elseif") ? parseIfExpr("elseif") : (eat("else"), parseExpr());
    return { kind: "IfExpr", cond, thenExpr, elseExpr };
  }
  function parseOr() {
    let left = parseAnd();
    while (curIs("or")) {
      eat();
      left = { kind: "BinOp", op: "or", left, right: parseAnd() };
    }
    return left;
  }
  function parseAnd() {
    let left = parseComparison();
    while (curIs("and")) {
      eat();
      left = { kind: "BinOp", op: "and", left, right: parseComparison() };
    }
    return left;
  }
  function parseComparison() {
    let left = parseBitOr();
    const ops = ["<", ">", "<=", ">=", "==", "~="];
    while (cur().type === "op" && ops.includes(cur().value)) {
      const op = eat().value;
      left = { kind: "BinOp", op, left, right: parseBitOr() };
    }
    return left;
  }
  function parseBitOr() {
    let left = parseBitXor();
    while (curIs("|")) {
      eat();
      left = { kind: "BinOp", op: "|", left, right: parseBitXor() };
    }
    return left;
  }
  function parseBitXor() {
    let left = parseBitAnd();
    while (cur().type === "op" && cur().value === "~" && tokens[pos + 1]?.value !== "=") {
      eat();
      left = { kind: "BinOp", op: "~", left, right: parseBitAnd() };
    }
    return left;
  }
  function parseBitAnd() {
    let left = parseShift();
    while (curIs("&")) {
      eat();
      left = { kind: "BinOp", op: "&", left, right: parseShift() };
    }
    return left;
  }
  function parseShift() {
    let left = parseConcat();
    while (curIs("<<") || curIs(">>")) {
      const op = eat().value;
      left = { kind: "BinOp", op, left, right: parseConcat() };
    }
    return left;
  }
  function parseConcat() {
    let left = parseAddSub();
    if (curIs("..")) {
      eat();
      left = { kind: "BinOp", op: "..", left, right: parseConcat() };
    }
    return left;
  }
  function parseAddSub() {
    let left = parseMulDiv();
    while (curIs("+") || curIs("-")) {
      const op = eat().value;
      left = { kind: "BinOp", op, left, right: parseMulDiv() };
    }
    return left;
  }
  function parseMulDiv() {
    let left = parseUnary();
    while (curIs("*") || curIs("/") || curIs("%") || curIs("//")) {
      const op = eat().value;
      left = { kind: "BinOp", op, left, right: parseUnary() };
    }
    return left;
  }
  function parseUnary() {
    if (curIs("not")) {
      eat();
      return { kind: "UnOp", op: "not", expr: parseUnary() };
    }
    if (curIs("-")) {
      eat();
      return { kind: "UnOp", op: "-", expr: parseUnary() };
    }
    if (curIs("#")) {
      eat();
      return { kind: "UnOp", op: "#", expr: parseUnary() };
    }
    if (curIs("~")) {
      eat();
      return { kind: "UnOp", op: "~", expr: parseUnary() };
    }
    return parsePower();
  }
  function parsePower() {
    let left = parsePostfix();
    if (curIs("^")) {
      eat();
      left = { kind: "BinOp", op: "^", left, right: parseUnary() };
    }
    return left;
  }
  function parsePostfix() {
    let expr = parsePrimary();
    while (true) {
      if (curIs("::")) throw new LuaDiagnostic("UNSUPPORTED_CAST", "parse", "type cast", void 0, cur().span);
      if (curIs(".")) {
        eat();
        const field = eat().value;
        expr = { kind: "DotAccess", obj: expr, field };
      } else if (curIs("[")) {
        eat("[");
        const index = parseExpr();
        eat("]");
        expr = { kind: "IndexAccess", obj: expr, index };
      } else if (curIs("(")) {
        eat("(");
        const args = [];
        if (!curIs(")")) {
          args.push(parseExpr());
          while (match(",")) args.push(parseExpr());
        }
        eat(")");
        expr = { kind: "Call", func: expr, args };
      } else if (curIs(":")) {
        const savedPos = pos;
        eat(":");
        if (cur().type === "ident") {
          const method = eat().value;
          if (curIs("(")) {
            eat("(");
            const args = [];
            if (!curIs(")")) {
              args.push(parseExpr());
              while (match(",")) args.push(parseExpr());
            }
            eat(")");
            expr = { kind: "MethodCall", obj: expr, method, args };
          } else if (cur().type === "string") {
            const arg = (() => {
              const t = eat();
              return { kind: "StringLit", value: t.value, bytes: t.bytes ? [...t.bytes] : void 0, valueAtParse: t.value };
            })();
            expr = { kind: "MethodCall", obj: expr, method, args: [arg] };
          } else if (curIs("{")) {
            const tbl = parseTableCtor();
            expr = { kind: "MethodCall", obj: expr, method, args: [tbl] };
          } else {
            pos = savedPos;
            break;
          }
        } else {
          pos = savedPos;
          break;
        }
      } else if (cur().type === "string" && (expr.kind === "NameExpr" || expr.kind === "DotAccess" || expr.kind === "Call")) {
        const arg = (() => {
          const t = eat();
          return { kind: "StringLit", value: t.value, bytes: t.bytes ? [...t.bytes] : void 0, valueAtParse: t.value };
        })();
        expr = { kind: "Call", func: expr, args: [arg] };
      } else if (curIs("{")) {
        const tbl = parseTableCtor();
        expr = { kind: "Call", func: expr, args: [tbl] };
      } else {
        break;
      }
    }
    return expr;
  }
  function parsePrimary() {
    const t = cur();
    if (t.type === "punct" && t.value === "`") {
      eat("`");
      const bytes = [], literalBytes = [], args = [];
      while (true) {
        if (cur().type !== "string") throw new LuaDiagnostic("INVALID_INTERPOLATION", "parse", "expected literal segment", void 0, cur().span);
        const literal = eat();
        literalBytes.push(...literal.bytes ?? []);
        for (const byte of literal.bytes ?? []) {
          bytes.push(byte);
          if (byte === 37) bytes.push(37);
        }
        if (match("`")) break;
        eat("{");
        args.push({ kind: "ParenExpr", expr: parseExpr() });
        eat("}");
        bytes.push(37, 42);
      }
      if (!args.length) {
        const value2 = new TextDecoder().decode(new Uint8Array(literalBytes));
        return { kind: "StringLit", bytes: literalBytes, value: value2, valueAtParse: value2, span: copySpan(t.span) };
      }
      const value = new TextDecoder().decode(new Uint8Array(bytes));
      return { kind: "MethodCall", obj: { kind: "StringLit", bytes, value, valueAtParse: value }, method: "format", args, span: copySpan(t.span), luauInterpolation: true };
    }
    if (t.value === "::") throw new LuaDiagnostic("UNSUPPORTED_CAST", "parse", "type cast", void 0, t.span);
    if (t.type === "number") {
      eat();
      const raw = t.value.replace(/_/g, "");
      let value = Number(raw);
      if (/^0x/i.test(raw) && /[pP.]/.test(raw)) {
        const [mantissa, exponent = "0"] = raw.slice(2).split(/[pP]/);
        const [a, b = ""] = mantissa.split(".");
        value = (parseInt(a || "0", 16) + (b ? parseInt(b, 16) / 16 ** b.length : 0)) * 2 ** Number(exponent);
      }
      const integer = /^(?:\d+|0[xX][\da-fA-F]+|0[bB][01]+)$/.test(raw) ? BigInt(raw).toString() : void 0;
      return { kind: "NumberLit", span: copySpan(t.span), value, exact: { lexeme: t.value, valueAtParse: value, integer } };
    }
    if (t.type === "string") {
      eat();
      return { kind: "StringLit", span: copySpan(t.span), value: t.value, bytes: t.bytes ? [...t.bytes] : void 0, valueAtParse: t.value };
    }
    if (t.type === "keyword" && t.value === "true") {
      eat();
      return { kind: "BoolLit", value: true };
    }
    if (t.type === "keyword" && t.value === "false") {
      eat();
      return { kind: "BoolLit", value: false };
    }
    if (t.type === "keyword" && t.value === "nil") {
      eat();
      return { kind: "NilLit" };
    }
    if (t.type === "op" && t.value === "...") {
      eat();
      return { kind: "Vararg" };
    }
    if (t.type === "keyword" && t.value === "function") {
      eat("function");
      if (curIs("<")) {
        throw new LuaDiagnostic("UNSUPPORTED_TYPES", "parse", "generic type parameters", void 0, cur().span);
        let depth = 1;
        pos++;
        while (pos < tokens.length && depth > 0) {
          if (cur().value === "<") depth++;
          else if (cur().value === ">") depth--;
          pos++;
        }
      }
      eat("(");
      const params = [];
      let hasVararg = false;
      while (!curIs(")")) {
        if (curIs("...")) {
          eat();
          hasVararg = true;
          skipLocalTypeAnnotation();
          break;
        }
        params.push(eat().value);
        skipLocalTypeAnnotation();
        if (!match(",")) break;
      }
      eat(")");
      skipLocalTypeAnnotation();
      const body = parseBlock(["end"]);
      eat("end");
      return { kind: "FuncExpr", params, hasVararg, body };
    }
    if (t.type === "punct" && t.value === "(") {
      eat("(");
      const expr = parseExpr();
      eat(")");
      return { kind: "ParenExpr", expr };
    }
    if (t.type === "punct" && t.value === "{") {
      return parseTableCtor();
    }
    if (t.type === "ident") {
      eat();
      return { kind: "NameExpr", name: t.value, span: copySpan(t.span) };
    }
    throw new LuaDiagnostic("UNEXPECTED_TOKEN", "parse", t.value, void 0, t.span);
  }
  function parseTableCtor() {
    eat("{");
    const fields = [];
    while (!curIs("}")) {
      if (curIs("[")) {
        eat("[");
        const key = parseExpr();
        eat("]");
        eat("=");
        const value = parseExpr();
        fields.push({ style: "computed", key, value });
      } else if (cur().type === "ident" && tokens[pos + 1]?.type !== "string" && tokens[pos + 1]?.value === "=") {
        const key = (() => {
          const t = eat();
          return { kind: "StringLit", value: t.value, bytes: t.bytes ? [...t.bytes] : void 0, valueAtParse: t.value };
        })();
        eat("=");
        const value = parseExpr();
        fields.push({ style: "named", key, value });
      } else {
        fields.push({ style: "sequence", value: parseExpr() });
      }
      if (!match(",") && !match(";")) break;
    }
    eat("}");
    return { kind: "TableCtor", fields };
  }
  const block = parseBlock(["eof"]);
  block.comments = tokens.comments?.map((comment) => ({ ...comment }));
  return transform(block, (node) => {
    if (node.kind === "Call" && node.func.kind === "NameExpr" && node.func.name === "LPY_NO_VIRTUALIZE") {
      if (node.args.length !== 1) throw new LuaDiagnostic("INVALID_MACRO", "parse", "LPY_NO_VIRTUALIZE requires one function", void 0, node.span);
      let fn = node.args[0];
      while (fn.kind === "ParenExpr") fn = fn.expr;
      if (fn.kind !== "FuncExpr") throw new LuaDiagnostic("INVALID_MACRO", "parse", "LPY_NO_VIRTUALIZE requires a static function", void 0, node.span);
      return { ...fn, virtualization: "native" };
    }
    return node;
  });
}
export {
  AST_KINDS,
  parse
};
