import { getTokens, storeTokens } from "./token-cache";
import { LuaDiagnostic } from "./diagnostics";
import { utf8Bytes } from "./literal-values";
const KEYWORDS = new Set("and break do else elseif end false for function goto if in local nil not or repeat return then true until while continue".split(" "));
function tokenize(src, options = {}) {
  const cached = getTokens(src, options.comments === true);
  if (cached) return cached;
  const tokens = [];
  const comments = [];
  let i = 0, line = 1, column = 1;
  const advance = () => {
    const c = src[i++];
    if (c === "\n") {
      line++;
      column = 1;
    } else column++;
    return c;
  };
  const fail = (feature) => {
    throw new LuaDiagnostic("INVALID_SOURCE", "lex", feature, void 0, { start: i, end: i + 1, line, column });
  };
  const long = () => {
    const m = src.slice(i).match(/^\[(=*)\[/);
    if (!m) return;
    const end = src.indexOf("]" + m[1] + "]", i + m[0].length);
    if (end < 0) fail("unterminated long string/comment");
    const begin = i + m[0].length;
    const raw = src.slice(begin, end);
    const stop = end + m[0].length;
    while (i < stop) advance();
    return raw.replace(/\r\n|\n\r|\r/g, "\n").replace(/^\n/, "");
  };
  const interpolation = [];
  const segment = () => {
    const start = i, startLine = line, startColumn = column;
    let quoted = '"';
    while (i < src.length && src[i] !== "`" && src[i] !== "{") {
      const c = advance();
      if (c === "\\") {
        if (i >= src.length) fail("unterminated interpolation escape");
        const e = advance();
        if (e === "`" || e === "{" || e === "}") quoted += `\\${e.charCodeAt(0).toString().padStart(3, "0")}`;
        else {
          quoted += "\\" + e;
          if (e === "u" && src[i] === "{") {
            quoted += advance();
            while (i < src.length && /[\da-fA-F]/.test(src[i])) quoted += advance();
            if (src[i] !== "}") fail("unicode escape in interpolated string");
            quoted += advance();
          } else if (e === "z") {
            while (i < src.length && /\s/.test(src[i])) quoted += advance();
          } else if (e === "\r" && src[i] === "\n" || e === "\n" && src[i] === "\r") quoted += advance();
        }
      } else if (c === '"') quoted += '\\"';
      else if (c === "\n" || c === "\r") fail("newline in interpolated string");
      else if (c === "}") fail("unescaped closing brace in interpolated string");
      else quoted += c;
    }
    if (i >= src.length) fail("unterminated interpolated string");
    let decoded;
    try {
      decoded = tokenize(quoted + '"')[0];
    } catch {
      fail("invalid escape in interpolated string");
    }
    tokens.push({ ...decoded, line: startLine, raw: src.slice(start, i), span: { start, end: i, line: startLine, column: startColumn } });
    const endStart = i, endLine = line, endColumn = column, boundary = advance();
    tokens.push({ type: "punct", value: boundary, line: endLine, raw: boundary, span: { start: endStart, end: i, line: endLine, column: endColumn } });
    if (boundary === "`") interpolation.pop();
  };
  while (i < src.length) {
    if (/\s/.test(src[i])) {
      advance();
      continue;
    }
    const start = i, startLine = line, startColumn = column;
    const push = (type, value, bytes) => tokens.push({ type, value, bytes, line: startLine, raw: src.slice(start, i), span: { start, end: i, line: startLine, column: startColumn } });
    if (src.startsWith("--", i)) {
      advance();
      advance();
      if (long() === void 0) while (i < src.length && src[i] !== "\n" && src[i] !== "\r") advance();
      const text = src.slice(start, i), directive = text.startsWith("--!");
      if (options.comments || directive) comments.push({ text, line: startLine, directive });
      continue;
    }
    if (src[i] === "[") {
      const value = long();
      if (value !== void 0) {
        push("string", value, utf8Bytes(value));
        continue;
      }
    }
    if (/\d/.test(src[i]) || src[i] === "." && /\d/.test(src[i + 1] || "")) {
      const match = src.slice(i).match(/^(?:0[xX][\da-fA-F_]+(?:\.[\da-fA-F_]*)?(?:[pP][+-]?\d+)?|0[bB][01_]+|(?:\d[\d_]*(?:\.(?!\.)[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)/);
      if (!match) fail("number");
      const raw = match?.[0] ?? "";
      for (let n = 0; n < raw.length; n++) advance();
      if (/[A-Za-z_]/.test(src[i] || "")) fail("invalid numeric suffix");
      push("number", raw);
      continue;
    }
    if (src[i] === "`") {
      advance();
      push("punct", "`");
      interpolation.push(0);
      segment();
      continue;
    }
    if (interpolation.length && src[i] === "{") interpolation[interpolation.length - 1]++;
    if (interpolation.length && src[i] === "}") {
      const top = interpolation.length - 1;
      if (interpolation[top] === 0) {
        advance();
        push("punct", "}");
        segment();
        continue;
      }
      interpolation[top]--;
    }
    if (src[i] === '"' || src[i] === "'") {
      const q = advance();
      const bytes = [];
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\n" || src[i] === "\r") fail("newline in short string");
        if (src[i] !== "\\") {
          const cp = src.codePointAt(i);
          if (cp === void 0) fail("string");
          const ch = String.fromCodePoint(cp ?? 0);
          bytes.push(...utf8Bytes(ch));
          for (let n = 0; n < ch.length; n++) advance();
          continue;
        }
        advance();
        if (i >= src.length) fail("unterminated escape");
        const c2 = advance();
        const escapes = { a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11, "\\": 92, '"': 34, "'": 39 };
        if (c2 in escapes) bytes.push(escapes[c2]);
        else if (/\d/.test(c2)) {
          let digits = c2;
          while (digits.length < 3 && /\d/.test(src[i] || "")) digits += advance();
          const b = Number(digits);
          if (b > 255) fail("decimal escape exceeds 255");
          bytes.push(b);
        } else if (c2 === "x") {
          const h = src.slice(i, i + 2);
          if (!/^[\da-fA-F]{2}$/.test(h)) fail("hex escape");
          advance();
          advance();
          bytes.push(parseInt(h, 16));
        } else if (c2 === "u") {
          const m = src.slice(i).match(/^\{([\da-fA-F]+)\}/);
          if (!m) fail("unicode escape");
          const cp = parseInt(m?.[1] ?? "", 16);
          if (cp > 1114111 || cp >= 55296 && cp <= 57343) fail("unicode scalar");
          for (let n = 0; n < (m?.[0].length ?? 0); n++) advance();
          bytes.push(...utf8Bytes(String.fromCodePoint(cp)));
        } else if (c2 === "z") {
          while (i < src.length && /\s/.test(src[i])) advance();
        } else if (c2 === "\n" || c2 === "\r") {
          if (c2 === "\r" && src[i] === "\n" || c2 === "\n" && src[i] === "\r") advance();
          bytes.push(10);
        } else fail(`unknown escape ${c2}`);
      }
      if (src[i] !== q) fail("unterminated string");
      advance();
      push("string", new TextDecoder().decode(new Uint8Array(bytes)), bytes);
      continue;
    }
    if (/[A-Za-z_]/.test(src[i])) {
      let id = "";
      while (/[A-Za-z_\d]/.test(src[i] || "")) id += advance();
      push(KEYWORDS.has(id) ? "keyword" : "ident", id);
      continue;
    }
    const op = ["...", "//=", "<<=", ">>=", "..=", "==", "~=", "<=", ">=", "..", "<<", ">>", "::", "+=", "-=", "*=", "/=", "%=", "^=", "//"].find((s) => src.startsWith(s, i));
    if (op) {
      for (let n = 0; n < op.length; n++) advance();
      push("op", op);
      continue;
    }
    const c = advance();
    push("+-*/%^#<>=~&|".includes(c) ? "op" : "punct", c);
  }
  if (interpolation.length) fail("unterminated interpolation expression");
  tokens.push({ type: "eof", value: "", line, span: { start: i, end: i, line, column } });
  tokens.comments = comments;
  storeTokens(src, options.comments === true, tokens);
  return tokens;
}
export {
  tokenize
};
