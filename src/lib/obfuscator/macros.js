import { quoteBytes, utf8Bytes } from "./literal-values";
import { tokenize } from "./lexer";
const KNOWN_MACROS = /* @__PURE__ */ new Set([
  "LPY_ENCSTR",
  "LPY_STRENC",
  "LPY_ENCNUM",
  "LPY_NUMENC",
  "LPY_ENCFUNC",
  "LPY_FUNCENC",
  "LPY_JIT",
  "LPY_JIT_MAX",
  "LPY_NO_VIRTUALIZE",
  "LPY_NO_UPVALUES",
  "LPY_CRASH",
  "LPY_OBFUSCATED",
  "LPY_LINE"
]);
function isHex64(s) {
  return /^[0-9a-fA-F]{64}$/.test(s);
}
function luaStr(s) {
  return quoteBytes(utf8Bytes(s));
}
function xorHex(plain, hexKey) {
  const keyBytes = [];
  for (let i = 0; i < hexKey.length; i += 2) {
    keyBytes.push(parseInt(hexKey.substr(i, 2), 16));
  }
  let out = "";
  for (let i = 0; i < plain.length; i++) {
    const b = plain.charCodeAt(i) & 255 ^ keyBytes[i % keyBytes.length];
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}
function emitXorDecrypt(cipherHex, keyExpr) {
  return `(function(c,k) local kl=#k/2 local kb={} for i=1,kl do kb[i]=tonumber(string.sub(k,i*2-1,i*2),16) end local r={} for i=1,#c/2 do local a=tonumber(string.sub(c,i*2-1,i*2),16) local b=kb[((i-1)%kl)+1] local x=0 local p=1 for j=0,7 do local ab=a%2 local bb=b%2 if ab~=bb then x=x+p end a=(a-ab)/2 b=(b-bb)/2 p=p*2 end r[i]=string.char(x) end return table.concat(r) end)(${luaStr(cipherHex)},${keyExpr})`;
}
function splitArgs(src) {
  const args = [];
  let depth = 0;
  let bdepth = 0;
  let cdepth = 0;
  let cur = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const q = c;
      cur += c;
      i++;
      while (i < src.length) {
        const cc = src[i];
        cur += cc;
        i++;
        if (cc === "\\" && i < src.length) {
          cur += src[i];
          i++;
          continue;
        }
        if (cc === q) break;
      }
      continue;
    }
    if (c === "[" && src[i + 1] === "[") {
      const end = src.indexOf("]]", i + 2);
      if (end >= 0) {
        cur += src.slice(i, end + 2);
        i = end + 2;
        continue;
      }
    }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "[") bdepth++;
    else if (c === "]") bdepth--;
    else if (c === "{") cdepth++;
    else if (c === "}") cdepth--;
    if (c === "," && depth === 0 && bdepth === 0 && cdepth === 0) {
      args.push(cur.trim());
      cur = "";
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  if (cur.trim().length > 0) args.push(cur.trim());
  return args;
}
function parseLuaString(src) {
  const s = src.trim();
  if (s.length < 2) return null;
  const q = s[0];
  if (q !== '"' && q !== "'" || s[s.length - 1] !== q) return null;
  let out = "";
  for (let i = 1; i < s.length - 1; i++) {
    const c = s[i];
    if (c === "\\") {
      const n = s[i + 1];
      if (n === "n") {
        out += "\n";
        i++;
      } else if (n === "r") {
        out += "\r";
        i++;
      } else if (n === "t") {
        out += "	";
        i++;
      } else if (n === "\\") {
        out += "\\";
        i++;
      } else if (n === '"' || n === "'") {
        out += n;
        i++;
      } else if (n === "x") {
        const hex = s.substr(i + 2, 2);
        out += String.fromCharCode(parseInt(hex, 16));
        i += 3;
      } else if (/[0-9]/.test(n)) {
        let j = i + 1;
        let num = "";
        while (j < s.length - 1 && /[0-9]/.test(s[j]) && num.length < 3) {
          num += s[j];
          j++;
        }
        out += String.fromCharCode(parseInt(num, 10));
        i = j - 1;
      } else {
        out += n;
        i++;
      }
    } else {
      out += c;
    }
  }
  return out;
}
function findMatchingParen(src, openIdx) {
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === q) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === "-" && src[i + 1] === "-") {
      const nl = src.indexOf("\n", i);
      i = nl < 0 ? src.length : nl;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}
function lineOf(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) {
    if (src[i] === "\n") line++;
  }
  return line;
}
function randHex(len) {
  let s = "";
  const chars = "0123456789abcdef";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}
