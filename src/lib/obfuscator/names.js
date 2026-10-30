import { DEFAULT_NAME_CONFIG } from "./types";
let _seed = 0;
let _useSeeded = false;
function xorshift32() {
  _seed ^= _seed << 13;
  _seed ^= _seed >> 17;
  _seed ^= _seed << 5;
  return (_seed >>> 0) / 4294967296;
}
function rng() {
  return _useSeeded ? xorshift32() : Math.random();
}
let _charset = DEFAULT_NAME_CONFIG.charset;
let _minLen = DEFAULT_NAME_CONFIG.minLength;
let _maxLen = DEFAULT_NAME_CONFIG.maxLength;
let _counter = 0;
let _fieldCounter = 0;
let _usedNames = /* @__PURE__ */ new Set();
let _nameStyle = "mangled";
let _forceLuraph = false;
const LURAPH_RESERVED = /* @__PURE__ */ new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "goto",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
  "_ENV",
  "_G",
  "self",
  "continue",
  "type",
  "export"
]);
const LP_START = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
const LP_BODY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
function luraphIdent() {
  for (let attempt = 0; attempt < 400; attempt++) {
    const len = 4 + Math.floor(rng() * 5);
    let name = LP_START[Math.floor(rng() * LP_START.length)];
    for (let i = 1; i < len; i++) name += LP_BODY[Math.floor(rng() * LP_BODY.length)];
    if (!_usedNames.has(name) && !LURAPH_RESERVED.has(name)) {
      _usedNames.add(name);
      return name;
    }
  }
  const fb = "L" + (_counter++).toString(36) + Math.floor(rng() * 9999).toString(36);
  _usedNames.add(fb);
  return fb;
}
function pushLuraphNames() {
  _forceLuraph = true;
}
function popLuraphNames() {
  _forceLuraph = false;
}
function payloadName() {
  return luraphIdent();
}
const CONFUSE_WORDS = [
  "index",
  "iterator",
  "length",
  "size",
  "key",
  "value",
  "data",
  "count",
  "increment",
  "include",
  "string",
  "number",
  "type",
  "void",
  "int",
  "float",
  "bool",
  "char",
  "double",
  "long",
  "short",
  "unsigned",
  "signed",
  "program",
  "factory",
  "Factory",
  "new",
  "delete",
  "table",
  "array",
  "object",
  "class",
  "arr",
  "obj",
  "cls",
  "dir",
  "directory",
  "isWindows",
  "isLinux",
  "game",
  "roblox",
  "gsub",
  "gmatch",
  "gfind",
  "onload",
  "load",
  "loadstring",
  "loadfile",
  "dofile",
  "require",
  "parse",
  "byte",
  "code",
  "bytecode",
  "idx",
  "const",
  "loader",
  "loaders",
  "module",
  "export",
  "exports",
  "import",
  "imports",
  "package",
  "packages",
  "math",
  "os",
  "io",
  "write",
  "print",
  "read",
  "readline",
  "readlines",
  "close",
  "flush",
  "open",
  "popen",
  "tmpfile",
  "tmpname",
  "rename",
  "remove",
  "seek",
  "setvbuf",
  "lines",
  "call",
  "apply",
  "raise",
  "pcall",
  "xpcall",
  "coroutine",
  "create",
  "resume",
  "status",
  "wrap",
  "yield",
  "debug",
  "traceback",
  "getinfo",
  "getlocal",
  "setlocal",
  "getupvalue",
  "setupvalue",
  "getuservalue",
  "setuservalue",
  "upvalueid",
  "upvaluejoin",
  "sethook",
  "gethook",
  "hookfunction",
  "hooks",
  "error",
  "setmetatable",
  "getmetatable",
  "rand",
  "randomseed",
  "next",
  "ipairs",
  "hasnext",
  "loadlib",
  "searchpath",
  "oldpath",
  "newpath",
  "path",
  "rawequal",
  "rawset",
  "rawget",
  "rawnew",
  "rawlen",
  "select",
  "tonumber",
  "tostring",
  "assert",
  "collectgarbage",
  "a",
  "b",
  "c",
  "i",
  "j",
  "m",
  "buffer",
  "cache",
  "config",
  "context",
  "cursor",
  "depth",
  "element",
  "entry",
  "env",
  "event",
  "field",
  "filter",
  "flag",
  "format",
  "frame",
  "func",
  "global",
  "handle",
  "hash",
  "header",
  "heap",
  "info",
  "init",
  "input",
  "instance",
  "item",
  "label",
  "layer",
  "level",
  "limit",
  "link",
  "list",
  "local_",
  "lock",
  "map",
  "mask",
  "matrix",
  "max",
  "min",
  "mode",
  "name",
  "node",
  "offset",
  "option",
  "order",
  "output",
  "param",
  "parent",
  "parser_",
  "pattern",
  "point",
  "pool",
  "pos",
  "prefix",
  "prev",
  "priority",
  "proc",
  "proto",
  "ptr",
  "queue",
  "range",
  "rate",
  "record",
  "ref",
  "region",
  "result",
  "root",
  "row",
  "rule",
  "scope",
  "seed_",
  "segment",
  "seq",
  "session",
  "signal",
  "slot",
  "source",
  "stack",
  "state",
  "step",
  "store",
  "stream",
  "struct",
  "suffix",
  "sum",
  "tag",
  "target",
  "task",
  "temp",
  "thread",
  "timer",
  "token",
  "total",
  "tree",
  "trigger",
  "unit",
  "val",
  "var",
  "vector",
  "version",
  "weight",
  "width",
  "window",
  "worker"
];
let _confuseWords = [...CONFUSE_WORDS];
function shuffleConfuseWords() {
  for (let i = _confuseWords.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [_confuseWords[i], _confuseWords[j]] = [_confuseWords[j], _confuseWords[i]];
  }
}
function confuseName() {
  const id = _counter - 1;
  const name = [];
  let remaining = id;
  const d = remaining % _confuseWords.length;
  remaining = Math.floor(remaining / _confuseWords.length);
  name.push(_confuseWords[d]);
  while (remaining > 0) {
    const d2 = remaining % _confuseWords.length;
    remaining = Math.floor(remaining / _confuseWords.length);
    name.push(_confuseWords[d2]);
  }
  return name.join("_");
}
const UPPER = "YCQHGABRNSTPJKMWDFLXVEZ".split("");
const LOWER = "gljfacdehkmnopqrstuvwxyz".split("");
const SINGLE = "YQHAGugZJdRxmrcKMSTPpWnvefjkw".split("");
const FIELD_UPPER = "RPJUVNCSTMWKDHFLXBGAEYZ".split("");
const FIELD_LOWER = "tljgfsacdehkmnopqruvwxyz".split("");
const IDENTIFIER_START_FALLBACK = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_".split("");
const IDENTIFIER_BODY_FALLBACK = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_".split("");
function configureNames(config) {
  _charset = config.charset || DEFAULT_NAME_CONFIG.charset;
  _minLen = Math.max(1, config.minLength);
  _maxLen = Math.max(_minLen, config.maxLength);
  if (config.seed !== null && config.seed !== void 0) {
    _seed = config.seed | 0 || 1;
    _useSeeded = true;
  } else {
    _useSeeded = false;
  }
  _nameStyle = config.nameStyle || "mangled";
  _forceLuraph = false;
  _counter = 0;
  _fieldCounter = 0;
  _usedNames = /* @__PURE__ */ new Set();
  if (_nameStyle === "confuse") {
    _confuseWords = [...CONFUSE_WORDS];
    shuffleConfuseWords();
  }
}
function resetNames() {
  _counter = 0;
  _fieldCounter = 0;
  _usedNames = /* @__PURE__ */ new Set();
  if (_useSeeded && _seed === 0) _seed = 1;
  if (_nameStyle === "confuse") {
    _confuseWords = [...CONFUSE_WORDS];
    shuffleConfuseWords();
  }
}
function isExtendedCharset() {
  return _charset.length > 62;
}
function isValidLuaIdentifier(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}
function getIdentifierPools() {
  const uniqueChars = Array.from(new Set(_charset.split("")));
  const start = uniqueChars.filter((ch) => /^[A-Za-z_]$/.test(ch));
  const body = uniqueChars.filter((ch) => /^[A-Za-z0-9_]$/.test(ch));
  return {
    start: start.length > 0 ? start : IDENTIFIER_START_FALLBACK,
    body: body.length > 0 ? body : IDENTIFIER_BODY_FALLBACK
  };
}
function genIdentifierFromCharset() {
  const { start, body } = getIdentifierPools();
  for (let attempt = 0; attempt < 200; attempt++) {
    const len = _minLen + Math.floor(rng() * (_maxLen - _minLen + 1));
    let name = start[Math.floor(rng() * start.length)];
    for (let i = 1; i < Math.max(1, len); i++) {
      name += body[Math.floor(rng() * body.length)];
    }
    if (!_usedNames.has(name) && !LURAPH_RESERVED.has(name)) {
      _usedNames.add(name);
      return name;
    }
  }
  for (; ; ) {
    const base = start[_counter % start.length];
    const fallback = `${base}${(_counter++).toString(36)}`;
    if (!_usedNames.has(fallback) && !LURAPH_RESERVED.has(fallback)) {
      _usedNames.add(fallback);
      return fallback;
    }
  }
}
function shortNameCandidate() {
  _counter++;
  if (_forceLuraph) return luraphIdent();
  if (_nameStyle === "confuse") {
    return confuseName();
  }
  if (isExtendedCharset()) {
    return genIdentifierFromCharset();
  }
  const idx = _counter - 1;
  if (idx < SINGLE.length) return SINGLE[idx];
  const idx2 = idx - SINGLE.length;
  if (idx2 < UPPER.length * LOWER.length) {
    const u = UPPER[idx2 % UPPER.length];
    const l = LOWER[Math.floor(idx2 / UPPER.length) % LOWER.length];
    return idx2 % 2 === 0 ? u + l : l + u;
  }
  const idx3 = idx2 - UPPER.length * LOWER.length;
  if (idx3 < LOWER.length * UPPER.length) {
    const l = LOWER[idx3 % LOWER.length];
    const u = UPPER[Math.floor(idx3 / LOWER.length) % UPPER.length];
    return l + u;
  }
  const idx4 = idx3 - LOWER.length * UPPER.length;
  const a = UPPER[idx4 % UPPER.length];
  const b = LOWER[Math.floor(idx4 / UPPER.length) % LOWER.length];
  const c = SINGLE[Math.floor(idx4 / (UPPER.length * LOWER.length)) % SINGLE.length];
  return a + b + c;
}
function shortName() {
  for (; ; ) {
    const before = _usedNames;
    const candidate = shortNameCandidate();
    if (_forceLuraph || _nameStyle !== "confuse" && isExtendedCharset()) return candidate;
    if (!before.has(candidate) && !LURAPH_RESERVED.has(candidate)) {
      before.add(candidate);
      return candidate;
    }
  }
}
function fieldName() {
  _fieldCounter++;
  if (_nameStyle === "confuse") {
    const id = _fieldCounter - 1;
    const d = id % _confuseWords.length;
    return _confuseWords[d];
  }
  if (isExtendedCharset()) {
    return genIdentifierFromCharset();
  }
  const idx = _fieldCounter - 1;
  if (idx < FIELD_LOWER.length) return FIELD_LOWER[idx];
  const idx2 = idx - FIELD_LOWER.length;
  if (idx2 < FIELD_UPPER.length * FIELD_LOWER.length) {
    const u = FIELD_UPPER[idx2 % FIELD_UPPER.length];
    const l = FIELD_LOWER[Math.floor(idx2 / FIELD_UPPER.length) % FIELD_LOWER.length];
    return u + l;
  }
  const idx3 = idx2 - FIELD_UPPER.length * FIELD_LOWER.length;
  if (idx3 < FIELD_LOWER.length * FIELD_UPPER.length) {
    const l = FIELD_LOWER[idx3 % FIELD_LOWER.length];
    const u = FIELD_UPPER[Math.floor(idx3 / FIELD_LOWER.length) % FIELD_UPPER.length];
    return l + u;
  }
  return shortName();
}
function randomShortName() {
  return shortName();
}
function luaKey(name) {
  if (isValidLuaIdentifier(name)) {
    return { access: `.${name}`, def: `${name}=` };
  }
  const escaped = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"').split("").map((ch) => {
    const code = ch.charCodeAt(0);
    if (code > 127) return "\\" + code;
    return ch;
  }).join("");
  return { access: `["${escaped}"]`, def: `["${escaped}"]=` };
}
function withNameState(run) {
  const saved = { _seed, _useSeeded, _charset, _minLen, _maxLen, _counter, _fieldCounter, _usedNames, _nameStyle, _forceLuraph, _confuseWords };
  try {
    return run();
  } finally {
    ({ _seed, _useSeeded, _charset, _minLen, _maxLen, _counter, _fieldCounter, _usedNames, _nameStyle, _forceLuraph, _confuseWords } = saved);
  }
}
export {
  configureNames,
  fieldName,
  luaKey,
  payloadName,
  popLuraphNames,
  pushLuraphNames,
  randomShortName,
  resetNames,
  shortName,
  withNameState
};
