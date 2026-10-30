import { sourceDirectives } from "../directives";
import { validateAst } from "../validate-ast";
import { LuaDiagnostic, unreachable } from "../diagnostics";
import { TokenWriter } from "./token-writer";
import { needsParens, UNARY_PREC, getOp } from "./precedence";
import { emitNumber, emitString } from "./literals";
function astToLua(ast, options = {}) {
  validateAst(ast, options.target ?? "luau");
  const w = new TokenWriter();
  w.compact = (options.mode ?? "readable") === "compact";
  const diagnostics = [];
  const comments = options.comments ? [...ast.comments ?? []].filter((c) => !c.directive).sort((a, b) => a.line - b.line) : [];
  let commentIndex = 0;
  const emitComments = (line) => {
    while (commentIndex < comments.length && comments[commentIndex].line <= line) {
      w.write(comments[commentIndex++].text);
      w.newline();
    }
  };
  function emitBlock(block) {
    for (const stmt of block.body) {
      emitComments(stmt.span?.line ?? -1);
      emitStmt(stmt);
      w.write(";");
      w.newline();
    }
  }
  function emitStmt(node) {
    switch (node.kind) {
      case "Block":
        emitBlock(node);
        break;
      case "LocalDecl": {
        w.write("local");
        w.space();
        w.write(node.names.join(", "));
        if (node.exprs.length > 0) {
          w.space();
          w.write("=");
          w.space();
          emitExprList(node.exprs);
        }
        break;
      }
      case "LocalFunc": {
        w.write("local");
        w.space();
        w.write("function");
        w.space();
        w.write(node.name);
        emitFuncBody(node.params, node.hasVararg, node.body);
        break;
      }
      case "Assign": {
        emitExprList(node.targets);
        w.space();
        w.write("=");
        w.space();
        emitExprList(node.exprs);
        break;
      }
      case "CompoundAssign": {
        emitExpr(node.target);
        w.space();
        w.write(node.op);
        w.space();
        emitExpr(node.expr);
        break;
      }
      case "If": {
        w.write("if");
        w.space();
        emitExpr(node.cond);
        w.space();
        w.write("then");
        w.newline();
        w.pushIndent();
        emitBlock(node.then_);
        w.popIndent();
        for (const elif of node.elseifs) {
          w.write("elseif");
          w.space();
          emitExpr(elif.cond);
          w.space();
          w.write("then");
          w.newline();
          w.pushIndent();
          emitBlock(elif.body);
          w.popIndent();
        }
        if (node.else_) {
          w.write("else");
          w.newline();
          w.pushIndent();
          emitBlock(node.else_);
          w.popIndent();
        }
        w.write("end");
        break;
      }
      case "While": {
        w.write("while");
        w.space();
        emitExpr(node.cond);
        w.space();
        w.write("do");
        w.newline();
        w.pushIndent();
        emitBlock(node.body);
        w.popIndent();
        w.write("end");
        break;
      }
      case "Repeat": {
        w.write("repeat");
        w.newline();
        w.pushIndent();
        emitBlock(node.body);
        w.popIndent();
        w.write("until");
        w.space();
        emitExpr(node.cond);
        break;
      }
      case "NumericFor": {
        w.write("for");
        w.space();
        w.write(node.var_);
        w.space();
        w.write("=");
        w.space();
        emitExpr(node.start);
        w.write(",");
        w.space();
        emitExpr(node.stop);
        if (node.step) {
          w.write(",");
          w.space();
          emitExpr(node.step);
        }
        w.space();
        w.write("do");
        w.newline();
        w.pushIndent();
        emitBlock(node.body);
        w.popIndent();
        w.write("end");
        break;
      }
      case "GenericFor": {
        w.write("for");
        w.space();
        w.write(node.names.join(", "));
        w.space();
        w.write("in");
        w.space();
        emitExprList(node.iters);
        w.space();
        w.write("do");
        w.newline();
        w.pushIndent();
        emitBlock(node.body);
        w.popIndent();
        w.write("end");
        break;
      }
      case "DoBlock": {
        w.write("do");
        w.newline();
        w.pushIndent();
        emitBlock(node.body);
        w.popIndent();
        w.write("end");
        break;
      }
      case "Return": {
        w.write("return");
        if (node.exprs.length > 0) {
          w.space();
          emitExprList(node.exprs);
        }
        break;
      }
      case "Break":
        w.write("break");
        break;
      case "Continue":
        w.write("continue");
        break;
      case "ExprStmt":
        emitExpr(node.expr);
        break;
      default:
        throw new LuaDiagnostic("INVALID_STATEMENT", "emit", node.kind, options.target, node.span);
    }
  }
  function emitExpr(node) {
    switch (node.kind) {
      case "NumberLit":
        w.write(emitNumber(node));
        break;
      case "StringLit": {
        let literal = emitString(node, options.escapeAllBytes);
        for (const text of options.protectedLiteralText ?? []) {
          if (text) literal = literal.split(text).join("\\" + String(text.charCodeAt(0)).padStart(3, "0") + text.slice(1));
        }
        w.write(literal);
        break;
      }
      case "BoolLit":
        w.write(node.value ? "true" : "false");
        break;
      case "NilLit":
        w.write("nil");
        break;
      case "NameExpr":
        w.write(node.name);
        break;
      case "Vararg":
        w.write("...");
        break;
      case "ParenExpr":
        w.write("(");
        emitExpr(node.expr);
        w.write(")");
        break;
      case "IfExpr": {
        w.write("if");
        w.space();
        emitExpr(node.cond);
        w.space();
        w.write("then");
        w.space();
        emitExpr(node.thenExpr);
        w.space();
        if (node.elseExpr.kind === "IfExpr") {
          w.write("elseif");
          w.space();
          emitIfExprTail(node.elseExpr);
        } else {
          w.write("else");
          w.space();
          emitExpr(node.elseExpr);
        }
        break;
      }
      case "BinOp":
        emitBinOp(node);
        break;
      case "UnOp":
        emitUnOp(node);
        break;
      case "Call": {
        emitCallBase(node.func);
        w.write("(");
        emitExprList(node.args);
        w.write(")");
        break;
      }
      case "MethodCall": {
        emitCallBase(node.obj);
        w.write(":");
        w.write(node.method);
        w.write("(");
        emitExprList(node.args);
        w.write(")");
        break;
      }
      case "DotAccess":
        emitCallBase(node.obj);
        w.write(".");
        w.write(node.field);
        break;
      case "IndexAccess":
        emitCallBase(node.obj);
        w.write("[");
        emitExpr(node.index);
        w.write("]");
        break;
      case "TableCtor":
        emitTable(node);
        break;
      case "FuncExpr": {
        if (node.virtualization === "native") w.write("LPY_NO_VIRTUALIZE(");
        w.write("function");
        emitFuncBody(node.params, node.hasVararg, node.body);
        if (node.virtualization === "native") w.write(")");
        break;
      }
      case "Block":
      case "LocalDecl":
      case "LocalFunc":
      case "Assign":
      case "CompoundAssign":
      case "If":
      case "While":
      case "Repeat":
      case "NumericFor":
      case "GenericFor":
      case "DoBlock":
      case "Return":
      case "Break":
      case "Continue":
      case "ExprStmt":
        throw new LuaDiagnostic("INVALID_EXPRESSION", "emit", node.kind, options.target, node.span);
      default:
        unreachable(node);
    }
  }
  function emitIfExprTail(node) {
    if (node.kind !== "IfExpr") {
      emitExpr(node);
      return;
    }
    emitExpr(node.cond);
    w.space();
    w.write("then");
    w.space();
    emitExpr(node.thenExpr);
    w.space();
    if (node.elseExpr.kind === "IfExpr") {
      w.write("elseif");
      w.space();
      emitIfExprTail(node.elseExpr);
    } else {
      w.write("else");
      w.space();
      emitExpr(node.elseExpr);
    }
  }
  function emitCallBase(func) {
    if (!["NameExpr", "Call", "MethodCall", "DotAccess", "IndexAccess", "ParenExpr"].includes(func.kind)) {
      w.write("(");
      emitExpr(func);
      w.write(")");
    } else {
      emitExpr(func);
    }
  }
  function emitBinOp(node) {
    const wrap = (child, side) => {
      const needWrap = child.kind === "BinOp" && needsParens(node.op, child.op, side, options.target ?? "luau") || child.kind === "IfExpr" || child.kind === "UnOp" && node.op === "^" && side === "left";
      if (needWrap) w.write("(");
      emitExpr(child);
      if (needWrap) w.write(")");
    };
    wrap(node.left, "left");
    w.space();
    w.write(node.op);
    w.space();
    wrap(node.right, "right");
  }
  function emitUnOp(node) {
    w.write(node.op);
    if (node.op === "not") w.space();
    const child = node.expr;
    const needWrap = child.kind === "BinOp" && getOp(child.op, options.target ?? "luau").prec < UNARY_PREC || child.kind === "IfExpr";
    if (needWrap) w.write("(");
    emitExpr(child);
    if (needWrap) w.write(")");
  }
  function emitTable(node) {
    if (node.fields.length === 0) {
      w.write("{");
      w.write("}");
      return;
    }
    w.write("{");
    w.newline();
    w.pushIndent();
    for (let i = 0; i < node.fields.length; i++) {
      const f = node.fields[i];
      if (f.style === "named" && f.key?.kind === "StringLit" && /^[A-Za-z_]\w*$/.test(f.key.value)) {
        w.write(f.key.value);
        w.space();
        w.write("=");
        w.space();
        emitExpr(f.value);
      } else if (f.key) {
        w.write("[");
        emitExpr(f.key);
        w.write("]");
        w.space();
        w.write("=");
        w.space();
        emitExpr(f.value);
      } else {
        emitExpr(f.value);
      }
      if (i < node.fields.length - 1) {
        w.write(",");
        w.space();
      }
      w.newline();
    }
    w.popIndent();
    w.write("}");
  }
  function emitFuncBody(params, hasVararg, body) {
    w.write("(");
    const allParams = hasVararg ? [...params, "..."] : params;
    w.write(allParams.join(", "));
    w.write(")");
    w.newline();
    w.pushIndent();
    emitBlock(body);
    w.popIndent();
    w.write("end");
  }
  function emitExprList(exprs) {
    for (let i = 0; i < exprs.length; i++) {
      if (i > 0) {
        w.write(",");
        w.space();
      }
      emitExpr(exprs[i]);
    }
  }
  const directives = sourceDirectives(ast, options.target ?? "luau", "emit");
  if (options.comments) {
    if (w.compact) throw new LuaDiagnostic("COMMENTS_IN_COMPACT", "emit", "comments require readable mode", options.target);
  }
  emitBlock(ast);
  emitComments(Infinity);
  return { code: (directives.length ? directives.join("\n") + "\n" : "") + w.toString(), diagnostics };
}
export {
  astToLua
};