function preprocessMacros(input) {
  const used = [];
  const errors = [];
  let src = input;
  const shimTokens = tokenize(src);
  const shims = [];
  for (let k = 0; k < shimTokens.length - 3; k++) {
    if (shimTokens[k].value !== "if" || shimTokens[k + 1].value !== "not" || shimTokens[k + 2].value !== "LPY_OBFUSCATED" || shimTokens[k + 3].value !== "then") continue;
    let depth = 1, waitingDo = 0;
    for (let j = k + 4; j < shimTokens.length; j++) {
      const t = shimTokens[j];
      if (t.type === "string") continue;
      if (["if", "function", "repeat"].includes(t.value)) depth++;
      else if (t.value === "for" || t.value === "while") {
        depth++;
        waitingDo++;
      } else if (t.value === "do") {
        if (waitingDo) waitingDo--;
        else depth++;
      } else if (t.value === "end" || t.value === "until") depth--;
      if (depth === 0) {
        const start = shimTokens[k].span?.start, end = t.span?.end;
        if (start !== void 0 && end !== void 0) shims.push({ start, end });
        k = j;
        break;
      }
    }
  }
  for (const range of shims.reverse()) src = src.slice(0, range.start) + src.slice(range.end);
  const simple = tokenize(src).filter((t) => t.type === "ident" && (t.value === "LPY_OBFUSCATED" || t.value === "LPY_LINE"));
  for (const t of simple.reverse()) if (t.span) {
    used.push(t.value);
    const value = t.value === "LPY_OBFUSCATED" ? "true" : String(t.line);
    src = src.slice(0, t.span.start) + value + src.slice(t.span.end);
  }
  for (let pass = 0; pass < 8; pass++) {
    const before = src;
    src = expandCallMacros(src, used, errors);
    if (src === before) break;
  }
  const leftover = /* @__PURE__ */ new Set();
  for (const t of tokenize(src)) if (t.type === "ident" && /^LPY_/.test(t.value) && !KNOWN_MACROS.has(t.value)) leftover.add(t.value);
  for (const name of leftover) {
    errors.push(`Reserved identifier '${name}' is not a known LPY macro.`);
  }
  return { code: src, used: Array.from(new Set(used)), errors };
}
function expandCallMacros(src, used, errors) {
  const eligible = new Set(tokenize(src).filter((t) => t.type === "ident").map((t) => t.span?.start));
  const re = /\b(LPY_[A-Z_][A-Z0-9_]*)\s*\(/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    if (!eligible.has(m.index)) continue;
    if (!KNOWN_MACROS.has(name)) continue;
    if (name === "LPY_OBFUSCATED" || name === "LPY_LINE") continue;
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = findMatchingParen(src, openIdx);
    if (closeIdx < 0) {
      errors.push(`Unterminated macro call: ${name}`);
      continue;
    }
    const argSrc = src.slice(openIdx + 1, closeIdx);
    const args = splitArgs(argSrc);
    let replacement = null;
    try {
      replacement = expandOne(name, args, src, m.index);
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
      replacement = null;
    }
    if (replacement === null) continue;
    out += src.slice(last, m.index);
    out += replacement;
    last = closeIdx + 1;
    used.push(name);
    re.lastIndex = last;
  }
  out += src.slice(last);
  return out;
}
function expandOne(name, args, _src, _idx) {
  switch (name) {
    case "LPY_ENCSTR":
    case "LPY_STRENC": {
      if (args.length !== 1) throw new Error("expects exactly 1 argument");
      const s = parseLuaString(args[0]);
      if (s === null) throw new Error("argument must be a string literal constant");
      if (s.length === 0) throw new Error("zero-length string is not allowed");
      const key = randHex(32);
      const cipher = xorHex(s, key);
      return emitXorDecrypt(cipher, luaStr(key));
    }
    case "LPY_ENCNUM":
    case "LPY_NUMENC": {
      if (args.length !== 1) throw new Error("expects exactly 1 argument");
      const numTxt = args[0].trim();
      const n = Number(numTxt);
      if (!Number.isFinite(n)) throw new Error("argument must be a numeric constant");
      const isInt = Number.isInteger(n) && Math.abs(n) < 2 ** 31;
      if (isInt) {
        const mul = 1 + Math.floor(Math.random() * 9999);
        const off = Math.floor(Math.random() * 1e5) - 5e4;
        const enc = n * mul + off;
        return `((${enc} - (${off})) / ${mul})`;
      }
      const a = Math.random() * 1e3 - 500;
      const b = n - a;
      return `(${a} + (${b}))`;
    }
    case "LPY_ENCFUNC":
    case "LPY_FUNCENC": {
      if (args.length !== 3) {
        throw new Error("expects 3 arguments: (function, encKey, decKeyVar)");
      }
      const fnSrc = args[0].trim();
      if (!/^function\s*\(/.test(fnSrc)) {
        throw new Error("first argument must be a constant function expression");
      }
      const encKey = parseLuaString(args[1]);
      if (encKey === null) throw new Error("second argument must be a string literal");
      if (!isHex64(encKey)) throw new Error("encryption key must be a 64-char hex string");
      const decKeyExpr = args[2].trim();
      if (/^["']/.test(decKeyExpr)) {
        throw new Error("decryption key cannot be a constant; must be a runtime variable");
      }
      const payload = `return ${fnSrc}`;
      const cipher = xorHex(payload, encKey);
      const decryptedSrc = emitXorDecrypt(cipher, decKeyExpr);
      return `((loadstring or load)(${decryptedSrc})())`;
    }
    case "LPY_NO_VIRTUALIZE":
      return null;
    case "LPY_JIT":
    case "LPY_JIT_MAX": {
      if (args.length !== 1) throw new Error("expects exactly 1 argument");
      const fnSrc = args[0].trim();
      if (!/^function\s*\(/.test(fnSrc)) {
        throw new Error("argument must be a constant function expression");
      }
      return `(${fnSrc})`;
    }
    case "LPY_NO_UPVALUES": {
      if (args.length !== 1) throw new Error("expects exactly 1 argument");
      const fnSrc = args[0].trim();
      if (!/^function\s*\(/.test(fnSrc)) {
        throw new Error("argument must be a constant function expression");
      }
      return `((function() local f=${fnSrc} return function(...) return f(...) end end)())`;
    }
    case "LPY_CRASH": {
      if (args.length !== 0) throw new Error("takes no arguments");
      throw new Error("LPY_CRASH is unsupported: destructive traps are forbidden");
    }
  }
  return null;
}
export {
  preprocessMacros
};
