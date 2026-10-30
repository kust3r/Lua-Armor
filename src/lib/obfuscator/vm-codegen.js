import { emitNameDirectory } from "./name-transport";
import { packStringPermutation, emitStringPermutationDecoder } from "./string-permutation";
import { emitPrototypeMetadata } from "./prototype-metadata";
import { emitNativeIdentity } from "./native-identity";
import { removeUnusedNumericTables } from "./runtime-cleanup";
import { distributeRuntimeHelpers } from "./runtime-layout";
import { checkedTransport, emitTransportVerifier } from "./constant-integrity";
import { tokenize } from "./lexer";
import { domainRandom } from "./generation-random";
import { capturedRegisters } from "./capture-layout";
import { emitWordData } from "./word-data";
import { emitBestPositionDecoder } from "./position-codec";
import { byteStringAccumulator } from "./string-assembly";
import { byteLength } from "./generation-context";
import { replaceGlobalReferences } from "./builtin-bindings";
import { assertGenerationSession, withGenerationSession, observeGeneration } from "./generation-session";
import { compressedDataExpression } from "./data-compression";
import { emitExecutionPolicy, VM_SAMPLE_INTERVAL } from "./execution-policy";
import { shortName, resetNames, pushLuraphNames, popLuraphNames, withNameState } from "./names";
const REGISTER_FIELDS = ["boxes", "halt", "rv", "top", "va", "vac"];
let registerFields = { boxes: "_boxes", halt: "_halt", rv: "_rv", top: "_top", va: "_va", vac: "_vac" };
let _ctx = { bx: "Y", bl: "Q", br: "H", ba: "G", sc: "u", pk: "P" };
function emitMaskedAlphabet(alphabet) {
  const mask = 1 + Math.floor(domainRandom("encoding") * 16777215);
  const words = [];
  for (let i2 = 0; i2 < alphabet.length; i2 += 3) {
    const word = alphabet.charCodeAt(i2) << 16 | (alphabet.charCodeAt(i2 + 1) || 0) << 8 | (alphabet.charCodeAt(i2 + 2) || 0);
    words.push(word ^ mask);
  }
  const t = shortName(), i = shortName(), s = shortName(), w = shortName();
  const _bxor = shortName(), _char = shortName(), _floor = shortName(), _sub = shortName(), _concat = shortName();
  return `(function() local ${_bxor}=_G[${encCharKey("bit32")}][${encCharKey("bxor")}];local ${_char}=_G[${encCharKey("string")}][${encCharKey("char")}];local ${_floor}=_G[${encCharKey("math")}][${encCharKey("floor")}];local ${_sub}=_G[${encCharKey("string")}][${encCharKey("sub")}];local ${_concat}=_G[${encCharKey("table")}][${encCharKey("concat")}];local ${t}={${words.map(luauNum).join(",")}};local ${s}={};for ${i}=1,#${t} do local ${w}=${_bxor}(${t}[${i}],${luauNum(mask)});${s}[#${s}+1]=${_char}(${_floor}(${w}/65536)%256,${_floor}(${w}/256)%256,${w}%256) end;return ${_sub}(${_concat}(${s}),1,${alphabet.length}) end)()`;
}
function injectUnderscores(s) {
  if (s.length < 2) return s;
  const out = [];
  for (let i = 0; i < s.length; i++) {
    out.push(s[i]);
    if (i < s.length - 1) {
      if (Math.random() < 0.2) out.push("_");
    }
  }
  return out.join("");
}
function caseMix(s) {
  let out = "";
  for (const ch of s) {
    out += Math.random() < 0.5 ? ch.toLowerCase() : ch.toUpperCase();
  }
  return out;
}
function leadingZeros(s, max = 3) {
  const n = Math.floor(Math.random() * (max + 1));
  return "0".repeat(n) + s;
}
function luauNum(n) {
  if (!Number.isInteger(n)) return n.toString();
  if (n < 0) return `(-${luauNum(Math.abs(n))})`;
  const r = Math.random();
  if (r < 0.55) {
    return n.toString();
  }
  if (r < 0.85) {
    const hex = Math.random() < 0.5 ? caseMix(n.toString(16)) : n.toString(16);
    return (Math.random() < 0.5 ? "0x" : "0X") + hex;
  }
  const bin = n.toString(2);
  if (bin.length > 20) {
    return (Math.random() < 0.5 ? "0x" : "0X") + n.toString(16);
  }
  return (Math.random() < 0.5 ? "0b" : "0B") + bin;
}
function rawLit(n) {
  if (!Number.isInteger(n)) return n.toString();
  if (n < 0) return `(-${rawLit(-n)})`;
  const r = Math.random();
  if (r < 0.45) return n.toString();
  if (r < 0.8) {
    let hex = n.toString(16);
    if (Math.random() < 0.5) hex = leadingZeros(hex, 1);
    if (hex.length > 1 && Math.random() < 0.3) hex = injectUnderscores(hex);
    hex = caseMix(hex);
    return (Math.random() < 0.5 ? "0x" : "0X") + hex;
  }
  let bin = n.toString(2);
  if (bin.length > 16) {
    let hex = n.toString(16);
    return (Math.random() < 0.5 ? "0x" : "0X") + caseMix(hex);
  }
  if (Math.random() < 0.4) bin = leadingZeros(bin, 1);
  if (bin.length > 1 && Math.random() < 0.3) bin = injectUnderscores(bin);
  return (Math.random() < 0.5 ? "0b" : "0B") + bin;
}
function encCharKey(s) {
  const codes = [];
  for (let i = 0; i < s.length; i++) codes.push(luauNum(s.charCodeAt(i)));
  return `string.char(${codes.join(",")})`;
}
function makeBuiltinCtx(cacheReferences = false) {
  const cached = /* @__PURE__ */ new Map();
  const keyTable = shortName();
  const keys = /* @__PURE__ */ new Map();
  const key = (name) => {
    let index = keys.get(name);
    if (index === void 0) {
      index = keys.size + 1;
      keys.set(name, index);
    }
    return `${keyTable}[${index}]`;
  };
  const modules = {};
  const getModuleLocal = (mod) => {
    if (!modules[mod]) {
      modules[mod] = shortName();
    }
    return modules[mod];
  };
  const ref = (name) => {
    if (name.includes(" or ")) {
      const parts = name.split(" or ").map((p) => ref(p.trim()));
      return `(${parts.join(" or ")})`;
    }
    if (cacheReferences && cached.has(name)) return cached.get(name)?.name ?? "";
    const dot = name.indexOf(".");
    const expression = dot === -1 ? `_G[${key(name)}]` : `${getModuleLocal(name.substring(0, dot))}[${key(name.substring(dot + 1))}]`;
    if (!cacheReferences) return expression;
    const local = shortName();
    cached.set(name, { name: local, expression });
    return local;
  };
  const builtinNames = [
    "string.byte",
    "string.sub",
    "string.gsub",
    "string.rep",
    "string.find",
    "string.format",
    "string.len",
    "string.reverse",
    "math.floor",
    "math.min",
    "math.max",
    "math.abs",
    "math.huge",
    "bit32.bxor",
    "bit32.band",
    "bit32.bor",
    "bit32.lshift",
    "bit32.rshift",
    "bit32.lrotate",
    "bit32.rrotate",
    "bit32.bnot",
    "table.concat",
    "table.insert",
    "table.remove",
    "coroutine.create",
    "coroutine.resume",
    "coroutine.yield",
    "coroutine.wrap",
    "coroutine.status",
    "coroutine.running",
    "setmetatable",
    "getmetatable",
    "rawget",
    "rawset",
    "rawequal",
    "pcall",
    "xpcall",
    "tostring",
    "tonumber",
    "type",
    "pairs",
    "ipairs",
    "error"
  ].sort((a, b) => b.length - a.length);
  const hideRemaining = (code) => {
    const result = replaceGlobalReferences(code, Object.fromEntries(builtinNames.map((name) => [name, () => ref(name)])));
    return result;
  };
  return {
    get preamble() {
      const parts = [];
      for (const mod of Object.keys(modules)) key(mod);
      if (keys.size) parts.push(`local ${keyTable}={${Array.from(keys.keys(), (name) => encCharKey(name)).join(",")}};`);
      for (const [mod, local] of Object.entries(modules)) {
        const guard = mod === "bit32" ? " or {}" : "";
        parts.push(`local ${local}=_G[${key(mod)}]${guard};`);
      }
      for (const entry of cached.values()) parts.push(`local ${entry.name}=${entry.expression};`);
      return parts.join("");
    },
    ref,
    hideRemaining
  };
}
function hideBuiltinNames(code) {
  const names = [
    "string.byte",
    "string.sub",
    "string.gsub",
    "string.rep",
    "string.find",
    "string.format",
    "string.len",
    "string.reverse",
    "math.floor",
    "math.min",
    "math.max",
    "math.abs",
    "math.huge",
    "bit32.bxor",
    "bit32.band",
    "bit32.bor",
    "bit32.lshift",
    "bit32.rshift",
    "bit32.lrotate",
    "bit32.rrotate",
    "bit32.bnot",
    "table.concat",
    "table.insert",
    "table.remove",
    "coroutine.create",
    "coroutine.resume",
    "coroutine.yield",
    "coroutine.wrap",
    "coroutine.status",
    "coroutine.running",
    "setmetatable",
    "getmetatable",
    "rawget",
    "rawset",
    "rawequal",
    "pcall",
    "xpcall",
    "tostring",
    "tonumber",
    "type",
    "pairs",
    "ipairs",
    "error"
  ].sort((a, b) => b.length - a.length);
  const tokens = tokenize(code);
  const occupied = new Set(tokens.filter((t) => t.type === "ident").map((t) => t.value));
  const fresh = () => {
    let name = shortName();
    while (occupied.has(name)) name = shortName();
    occupied.add(name);
    return name;
  };
  const keyTable = fresh();
  const charRef = fresh();
  const scriptEnv = fresh();
  const keys = /* @__PURE__ */ new Map();
  const key = (name) => {
    let index = keys.get(name);
    if (index === void 0) {
      index = keys.size + 1;
      keys.set(name, index);
    }
    return `${keyTable}[${index}]`;
  };
  const replacements = Object.fromEntries(names.map((name) => [name, () => {
    const dot = name.indexOf(".");
    return dot === -1 ? `${scriptEnv}[${key(name)}]` : `${scriptEnv}[${key(name.substring(0, dot))}][${key(name.substring(dot + 1))}]`;
  }]));
  replacements["string.char"] = charRef;
  replacements._G = scriptEnv;
  const result = replaceGlobalReferences(code, replacements, { tokens });
  const directory = emitNameDirectory(Array.from(keys.keys()), keyTable, charRef);
  return `local ${scriptEnv}=(getfenv and getfenv(1)) or _ENV or _G;local ${charRef}=string.char;${directory}${result}`;
}
function buildLuaStringFromBytes(bytes) {
  if (bytes.length === 0) return '""';
  const quote = Math.random() < 0.5 ? '"' : "'";
  const qCode = quote.charCodeAt(0);
  const isSafeLiteral = (c) => {
    if (c < 32 || c > 126) return false;
    if (c === 92) return false;
    if (c === qCode) return false;
    return true;
  };
  const isDigit = (c) => c >= 48 && c <= 57;
  const encodeByte = (c, _nextIsDigit) => {
    return "\\" + c.toString(10).padStart(3, "0");
  };
  let out = quote;
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    const nextC = i + 1 < bytes.length ? bytes[i + 1] : -1;
    if (isSafeLiteral(c) && Math.random() < 0.55) {
      out += String.fromCharCode(c);
    } else {
      out += encodeByte(c, nextC >= 0 && isDigit(nextC));
    }
  }
  out += quote;
  return out;
}
function luraphStr(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 255);
  return buildLuaStringFromBytes(bytes);
}
function obfNumSafe(n, depth = 2) {
  if (!Number.isInteger(n)) {
    if (depth <= 0) return n.toString();
    const a2 = Math.floor(Math.random() * 50) + 1;
    return `(${obfNumSafe(n + a2, depth - 1)}-${a2})`;
  }
  if (depth <= 0) {
    if (n < 0) return `(${n})`;
    return luauNum(n);
  }
  const r = Math.random();
  if (r < 0.2) {
    const a2 = Math.floor(Math.random() * 500) + 1;
    return `(${obfNumSafe(n + a2, depth - 1)}-${obfNumSafe(a2, 0)})`;
  }
  if (r < 0.35) {
    const a2 = Math.floor(Math.random() * 500) + 1;
    return `(${obfNumSafe(n - a2, depth - 1)}+${obfNumSafe(a2, 0)})`;
  }
  if (r < 0.47 && n !== 0) {
    for (const d of [2, 3, 5, 7, 11, 13]) {
      if (n % d === 0) return `(${obfNumSafe(n / d, depth - 1)}*${obfNumSafe(d, 0)})`;
    }
  }
  if (r < 0.6 && n > 10) {
    const a2 = Math.floor(Math.random() * 200) + 1;
    const b = Math.floor(Math.random() * 200) + 1;
    return `(${obfNumSafe(n + a2 + b, depth - 1)}-${obfNumSafe(a2, 0)}-${obfNumSafe(b, 0)})`;
  }
  if (r < 0.75) {
    const a2 = Math.floor(Math.random() * 300) + 1;
    return `(${obfNumSafe(n + a2, depth - 1)}-${obfNumSafe(a2, depth - 1)})`;
  }
  if (r < 0.88) {
    const a2 = Math.floor(Math.random() * 200) + 1;
    const b = Math.floor(Math.random() * 200) + 1;
    return `(${obfNumSafe(n + a2 - b, depth - 1)}+${obfNumSafe(b, 0)}-${obfNumSafe(a2, 0)})`;
  }
  const a = Math.floor(Math.random() * 400) + 1;
  return `(${obfNumSafe(n + a, depth - 1)}-${obfNumSafe(a, depth > 1 ? depth - 2 : 0)})`;
}
function obfNumVisual(n, depth = 2) {
  if (!Number.isInteger(n)) {
    if (depth <= 0) return n.toString();
    const a = Math.floor(Math.random() * 50) + 1;
    return `(${obfNumVisual(n + a, depth - 1)}-${a})`;
  }
  n = n | 0;
  if (depth <= 0) {
    if (n < 0) return "(" + n.toString() + ")";
    return luauNum(n);
  }
  if (n < 0) {
    const a = Math.floor(Math.random() * 500) + 1;
    return Math.random() < 0.5 ? `(${obfNumVisual(n + a, depth - 1)}-${obfNumVisual(a, depth - 1)})` : `(${obfNumVisual(n - a, depth - 1)}+${obfNumVisual(a, depth - 1)})`;
  }
  const r = Math.random();
  if (r < 0.2) {
    const k = Math.floor(Math.random() * 30) + 1;
    const rotated = (n >>> k | n << 32 - k) >>> 0;
    return `${_ctx.bl}(${obfNumVisual(rotated, depth - 1)},${obfNumVisual(k, depth - 1)})`;
  }
  if (r < 0.4) {
    const k = Math.floor(Math.random() * 200) + 1;
    return `${_ctx.bx}(${obfNumVisual((n ^ k) >>> 0, depth - 1)},${obfNumVisual(k, depth - 1)})`;
  }
  if (r < 0.55) {
    const k = Math.floor(Math.random() * 31) + 1;
    const rotated = (n << k | n >>> 32 - k) >>> 0;
    return `${_ctx.br}(${obfNumVisual(rotated, depth - 1)},${obfNumVisual(k, depth - 1)})`;
  }
  if (r < 0.7) {
    const a = Math.floor(Math.random() * 500) + 1;
    return `(${obfNumVisual(n + a, depth - 1)}-${obfNumVisual(a, depth - 1)})`;
  }
  if (r < 0.85) {
    return `${_ctx.ba}(${obfNumVisual(n, depth - 1)},(-1))`;
  }
  return `${_ctx.bx}(${_ctx.ba}(${obfNumVisual(n, depth - 1)},(-1)),${obfNumVisual(0, 0)})`;
}
function strToUtf8Bytes(s) {
  return Array.from(s, (c) => c.charCodeAt(0));
}
let _obfStrLevel = 2;
function obfStr(s, seed) {
  if (s.length === 0) return "''";
  const bytes = strToUtf8Bytes(s);
  if (_obfStrLevel >= 3) {
    return obfStrMultiLayer(bytes, seed);
  }
  const parts = [];
  for (let i = 0; i < bytes.length; i++) {
    const k = (seed + i * 7 + 3) % 256;
    parts.push(obfNumSafe((bytes[i] ^ k) >>> 0, 1));
  }
  const kv = shortName(), iv = shortName(), rv = shortName(), tv = shortName();
  return `(function()local ${kv}=${seed};local ${tv}={${parts.join(",")}};local ${rv}='';for ${iv}=1,${bytes.length} do ${rv}=${rv}..${_ctx.sc}(${_ctx.bx}(${tv}[${iv}],(${kv}+(${iv}-1)*7+3)%256)%256) end;return ${rv} end)()`;
}
function obfStrMultiLayer(bytes, seed) {
  const xored = [];
  for (let i = 0; i < bytes.length; i++) {
    const k = (seed + i * 7 + 3) % 256;
    xored.push((bytes[i] ^ k) >>> 0);
  }
  const perm = [];
  for (let i = 0; i < xored.length; i++) perm.push(i);
  let rng = seed;
  for (let i = perm.length - 1; i > 0; i--) {
    rng = rng * 1103515245 + 12345 & 2147483647;
    const j = rng % (i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const shuffled = new Array(xored.length);
  for (let i = 0; i < xored.length; i++) {
    shuffled[perm[i]] = xored[i];
  }
  const seed2 = seed * 31 + 17 & 65535;
  const doubleXored = shuffled.map((v, i) => (v ^ (seed2 + i * 13 + 5) % 256) >>> 0);
  const parts = doubleXored.map((v) => obfNumSafe(v, 1));
  const tv = shortName(), kv = shortName(), iv = shortName(), rv = shortName();
  const pv = shortName(), jv = shortName(), sv2 = shortName();
  const invPerm = new Array(perm.length);
  for (let i = 0; i < perm.length; i++) invPerm[perm[i]] = i;
  const permParts = invPerm.map((v) => obfNumSafe(v, 0));
  return `(function()local ${kv}=${seed};local ${sv2}=${seed2};local ${tv}={${parts.join(",")}};local ${pv}={${permParts.join(",")}};local _u={};for ${jv}=1,${bytes.length} do _u[${pv}[${jv}]+1]=${_ctx.bx}(${tv}[${jv}],(${sv2}+(${jv}-1)*13+5)%256) end;local ${rv}='';for ${iv}=1,${bytes.length} do ${rv}=${rv}..${_ctx.sc}(${_ctx.bx}(_u[${iv}],(${kv}+(${iv}-1)*7+3)%256)%256) end;return ${rv} end)()`;
}
function safeStr(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 255);
  return buildLuaStringFromBytes(bytes);
}
function strToOctalEscaped(s) {
  const bytes = strToUtf8Bytes(s);
  if (bytes.length === 0) return '""';
  const key = Math.floor(Math.random() * 200) + 10;
  const parts = [];
  for (let i = 0; i < bytes.length; i++) {
    const encrypted = (bytes[i] ^ key + i * 3 + 7 & 255) & 255;
    parts.push("\\" + encrypted.toString(10).padStart(3, "0"));
  }
  return { encoded: '"' + parts.join("") + '"', key };
}
function encodeStringAsOctal(s, alphabet, bcKey = 0) {
  const bytes = strToUtf8Bytes(s);
  const key = Math.floor(Math.random() * 200) + 10;
  const encrypted = [];
  for (let i = 0; i < bytes.length; i++) {
    let b = (bytes[i] ^ key + i * 3 + 7 & 255) & 255;
    b = (b ^ bcKey + i * 11 + 13 & 255) & 255;
    encrypted.push(b);
  }
  let encoded = "";
  for (let i = 0; i < encrypted.length; i += 4) {
    let word = (encrypted[i] ?? 0) * 16777216 + (encrypted[i + 1] ?? 0) * 65536 + (encrypted[i + 2] ?? 0) * 256 + (encrypted[i + 3] ?? 0) >>> 0;
    const block = new Array(5);
    for (let d = 4; d >= 0; d--) {
      block[d] = alphabet[word % 85];
      word = Math.floor(word / 85);
    }
    encoded += block.join("");
  }
  return { encoded: JSON.stringify(encoded), key, length: encrypted.length, original: s };
}
function genOctalStringTable(strings, tableVar, bxVar, scVar, gcFixes = false, mathFloorRef = "math.floor", stringByteRef = "string.byte", bcKey = 0) {
  if (strings.length === 0) {
    return { preamble: "", getterFunc: "", getterVar: "" };
  }
  const permAlphabet = shuffleAlphabet("!#$%&()*+,-./0369258147:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^abcdefghijklmnopqrstuvwxyz");
  const entries = strings.map((s) => encodeStringAsOctal(s, permAlphabet, bcKey));
  const indices = [];
  for (let i = 0; i < entries.length; i++) indices.push(i);
  const shuffled = [...indices];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(domainRandom("encoding") * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const shuffledEntries = [];
  for (const idx of shuffled) {
    shuffledEntries.push(entries[idx].encoded);
  }
  const invPerm = new Array(shuffled.length);
  for (let i = 0; i < shuffled.length; i++) invPerm[shuffled[i]] = i;
  const lines = [];
  const separator = "~";
  const joined = shuffledEntries.map((entry) => separator + entry.slice(1, -1)).join("");
  const joinedChunks = [];
  for (let offset = 0; offset < joined.length; offset += 512) joinedChunks.push(JSON.stringify(joined.slice(offset, offset + 512)));
  const joinedVar = shortName();
  const partVar = shortName();
  lines.push(`local ${joinedVar}=${checkedTransport(`table.concat({${joinedChunks.join(",")}})`, joined)};local ${tableVar}={};for ${partVar} in string.gmatch(${joinedVar}.."~","~([^~]*)") do ${tableVar}[#${tableVar}+1]=${partVar} end;`);
  const permVar = shortName();
  const tmpVar = shortName();
  const iVar = shortName();
  const { data: packedPerm } = packStringPermutation(invPerm.map((value) => value + 1), permAlphabet);
  const packedVar = shortName(), alphabetVar = shortName(), lutVar = shortName(), digitVar = shortName();
  lines.push(`local ${alphabetVar}=${checkedTransport(emitMaskedAlphabet(permAlphabet), permAlphabet)};local ${lutVar}={};for ${iVar}=1,#${alphabetVar} do ${lutVar}[string.byte(${alphabetVar},${iVar})]=${iVar}-1 end;`);
  const packedChunks = [];
  for (let offset = 0; offset < packedPerm.length; offset += 512) packedChunks.push(JSON.stringify(packedPerm.slice(offset, offset + 512)));
  lines.push(`local ${packedVar}=${checkedTransport(`table.concat({${packedChunks.join(",")}})`, packedPerm)};` + emitStringPermutationDecoder(entries.length, { packed: packedVar, table: tableVar, permutation: permVar, cursor: iVar, digit: digitVar, lut: lutVar }));
  lines.push(`local ${tmpVar}={};for ${iVar}=1,#${tableVar} do ${tmpVar}[${iVar}]=${tableVar}[${permVar}[${iVar}]] end;`);
  lines.push(`for ${iVar}=1,#${tmpVar} do ${tableVar}[${iVar}]=${tmpVar}[${iVar}] end;`);
  const getterVar = shortName();
  const decryptBodies = [];
  const keyAlphabet = permAlphabet;
  let packedKeys = "";
  for (const e of entries) {
    const len = e.length;
    packedKeys += len < 84 ? keyAlphabet[len + 1] : keyAlphabet[0] + keyAlphabet[Math.floor(len / 7225)] + keyAlphabet[Math.floor(len / 85) % 85] + keyAlphabet[len % 85];
    packedKeys += keyAlphabet[Math.floor(e.key / 85)] + keyAlphabet[e.key % 85];
  }
  const keyChunks = [];
  for (let offset = 0; offset < packedKeys.length; offset += 512) keyChunks.push(JSON.stringify(packedKeys.slice(offset, offset + 512)));
  const keyTableVar = shortName();
  const keysVar = shortName(), keyCursor = shortName(), keyDigit = shortName();
  lines.push(`local ${keysVar}=${checkedTransport(`table.concat({${keyChunks.join(",")}})`, packedKeys)};local ${keyTableVar}={};local ${keyCursor}=1;while ${keyCursor}<=#${keysVar} do local ${keyDigit}=${lutVar}[${stringByteRef}(${keysVar},${keyCursor})];local _len;if ${keyDigit}==0 then _len=${lutVar}[${stringByteRef}(${keysVar},${keyCursor}+1)]*7225+${lutVar}[${stringByteRef}(${keysVar},${keyCursor}+2)]*85+${lutVar}[${stringByteRef}(${keysVar},${keyCursor}+3)];${keyCursor}=${keyCursor}+4 else _len=${keyDigit}-1;${keyCursor}=${keyCursor}+1 end;local _key=${lutVar}[${stringByteRef}(${keysVar},${keyCursor})]*85+${lutVar}[${stringByteRef}(${keysVar},${keyCursor}+1)];${keyCursor}=${keyCursor}+2;${keyTableVar}[#${keyTableVar}+1]=_len*256+_key end;`);
  const idxParam = shortName();
  const decryptedCache = shortName();
  lines.push(`local ${decryptedCache}={};`);
  const assembly = byteStringAccumulator("_r");
  const decFuncBody = [
    `local ${getterVar}=function(${idxParam})`,
    `if ${decryptedCache}[${idxParam}] then return ${decryptedCache}[${idxParam}] end;`,
    `local _e=${tableVar}[${idxParam}];`,
    `local _meta=${keyTableVar}[${idxParam}];local _k=_meta%256;local _len=${mathFloorRef}(_meta/256);`,
    assembly.setup,
    `local _lut=${lutVar};`,
    `local _bck=${obfNumSafe(bcKey, 1)};local _pos=0;for _i=1,#_e,5 do local _v=0;for _j=0,4 do _v=_v*85+_lut[${stringByteRef}(_e,_i+_j)] end;`,
    `for _j=3,0,-1 do _pos=_pos+1;if _pos<=_len then local _byte=${mathFloorRef}(_v/256^_j)%256;_byte=${bxVar}(_byte,(_bck+(_pos-1)*11+13)%256)%256;${assembly.append(`${scVar}(${bxVar}(_byte,(_k+(_pos-1)*3+7)%256)%256)`)} end end end;`,
    assembly.finish,
    `${decryptedCache}[${idxParam}]=_r;`,
    ...gcFixes ? [`${tableVar}[${idxParam}]=nil;${keyTableVar}[${idxParam}]=nil;`] : [],
    `return _r end;`
  ].join("");
  lines.push(decFuncBody);
  return { preamble: lines.join(""), getterFunc: decFuncBody, getterVar };
}
function genNumericPad(count = 20) {
  const nums = [];
  const n = 2 + Math.floor(Math.random() * Math.min(8, Math.max(2, count)));
  for (let i = 0; i < n; i++) {
    nums.push(obfNumSafe(Math.floor(Math.random() * 65535), 1));
  }
  return `{${nums.join(",")}}`;
}
function genLuraphPadding(targetLen = 50) {
  return genNumericPad(Math.max(5, Math.floor(targetLen / 3)));
}
function randomBinaryBlob(minLen = 5, maxLen = 30) {
  const len = minLen + Math.floor(Math.random() * (maxLen - minLen));
  return genNumericPad(len);
}
function genInlineLongStringPad(minLen = 200, maxLen = 800) {
  const len = Math.max(5, Math.floor((minLen + Math.floor(Math.random() * (maxLen - minLen))) / 10));
  const v = shortName();
  return `do local ${v}=${genNumericPad(len)};end;`;
}
function genScatteredPad(minLen = 10, maxLen = 40) {
  const v = shortName();
  const len = minLen + Math.floor(Math.random() * (maxLen - minLen));
  return `do local ${v}=${genNumericPad(len)};end;`;
}
function genDeepNestedFunc(tblRef, ctVar, ctSize) {
  const params = [shortName(), shortName(), shortName()].join(",");
  const body = genDeepNesting(tblRef, ctVar, ctSize, 0, 3 + Math.floor(Math.random() * 3));
  return `function(${params})${body}end`;
}
function genDeepNesting(tblRef, ctVar, ctSize, depth, maxDepth) {
  if (depth >= maxDepth) {
    const t = Math.floor(Math.random() * 3);
    switch (t) {
      case 0:
        return `local ${shortName()}=${luauNum(Math.floor(Math.random() * 999))};`;
      case 1:
        return `${genTableIndexChain(tblRef)};`;
      default:
        return `local ${shortName()}=${genBit32Chain(tblRef, 1)};`;
    }
  }
  const chunks = [];
  const numChunks = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numChunks; i++) {
    const t = Math.floor(Math.random() * 12);
    const inner = genDeepNesting(tblRef, ctVar, ctSize, depth + 1, maxDepth);
    const inner2 = genDeepNesting(tblRef, ctVar, ctSize, depth + 1, maxDepth);
    const v = shortName();
    const idx1 = Math.floor(Math.random() * ctSize);
    const idx2 = Math.floor(Math.random() * ctSize);
    switch (t) {
      case 0:
        chunks.push(`repeat ${inner}until true;`);
        break;
      case 1:
        chunks.push(`repeat ${inner}until true;`);
        break;
      case 2:
        chunks.push(`if ${ctVar}[${luauNum(idx1)}]~=${ctVar}[${luauNum(idx2)}] then ${inner}else ${inner2}end;`);
        break;
      case 3:
        {
          const stateVal = Math.floor(Math.random() * 200) + 50;
          chunks.push(`local ${v}=${luauNum(stateVal)};while true do if ${v}==${luauNum(stateVal)} then ${inner}break;else ${inner2}end end;`);
        }
        break;
      case 4:
        chunks.push(`${genBit32Chain(tblRef, 2 + Math.floor(Math.random() * 3))};`);
        break;
      case 5:
        {
          const limit = Math.floor(Math.random() * 5) + 1;
          chunks.push(`for ${v}=${luauNum(Math.floor(Math.random() * 100))},${luauNum(limit)},${luauNum(1)} do ${inner}end;`);
        }
        break;
      case 6:
        chunks.push(`if not(${ctVar}[${luauNum(idx1)}]<${ctVar}[${luauNum(idx1)}]+${luauNum(1)}) then ${inner}end;`);
        break;
      case 7:
        {
          const s1 = Math.floor(Math.random() * 200) + 10;
          const s2 = s1 + Math.floor(Math.random() * 50) + 5;
          chunks.push(`local ${v}=${luauNum(s1)};while true do if ${v}==${luauNum(s1)} then ${v}=${luauNum(s2)};${inner}elseif ${v}~=${luauNum(s2)} then ${inner2}else break;end end;`);
        }
        break;
      case 8:
        chunks.push(`local ${v}=${genBit32Chain(tblRef, 3)};`);
        break;
      case 9:
        {
          const opcVal = Math.floor(Math.random() * 255);
          chunks.push(`if ${ctVar}[${luauNum(idx1)}]==${luauNum(opcVal)} then ${inner}else ${inner2}end;`);
        }
        break;
      case 10:
        chunks.push(`if ${ctVar}[${luauNum(idx1)}]==${ctVar}[${luauNum(idx2)}] then return;end;`);
        break;
      case 11:
        chunks.push(`local ${v}=${genBit32Chain(tblRef, 2)}+${genTableIndexExpr(tblRef)};`);
        break;
    }
  }
  return chunks.join("");
}
function genTableIndexExpr(tblRef) {
  const indices = [
    luauNum(Math.floor(Math.random() * 55) + 1),
    luauNum(Math.floor(Math.random() * 25) + 1)
  ];
  const t = Math.floor(Math.random() * 4);
  switch (t) {
    case 0:
      return `${tblRef}[${indices[0]}][${indices[1]}]`;
    case 1:
      return `${tblRef}[${luauNum(17)}][${indices[1]}]`;
    case 2:
      return `${tblRef}[${luauNum(17)}][${indices[0]}]`;
    default:
      return `${tblRef}[${indices[0]}]`;
  }
}
function genTableIndexChain(tblRef) {
  return `${tblRef}[${luauNum(Math.floor(Math.random() * 50))}]=${luauNum(Math.floor(Math.random() * 9999))}`;
}
function genBit32Chain(tblRef, depth) {
  if (depth <= 0) {
    const t = Math.random();
    if (t < 0.5) return luauNum(Math.floor(Math.random() * 999));
    return `${tblRef}[${luauNum(Math.floor(Math.random() * 50))}]`;
  }
  const funcIdx = [5, 6, 7, 9, 11, 13, 15, 19, 20, 21, 22][Math.floor(Math.random() * 11)];
  const tblIdx = Math.random() < 0.5 ? luauNum(17) : luauNum(17);
  const arg1 = genBit32Chain(tblRef, depth - 1);
  const hasSecondArg = Math.random() < 0.6;
  if (hasSecondArg) {
    const arg2 = genBit32Chain(tblRef, Math.max(0, depth - 2));
    return `${tblRef}[${tblIdx}][${luauNum(funcIdx)}](${arg1},${arg2})`;
  }
  return `${tblRef}[${tblIdx}][${luauNum(funcIdx)}](${arg1})`;
}
function binaryBlobDeadCode() {
  const chunks = [];
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const v = shortName();
    const t = Math.floor(Math.random() * 4);
    switch (t) {
      case 0:
        chunks.push(`local ${v}=${randomBinaryBlob(5, 30)}`);
        break;
      case 1: {
        const v2 = shortName();
        chunks.push(`local ${v}=${randomBinaryBlob(5, 20)};local ${v2}=#${v}`);
        break;
      }
      case 2: {
        chunks.push(`local ${v}={${randomBinaryBlob(3, 10)},${randomBinaryBlob(3, 10)}}`);
        break;
      }
      case 3: {
        const v2 = shortName();
        chunks.push(`local ${v}=${randomBinaryBlob(8, 25)};local ${v2}=${v}[${Math.floor(Math.random() * 5) + 1}]`);
        break;
      }
    }
  }
  return chunks.join(";") + ";";
}
const BASE86_MASTER = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()-_+=[]{}|;:,.<>?/~";
const BASE = BASE86_MASTER.length;
function shuffleAlphabet(master) {
  const arr = master.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(domainRandom("encoding") * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}
function shuffleCharset() {
  return shuffleAlphabet(BASE86_MASTER);
}
let _curCharset = BASE86_MASTER;
let _curValueXor = 0;
const POS_XOR_MULT = 2654435761;
function _posKey(baseXor, i) {
  const m = Math.imul(i, POS_XOR_MULT) >>> 0;
  return (baseXor ^ m) >>> 0;
}
function encodeToBinaryString(values, _xorKey) {
  _curCharset = shuffleCharset();
  _curValueXor = Math.floor(domainRandom("encoding") * 4294967294) + 1 >>> 0;
  const parts = [];
  for (let idx = 0; idx < values.length; idx++) {
    const v = values[idx] >>> 0;
    const k = _posKey(_curValueXor, idx);
    const small = v < BASE * (BASE - 1);
    let n = small ? (v + k) % (BASE * (BASE - 1)) : v + k >>> 0;
    const chars = [];
    if (small) {
      chars.push(_curCharset[n % (BASE - 1)]);
      n = Math.floor(n / (BASE - 1));
      chars.push(_curCharset[n]);
    } else {
      chars.push(_curCharset[BASE - 1]);
      for (let i = 0; i < 5; i++) {
        chars.push(_curCharset[n % BASE]);
        n = Math.floor(n / BASE);
      }
    }
    parts.push(chars.join(""));
  }
  return '"' + parts.join("") + '"';
}
function toLongBracket(inner) {
  for (let eq = 1; eq <= 8; eq++) {
    const closer = "]" + "=".repeat(eq) + "]";
    if ((inner + closer).indexOf(closer) === inner.length) {
      return "[" + "=".repeat(eq) + "[" + inner + "]" + "=".repeat(eq) + "]";
    }
  }
  return null;
}
function splitStringLiteral(lit) {
  if (lit.length < 4 || lit[0] !== '"' || lit[lit.length - 1] !== '"') return lit;
  const inner = lit.slice(1, -1);
  if (inner.length < 40) return lit;
  if (inner.length > 2048 || Math.random() < 0.55) {
    const MAX_LB = 512;
    if (inner.length <= MAX_LB) {
      const lb = toLongBracket(inner);
      if (lb) return lb;
    } else {
      const pieces2 = [];
      for (let i = 0; i < inner.length; i += MAX_LB) {
        const piece = inner.slice(i, i + MAX_LB);
        const lb = toLongBracket(piece);
        if (!lb) {
          pieces2.length = 0;
          break;
        }
        pieces2.push(lb);
      }
      if (pieces2.length) return "table.concat({" + pieces2.join(",") + "})";
    }
  }
  const chunkCount = 2 + Math.floor(Math.random() * 4);
  const min = Math.max(8, Math.floor(inner.length / (chunkCount * 3)));
  const cuts = [];
  let last = 0;
  for (let i = 0; i < chunkCount - 1; i++) {
    const remaining = chunkCount - 1 - i;
    const maxCut = inner.length - remaining * min;
    if (last + min >= maxCut) break;
    const cut = last + min + Math.floor(Math.random() * (maxCut - last - min));
    cuts.push(cut);
    last = cut;
  }
  const pieces = [];
  let prev = 0;
  for (const c of cuts) {
    pieces.push('"' + inner.slice(prev, c) + '"');
    prev = c;
  }
  pieces.push('"' + inner.slice(prev) + '"');
  const shape = Math.floor(Math.random() * 4);
  if (shape === 0 || pieces.length < 3) {
    return pieces.join("..");
  }
  if (shape === 1) {
    return "table.concat({" + pieces.join(",") + "})";
  }
  if (shape === 2) {
    return "(function() return " + pieces.join("..") + " end)()";
  }
  const mid = Math.max(1, Math.floor(pieces.length / 2));
  const left = pieces.slice(0, mid).join("..");
  const right = "table.concat({" + pieces.slice(mid).join(",") + "})";
  return left + ".." + right;
}
function deadCode(complexity = 1) {
  const chunks = [];
  const count = 2 + Math.floor(Math.random() * 2) + Math.min(complexity, 1);
  for (let i = 0; i < count; i++) {
    const v1 = shortName(), v2 = shortName(), v3 = shortName();
    const t = Math.floor(Math.random() * 20);
    switch (t) {
      case 0:
        chunks.push(`local ${v1}=${obfNumSafe(Math.floor(Math.random() * 999), Math.min(complexity + 1, 3))}`);
        break;
      case 1:
        chunks.push(`local ${v1}=function(${v2})return ${v2} end`);
        break;
      case 2:
        chunks.push(`local ${v1}={${obfNumSafe(Math.floor(Math.random() * 100), 1)},${obfNumSafe(Math.floor(Math.random() * 100), 1)},${obfNumSafe(Math.floor(Math.random() * 50), 1)}}`);
        break;
      case 3:
        chunks.push(`local ${v1}=(function(${v2})return ${v2}+${obfNumSafe(Math.floor(Math.random() * 30), 1)} end)(${obfNumSafe(Math.floor(Math.random() * 200), 1)})`);
        break;
      case 4: {
        chunks.push(`local ${v1}=${obfNumSafe(0, 1)};for ${v3}=1,${obfNumSafe(Math.floor(Math.random() * 5) + 2, 1)} do ${v1}=${v1}+${v3} end`);
        break;
      }
      case 5:
        chunks.push(`local ${v1};do local ${v2}=${obfNumSafe(Math.floor(Math.random() * 500), 2)};${v1}=${v2} end`);
        break;
      case 6:
        chunks.push(`local ${v1}=${_ctx.bx}(${obfNumSafe(Math.floor(Math.random() * 1e3), 1)},${obfNumSafe(Math.floor(Math.random() * 1e3), 1)})`);
        break;
      case 7: {
        chunks.push(`do local ${v1}=${obfNumSafe(Math.floor(Math.random() * 999), 2)};local ${v2}=${obfNumSafe(Math.floor(Math.random() * 999), 2)};do local ${v3}=${v1}+${v2};if ${v3}>${obfNumSafe(99999, 1)} then ${v1}=${v3} end end end`);
        break;
      }
      case 8: {
        const sv = Math.floor(Math.random() * 50) + 10;
        chunks.push(`local ${v1}=${obfNumSafe(sv, 2)};repeat ${v1}=${v1}-1 until ${v1}<${obfNumSafe(sv - 1, 1)}`);
        break;
      }
      case 9: {
        const fakeKey = "_" + Math.random().toString(36).slice(2, 5);
        chunks.push(`local ${v1}={[${obfStr(fakeKey, Math.floor(Math.random() * 200))}]=${obfNumSafe(Math.floor(Math.random() * 500), 2)}}`);
        break;
      }
      case 10: {
        chunks.push(`local ${v1}=${obfNumSafe(Math.floor(Math.random() * 100), 1)};local ${v2}=function() return ${v1}+${obfNumSafe(Math.floor(Math.random() * 50), 1)} end`);
        break;
      }
      case 11: {
        chunks.push(`local ${v1}=false;while ${v1} do ${v1}=not ${v1} end`);
        break;
      }
      case 12: {
        chunks.push(`local ${v1}=(function(${v2},${v3}) return (function() return ${v2}+${v3} end)() end)(${obfNumSafe(Math.floor(Math.random() * 100), 1)},${obfNumSafe(Math.floor(Math.random() * 100), 1)})`);
        break;
      }
      case 13: {
        const s1 = Math.floor(Math.random() * 200) + 100;
        const s2 = s1 + Math.floor(Math.random() * 100) + 50;
        chunks.push(`local ${v1}=${obfNumSafe(s1, 2)};local ${v2}=${obfNumSafe(s2, 2)};if ${v1}>${v2} then ${v1}=${v2} elseif ${v2}>${obfNumSafe(s2 + 999, 1)} then ${v2}=${v1} end`);
        break;
      }
      case 14: {
        const val = Math.floor(Math.random() * 999) + 1;
        chunks.push(`local ${v1};pcall(function() ${v1}=${obfNumSafe(val, 2)} end)`);
        break;
      }
      case 15: {
        const val = Math.floor(Math.random() * 500) + 1;
        chunks.push(`local ${v1}=(function(_x) return _x end)(${obfNumSafe(val, 2)})`);
        break;
      }
      case 16: {
        const val = Math.floor(Math.random() * 100) + 1;
        const delta = Math.floor(Math.random() * 50) + 1;
        chunks.push(`local ${v1}=${obfNumSafe(val, 1)};${v1}=${v1}+${obfNumSafe(delta, 1)};${v1}=${v1}-${obfNumSafe(delta, 1)}`);
        break;
      }
      case 17: {
        const idx = Math.floor(Math.random() * 3) + 1;
        const vals = Array.from({ length: 4 }, () => obfNumSafe(Math.floor(Math.random() * 200), 1));
        chunks.push(`local ${v1}=select(${idx},${vals.join(",")})`);
        break;
      }
      // Additional syntactic patterns inspired by Prometheus ASTConstantFolder/Propagator
      case 18: {
        const val = Math.floor(Math.random() * 999) + 1;
        chunks.push(`local ${v1}=setmetatable({},{__index=function() return ${obfNumSafe(val, 2)} end});local ${v2}=${v1}[${obfNumSafe(Math.floor(Math.random() * 100), 1)}]`);
        break;
      }
      case 19: {
        const b1 = Math.floor(Math.random() * 94) + 33;
        const b2 = Math.floor(Math.random() * 94) + 33;
        chunks.push(`local ${v1}=string.byte(${JSON.stringify(String.fromCharCode(b1))})+string.byte(${JSON.stringify(String.fromCharCode(b2))})`);
        break;
      }
    }
  }
  for (let i = chunks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chunks[i], chunks[j]] = [chunks[j], chunks[i]];
  }
  return chunks.join(";") + ";";
}
function injectDeadInstructions(proto, opcodes) {
  const noiseBase = Math.min(proto.maxReg + 1, 180);
  for (const sub of proto.protos) {
    injectDeadInstructions(sub, opcodes);
  }
}
function cipherKey(seed, index0) {
  return (seed + index0 * 3 & 255) >>> 0;
}
function encryptValue(value, seed, index0) {
  return (value >>> 0 ^ cipherKey(seed, index0)) >>> 0;
}
function encodeOpcode(rawOpcode, xorKey) {
  return ((rawOpcode ^ xorKey) & 255) >>> 0;
}
function __vmCipherKey(seed, index0) {
  return cipherKey(seed, index0);
}
function __vmXorInstructionValue(value, seed, index0) {
  return encryptValue(value, seed, index0);
}
function __vmEncodeOpcode(rawOpcode, xorKey) {
  return encodeOpcode(rawOpcode, xorKey);
}
function validateInstructionLayout(proto, validOpcodes, path = "root") {
  proto.instructions.forEach((instr, index) => {
    if (!Array.isArray(instr) || instr.length !== 4) {
      throw new Error(`Invalid instruction at ${path}[${index}]: expected [opcode,a,b,c]`);
    }
    for (let slot = 0; slot < 4; slot++) {
      if (!Number.isInteger(instr[slot])) {
        throw new Error(`Invalid slot at ${path}[${index}][${slot}]: ${String(instr[slot])}`);
      }
    }
    if (!validOpcodes.has(instr[0])) {
      throw new Error(`Opcode without handler at ${path}[${index}]: ${instr[0]}`);
    }
  });
  proto.protos.forEach((sub, index) => {
    validateInstructionLayout(sub, validOpcodes, `${path}.protos[${index}]`);
  });
}
function __vmFlattenProto(proto) {
  const out = [];
  encodeProto(proto, out);
  return out;
}
function __vmValidateInstructionLayout(proto, validOpcodes) {
  validateInstructionLayout(proto, validOpcodes);
}
function genHandler(opName) {
  const a = shortName(), b = shortName(), c = shortName();
  const R = shortName(), K = shortName(), G = shortName();
  const P = shortName(), I = shortName(), rn = shortName();
  const dd = shortName(), cs = shortName(), UV = shortName();
  const sig = `function(${a},${b},${c},${R},${K},${G},${P},${I},${rn},${dd},${cs},${UV})`;
  switch (opName) {
    case "LOADK":
      return `${sig} ${R}[${a}]=${K}[${b}] end`;
    case "LOADNIL":
      return `${sig} for _i=${a},${b} do ${R}[_i]=nil end end`;
    case "LOADBOOL":
      return `${sig} ${R}[${a}]=${b}~=0;if ${c}~=0 then return ${P}+1 end end`;
    case "MOVE":
      return `${sig} ${R}[${a}]=${R}[${b}] end`;
    case "GETGLOBAL":
      return `${sig} ${R}[${a}]=${G}[${K}[${b}]] end`;
    case "SETGLOBAL":
      return `${sig} ${G}[${K}[${b}]]=${R}[${a}] end`;
    case "GETUPVAL":
      return `${sig} local _box=${UV}[${b}];${R}[${a}]=_box[1] end`;
    case "SETUPVAL":
      return `${sig} ${UV}[${b}][1]=${R}[${a}] end`;
    case "GETTABLE":
      return `${sig} ${R}[${a}]=${R}[${b}][${R}[${c}]] end`;
    case "SETTABLE":
      return `${sig} ${R}[${a}][${R}[${b}]]=${R}[${c}] end`;
    case "NEWTABLE":
      return `${sig} ${R}[${a}]={} end`;
    case "SELF":
      return `${sig} ${R}[${a}+1]=${R}[${b}];local _ok,_fn=pcall(function() return ${R}[${b}][${R}[${c}]] end);${R}[${a}]=_ok and _fn or nil end`;
    case "ADD":
      return `${sig} ${R}[${a}]=${R}[${b}]+${R}[${c}] end`;
    case "SUB":
      return `${sig} ${R}[${a}]=${R}[${b}]-${R}[${c}] end`;
    case "MUL":
      return `${sig} ${R}[${a}]=${R}[${b}]*${R}[${c}] end`;
    case "DIV":
      return `${sig} ${R}[${a}]=${R}[${b}]/${R}[${c}] end`;
    case "MOD":
      return `${sig} ${R}[${a}]=${R}[${b}]%${R}[${c}] end`;
    case "POW":
      return `${sig} ${R}[${a}]=${R}[${b}]^${R}[${c}] end`;
    case "FLOORDIV":
      return `${sig} ${R}[${a}]=math.floor(${R}[${b}]/${R}[${c}]) end`;
    case "UNM":
      return `${sig} ${R}[${a}]=-${R}[${b}] end`;
    case "NOT":
      return `${sig} ${R}[${a}]=not ${R}[${b}] end`;
    case "LEN":
      return `${sig} ${R}[${a}]=#${R}[${b}] end`;
    case "CONCAT":
      return `${sig} local _r=${R}[${c}];for _i=${c}-1,${b},-1 do _r=${R}[_i].._r end;${R}[${a}]=_r end`;
    case "EQ":
      return `${sig} ${R}[${a}]=(${R}[${b}]==${R}[${c}]) end`;
    case "LT":
      return `${sig} ${R}[${a}]=(${R}[${b}]<${R}[${c}]) end`;
    case "LE":
      return `${sig} ${R}[${a}]=(${R}[${b}]<=${R}[${c}]) end`;
    case "TEST":
      return `${sig} if (not not ${R}[${a}])~=(${c}~=0) then return ${P}+1 end end`;
    case "TESTSET":
      return `${sig} if (not not ${R}[${b}])==(${c}~=0) then ${R}[${a}]=${R}[${b}] else return ${P}+1 end end`;
    case "JMP":
      return `${sig} return ${a} end`;
    case "JMPIF":
      return `${sig} if ${c}==0 then if not ${R}[${a}] then return ${b} end elseif ${c}==1 then if ${R}[${a}] then return ${b} end elseif ${c}==2 then if ${R}[${a}]==nil then return ${b} end elseif ${c}==3 then if ${R}[${a}] then return ${b} end end end`;
    case "CALL": {
      const fn = shortName(), args = shortName(), ret = shortName(), ii = shortName(), ac = shortName();
      const pause = _ctx.policy ? `${_ctx.policy}.pause(_state);` : "";
      const resume = _ctx.policy ? `${_ctx.policy}.resume(_state,type(_wr[1])=='number' and _wr[1]>0);` : "";
      const waitCheck = _ctx.policy ? `${_ctx.policy}.waitRef and ${fn}==${_ctx.policy}.waitRef` : "";
      const fast = [0, 1, 2, 3].map((count) => {
        const call = `${fn}(${Array.from({ length: count }, (_, i) => `${R}[${a}+${i + 1}]`).join(",")})`;
        return `${count === 0 ? "if" : "elseif"} ${b}==${count + 1} then if ${c}==2 then ${R}[${a}]=${call} else ${call} end;`;
      }).join("");
      const generic = `local ${args}={};local ${ac}=0;if ${b}==0 then local _t=${R}[${JSON.stringify(registerFields.top)}] or (${a}-1);for _j=${a}+1,_t do ${ac}=${ac}+1;${args}[${ac}]=${R}[_j] end else ${ac}=${b}-1;for ${ii}=1,${ac} do ${args}[${ii}]=${R}[${a}+${ii}] end end;local ${ret}=${_ctx.pk}(${fn}(unpack(${args},1,${ac})));if ${c}==0 then ${R}[${JSON.stringify(registerFields.top)}]=${a}+${ret}.n-1;for ${ii}=1,${ret}.n do ${R}[${a}+${ii}-1]=${ret}[${ii}] end elseif ${c}>1 then for ${ii}=1,${c}-1 do ${R}[${a}+${ii}-1]=${ret}[${ii}] end end;`;
      const callBody = `if ${b}>=1 and ${b}<=4 and (${c}==1 or ${c}==2) then ${fast}end else ${generic}end`;
      if (_ctx.policy) {
        return `${sig} ${_ctx.diagnostic ? "_lpyDiag.callOpcodes+=1;" : ""}local ${fn}=${R}[${a}];if ${waitCheck} then local _state=${_ctx.policy}.get();${pause}local _wait=${fn};${fn}=function(...) local _wr=${_ctx.pk}(_wait(...));${resume}return unpack(_wr,1,_wr.n) end end;${callBody} end`;
      }
      return `${sig} local ${fn}=${R}[${a}];${callBody} end`;
    }
    case "TAILCALL": {
      const fn = shortName(), args = shortName(), ii = shortName(), ac = shortName();
      return `${sig} local ${fn}=${R}[${a}];local ${args}={};local ${ac}=0;if ${b}==0 then local _t=${R}[${JSON.stringify(registerFields.top)}] or (${a}-1);for _j=${a}+1,_t do ${ac}=${ac}+1;${args}[${ac}]=${R}[_j] end else ${ac}=${b}-1;for ${ii}=1,${ac} do ${args}[${ii}]=${R}[${a}+${ii}] end end;${R}[${JSON.stringify(registerFields.halt)}]=true;${R}[${JSON.stringify(registerFields.rv)}]=${_ctx.pk}(${fn}(unpack(${args},1,${ac}))) end`;
    }
    case "RETURN": {
      const ret = shortName(), ii = shortName();
      return `${sig} ${R}[${JSON.stringify(registerFields.halt)}]=true;if ${b}==1 then ${R}[${JSON.stringify(registerFields.rv)}]={n=0} elseif ${b}==0 then local _t=${R}[${JSON.stringify(registerFields.top)}] or (${a}-1);local ${ret}={n=0};for ${ii}=${a},_t do ${ret}.n=${ret}.n+1;${ret}[${ret}.n]=${R}[${ii}] end;${R}[${JSON.stringify(registerFields.rv)}]=${ret} else local ${ret}={n=${b}-1};for ${ii}=0,${b}-2 do ${ret}[${ii}+1]=${R}[${a}+${ii}] end;${R}[${JSON.stringify(registerFields.rv)}]=${ret} end end`;
    }
    case "FORPREP": {
      const initial = shortName(), limit = shortName(), step = shortName();
      const checked = (offset, label, destination) => `local ${destination}=tonumber(${R}[${offset}]);if ${destination}==nil then error("invalid 'for' ${label} (number expected, got "..type(${R}[${offset}])..")",0) end;`;
      return `${sig} ${checked(a, "initial value", initial)}${checked(`${a}+1`, "limit", limit)}${checked(`${a}+2`, "step", step)}${R}[${a}]=${initial};${R}[${a}+1]=${limit};${R}[${a}+2]=${step};if (${step}>0 and ${initial}<=${limit}) or (${step}<=0 and ${initial}>=${limit}) then ${R}[${a}+3]=${initial};return ${P} end;return ${b}+1 end`;
    }
    case "FORLOOP": {
      const step = shortName(), limit = shortName(), val = shortName();
      return `${sig} local ${step}=${R}[${a}+2];local ${limit}=${R}[${a}+1];local ${val}=${R}[${a}]+${step};${R}[${a}]=${val};if (${step}>0 and ${val}<=${limit}) or (${step}<=0 and ${val}>=${limit}) then ${R}[${a}+3]=${val};return ${b} end end`;
    }
    case "TFORLOOP": {
      const ret = shortName(), ii = shortName(), it = shortName(), st = shortName(), mt = shortName();
      return `${sig} local ${it},${st}=${R}[${a}],${R}[${a}+1];if type(${it})=='table' then local ${mt}=getmetatable(${it});if ${mt} and rawget(${mt},'__iter') then ${it},${st}=${mt}.__iter(${R}[${a}]),nil else ${it},${st}=next,${R}[${a}] end end;local ${ret}=${_ctx.pk}(${it}(${st},${R}[${a}+2]));for ${ii}=1,${c} do ${R}[${a}+2+${ii}]=${ret}[${ii}] end;if ${ret}[1]~=nil then ${R}[${a}+2]=${ret}[1];return ${P}+1 end end`;
    }
    case "SETLIST": {
      const ii = shortName();
      return `${sig} local _o=${c};if ${b}==0 then local _t=${R}[${JSON.stringify(registerFields.top)}] or ${a};for ${ii}=${a}+1,_t do ${R}[${a}][_o+(${ii}-${a})]=${R}[${ii}] end else for ${ii}=1,${b} do ${R}[${a}][_o+${ii}]=${R}[${a}+${ii}] end end end`;
    }
    case "CLOSE":
      return `${sig} for _k=${a},${b} do local _box=${R}[${JSON.stringify(registerFields.boxes)}][_k];if _box then ${R}[${JSON.stringify(registerFields.boxes)}][_k]={_box[1]} end end end`;
    case "CLOSURE": {
      const nuvVar = shortName(), uvtVar = shortName(), uvI = shortName();
      const srcVar = shortName(), idxVar = shortName();
      return `${sig} local ${nuvVar}=${dd}[${b}+5];local ${uvtVar}={};for ${uvI}=0,${nuvVar}-1 do local ${srcVar}=${dd}[${b}+6+${uvI}*2];local ${idxVar}=${dd}[${b}+7+${uvI}*2];if ${srcVar}==0 then if not ${R}[${JSON.stringify(registerFields.boxes)}][${idxVar}] then ${R}[${JSON.stringify(registerFields.boxes)}][${idxVar}]={${R}[${idxVar}]} end;${uvtVar}[${uvI}]=${R}[${JSON.stringify(registerFields.boxes)}][${idxVar}] else ${uvtVar}[${uvI}]=${UV}[${idxVar}] end end;${R}[${a}]=${_ctx.native ? `${rn}(${b},${c},nil,${uvtVar},true)` : `function(...) local _a=${_ctx.pk}(...);return ${rn}(${b},${c},_a,${uvtVar}) end`} end`;
    }
    case "VARARG": {
      const ii = shortName(), va = shortName(), vac = shortName();
      return `${sig} local ${va}=${R}[${JSON.stringify(registerFields.va)}];local ${vac}=${R}[${JSON.stringify(registerFields.vac)}] or ((${va} and #${va}) or 0);if ${b}==0 then if ${vac}>0 then for ${ii}=1,${vac} do ${R}[${a}+${ii}-1]=${va}[${ii}] end;${R}[${JSON.stringify(registerFields.top)}]=${a}+${vac}-1 else ${R}[${JSON.stringify(registerFields.top)}]=${a}-1 end else for ${ii}=1,${b}-1 do if ${ii}<=${vac} then ${R}[${a}+${ii}-1]=${va}[${ii}] else ${R}[${a}+${ii}-1]=nil end end end end`;
    }
    default:
      return `function()end`;
  }
}
function genConfusionTable(varName) {
  const size = 90 + Math.floor(Math.random() * 60);
  const usedValues = /* @__PURE__ */ new Set();
  const values = [];
  for (let i = 0; i < size; i++) {
    let v;
    do {
      v = Math.floor(Math.random() * 999999) + 1;
    } while (usedValues.has(v));
    usedValues.add(v);
    values.push(v);
  }
  const entries = values.map((v, i) => `[${i}]=${obfNumSafe(v, 1)}`);
  return {
    code: `local ${varName}={${entries.join(",")}};`,
    size,
    values
  };
}
let __emittedStmts = /* @__PURE__ */ new Map();
const EMIT_LIMIT = 3;
function resetEmitTracker() {
  __emittedStmts = /* @__PURE__ */ new Map();
}
function noteEmit(stmt) {
  const n = (__emittedStmts.get(stmt) || 0) + 1;
  __emittedStmts.set(stmt, n);
  return n <= EMIT_LIMIT;
}
let __ctAliases = [];
function setCtAliases(arr) {
  __ctAliases = arr;
}
function pickCtRef(fallback) {
  if (__ctAliases.length === 0) return fallback;
  return Math.random() < 0.55 ? __ctAliases[Math.floor(Math.random() * __ctAliases.length)] : fallback;
}
function genErrorTrap() {
  const t = Math.floor(Math.random() * 8);
  switch (t) {
    case 0:
      return `return`;
    case 1:
      return `return nil`;
    case 2:
      return `do return end`;
    case 3:
      return `return nil,nil`;
    case 4:
      return `return false`;
    case 5:
      return `return {}`;
    case 6:
      return `return (nil)`;
    default:
      return `return`;
  }
}
function genConfusionPredicate(ctVar, ctSize) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const t = Math.floor(Math.random() * 24);
    const idx1 = Math.floor(Math.random() * ctSize);
    const idx2 = Math.floor(Math.random() * ctSize);
    const idx3 = Math.floor(Math.random() * ctSize);
    const idx2safe = idx2 === idx1 ? (idx2 + 1) % ctSize : idx2;
    const r1 = pickCtRef(ctVar);
    const r2 = pickCtRef(ctVar);
    const r3 = pickCtRef(ctVar);
    const body = genErrorTrap();
    const trapBody = () => genErrorTrap();
    let stmt = "";
    switch (t) {
      case 0:
        stmt = `if ${r1}[${luauNum(idx1)}]==${r2}[${luauNum(idx2safe)}] then ${body} end;`;
        break;
      case 1:
        stmt = `if ${r1}[${luauNum(idx1)}]~=${r1}[${luauNum(idx1)}] then ${body} end;`;
        break;
      case 2:
        stmt = `if not ${r1}[${luauNum(idx1)}] then if ${r2}[${luauNum(idx2safe)}] then ${body} end end;`;
        break;
      case 3:
        stmt = `if ${r1}[${luauNum(idx1)}]<${r2}[${luauNum(idx2safe)}] and ${r1}[${luauNum(idx1)}]>${r2}[${luauNum(idx2safe)}] then ${body} end;`;
        break;
      case 4:
        stmt = `if ${r1}[${luauNum(idx1)}]==${luauNum(-(Math.floor(Math.random() * 99999) + 1))} then ${body} end;`;
        break;
      case 5:
        stmt = `if (${r1}[${luauNum(idx1)}] or 0)+1==(${r2}[${luauNum(idx1)}] or 0) then ${body} end;`;
        break;
      case 6:
        stmt = `if type(${r1}[${luauNum(idx1)}])==${luraphStr("userdata")} then ${body} end;`;
        break;
      case 7:
        stmt = `if not(${r1}[${luauNum(idx1)}]==${r1}[${luauNum(idx1)}]) then ${body} end;`;
        break;
      case 8:
        stmt = `if ${r1}[${luauNum(idx1)}]~=${r1}[${luauNum(idx1)}] or false then ${trapBody()} end;`;
        break;
      case 9:
        stmt = `if bit32.bxor(${luauNum(idx1)},${luauNum(idx1)})~=0 then ${body} end;`;
        break;
      case 10:
        stmt = `if select('#',${r1}[${luauNum(idx1)}])<1 then ${body} end;`;
        break;
      case 11:
        stmt = `if ${r1}[${luauNum(idx1)}] and not ${r1}[${luauNum(idx1)}] then ${body} end;`;
        break;
      case 12:
        stmt = `if ${luauNum(idx1)}+${luauNum(idx2safe)}~=${luauNum(idx1 + idx2safe)} then ${body} end;`;
        break;
      case 13:
        stmt = `if tostring(${r1}[${luauNum(idx1)}])~=tostring(${r1}[${luauNum(idx1)}]) then ${body} end;`;
        break;
      case 14:
        stmt = `if bit32.band(${luauNum(idx1)},0)~=0 then ${body} end;`;
        break;
      case 15:
        stmt = `if ${r1}[${luauNum(idx1)}]==nil and ${r2}[${luauNum(idx2safe)}]==nil and ${r3}[${luauNum(idx3)}]~=nil then ${body} end;`;
        break;
      case 16:
        stmt = `if #${r1}<0 then ${body} end;`;
        break;
      case 17:
        stmt = `if math.floor(${luauNum(idx1)})~=${luauNum(idx1)} then ${body} end;`;
        break;
      case 18:
        stmt = `if false==(${r1}[${luauNum(idx1)}]==${r1}[${luauNum(idx1)}]) then ${body} end;`;
        break;
      case 19:
        stmt = `if (${r1}[${luauNum(idx1)}] or 1)*0~=0 then ${body} end;`;
        break;
      case 20:
        stmt = `if bit32.bor(${luauNum(idx1)},${luauNum(idx1)})~=${luauNum(idx1)} then ${body} end;`;
        break;
      case 21:
        stmt = `if not (${r1}[${luauNum(idx1)}] or true) then ${body} end;`;
        break;
      case 22:
        stmt = `if type(${luauNum(idx1)})~=${luraphStr("number")} then ${body} end;`;
        break;
      case 23:
        stmt = `if ${r1}[${luauNum(idx1)}]==${r1}[${luauNum(idx1)}] and false then ${body} end;`;
        break;
    }
    if (noteEmit(stmt)) return stmt;
  }
  return "";
}
function genOpaquePredicate() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const v = shortName();
    const v2 = shortName();
    const t = Math.floor(Math.random() * 17);
    let stmt = "";
    switch (t) {
      case 0: {
        const n = (Math.random() * 100 | 0) + 2;
        stmt = `local ${v}=${luauNum(n * n)};if ${v}<0 then return end;`;
        break;
      }
      case 1: {
        const n = (Math.random() * 50 | 0) + 1;
        stmt = `if type(${luauNum(n)})~=${luraphStr("number")} then return end;`;
        break;
      }
      case 2:
        stmt = `if nil then return end;`;
        break;
      case 3: {
        const n1 = (Math.random() * 100 | 0) + 50;
        const n2 = n1 + (Math.random() * 100 | 0) + 1;
        stmt = `if ${luauNum(n1)}>${luauNum(n2)} then return end;`;
        break;
      }
      case 4: {
        const n = (Math.random() * 999 | 0) + 1;
        stmt = `if type(${luauNum(n)})==${luraphStr("string")} then return end;`;
        break;
      }
      case 5: {
        const n = (Math.random() * 50 | 0) + 1;
        stmt = `local ${v}=${luauNum(n)};local ${v2}=${v}*${v};if ${v2}<0 then return end;`;
        break;
      }
      case 6:
        stmt = `if not not false then return end;`;
        break;
      case 7: {
        const n = (Math.random() * 80 | 0) + 1;
        stmt = `local ${v}=bit32.bxor(${luauNum(n)},${luauNum(n)});if ${v}~=0 then return end;`;
        break;
      }
      case 8: {
        const n = (Math.random() * 50 | 0) + 1;
        stmt = `local ${v}={${luauNum(n)}};if #${v}<1 then return end;`;
        break;
      }
      case 9:
        stmt = `if select('#')>0 then return end;`;
        break;
      case 10: {
        const n = (Math.random() * 99 | 0) + 1;
        stmt = `local ${v}=${luauNum(n)};${v}=${v}+0;`;
        break;
      }
      case 11: {
        const n = (Math.random() * 40 | 0) + 1;
        stmt = `for ${v}=${luauNum(n)},${luauNum(n - 1)} do return end;`;
        break;
      }
      case 12: {
        const n = (Math.random() * 30 | 0) + 2;
        stmt = `local ${v}=bit32.band(${luauNum(n)},0);if ${v}~=0 then return end;`;
        break;
      }
      case 13: {
        const n = (Math.random() * 100 | 0) + 1;
        stmt = `local ${v},${v2}=${luauNum(n)},${luauNum(n)};if ${v}~=${v2} then return end;`;
        break;
      }
      // Keep these predicates arithmetic-only. Negating a comparison with unary
      // minus is invalid in Luau because the comparison evaluates to boolean.
      case 14: {
        const n = (Math.random() * 250 | 0) + 2;
        stmt = `local ${v}=${luauNum(n)};if -${v}>0 then return end;`;
        break;
      }
      case 15: {
        const n = (Math.random() * 250 | 0) + 2;
        stmt = `local ${v}=${luauNum(n)};if ${v}-${v}~=0 then return end;`;
        break;
      }
      case 16: {
        const n = (Math.random() * 80 | 0) + 1;
        stmt = `repeat if ${luauNum(n)}==${luauNum(n)} then break end;return until true;`;
        break;
      }
    }
    if (noteEmit(stmt)) return stmt;
  }
  return "";
}
function wrapInSubStateMachine(code) {
  const nVar = shortName();
  const startState = Math.floor(Math.random() * 200) + 50;
  const doneState = startState + Math.floor(Math.random() * 100) + 10;
  const fakeState = startState + Math.floor(Math.random() * 5) + 1;
  return `local ${nVar}=${luauNum(startState)};while true do if ${nVar}==${luauNum(startState)} then ${code};${nVar}=${luauNum(doneState)} elseif ${nVar}==${luauNum(fakeState)} then ${genErrorTrap()};${nVar}=${luauNum(doneState)} else break end end;`;
}
const INLINE_OPCODES = /* @__PURE__ */ new Set([
  "MOVE",
  "LOADK",
  "LOADNIL",
  "LOADBOOL",
  "NEWTABLE",
  "ADD",
  "SUB",
  "MUL",
  "DIV",
  "MOD",
  "POW",
  "FLOORDIV",
  "UNM",
  "NOT",
  "LEN",
  "GETTABLE",
  "SETTABLE",
  "GETGLOBAL",
  "SETGLOBAL",
  "EQ",
  "LT",
  "LE",
  "JMP",
  "JMPIF",
  "TEST",
  "TESTSET",
  "GETUPVAL",
  "SETUPVAL"
]);
function genInlineBody(opName, ctx) {
  const { ci, R, K, G, pc, UV } = ctx;
  const a = `${ci}[2]`, b = `${ci}[3]`, c = `${ci}[4]`;
  switch (opName) {
    case "MOVE":
      return `${R}[${a}]=${R}[${b}] `;
    case "LOADK":
      return `${R}[${a}]=${K}[${b}] `;
    case "LOADNIL":
      return `for _i=${a},${b} do ${R}[_i]=nil end `;
    case "LOADBOOL":
      return `${R}[${a}]=${b}~=0;if ${c}~=0 then ${pc}=${pc}+1 end `;
    case "NEWTABLE":
      return `${R}[${a}]={} `;
    case "ADD":
      return `${R}[${a}]=${R}[${b}]+${R}[${c}] `;
    case "SUB":
      return `${R}[${a}]=${R}[${b}]-${R}[${c}] `;
    case "MUL":
      return `${R}[${a}]=${R}[${b}]*${R}[${c}] `;
    case "DIV":
      return `${R}[${a}]=${R}[${b}]/${R}[${c}] `;
    case "MOD":
      return `${R}[${a}]=${R}[${b}]%${R}[${c}] `;
    case "POW":
      return `${R}[${a}]=${R}[${b}]^${R}[${c}] `;
    case "FLOORDIV":
      return `${R}[${a}]=math.floor(${R}[${b}]/${R}[${c}]) `;
    case "UNM":
      return `${R}[${a}]=-${R}[${b}] `;
    case "NOT":
      return `${R}[${a}]=not ${R}[${b}] `;
    case "LEN":
      return `${R}[${a}]=#${R}[${b}] `;
    case "GETTABLE":
      return `${R}[${a}]=${R}[${b}][${R}[${c}]] `;
    case "SETTABLE":
      return `${R}[${a}][${R}[${b}]]=${R}[${c}] `;
    case "GETGLOBAL":
      return `${R}[${a}]=${G}[${K}[${b}]] `;
    case "SETGLOBAL":
      return `${G}[${K}[${b}]]=${R}[${a}] `;
    case "GETUPVAL":
      return `local _box=${UV}[${b}];${R}[${a}]=_box[1] `;
    case "SETUPVAL":
      return `${UV}[${b}][1]=${R}[${a}] `;
    case "EQ":
      return `${R}[${a}]=(${R}[${b}]==${R}[${c}]) `;
    case "LT":
      return `${R}[${a}]=(${R}[${b}]<${R}[${c}]) `;
    case "LE":
      return `${R}[${a}]=(${R}[${b}]<=${R}[${c}]) `;
    case "JMP":
      return `${pc}=${a} `;
    // TEST: in handler, P is already nPC (post-increment). return P+1 skips next.
    // Inline: pc is already incremented, so skip = pc+1
    case "TEST":
      return `if (not not ${R}[${a}])~=(${c}~=0) then ${pc}=${pc}+1 end `;
    case "TESTSET":
      return `if (not not ${R}[${b}])==(${c}~=0) then ${R}[${a}]=${R}[${b}] else ${pc}=${pc}+1 end `;
    case "JMPIF":
      return `if ${c}==0 then if not ${R}[${a}] then ${pc}=${b} end elseif ${c}==1 then if ${R}[${a}] then ${pc}=${b} end elseif ${c}==2 then if ${R}[${a}]==nil then ${pc}=${b} end elseif ${c}==3 then if ${R}[${a}] then ${pc}=${b} end end `;
    default:
      return null;
  }
}
function buildBinaryDispatchTree(entries, opcodeVar, argVars, pcVar, regsVar, depth = 0, dispatchHelper, inlineCtx) {
  if (entries.length === 0) return "";
  const inlinePad = () => {
    if (depth > 1) return "";
    const roll = Math.random();
    if (roll < 0.72) return "";
    const v = shortName();
    const shape = Math.floor(Math.random() * 5);
    switch (shape) {
      case 0: {
        const len = 40 + Math.floor(Math.random() * 200);
        return `local ${v}=${genLuraphPadding(len)};`;
      }
      case 1:
        return `local ${v}=${obfNumSafe(Math.floor(Math.random() * 16777215), 2)};`;
      case 2:
        return `local ${v}=bit32.bxor(${obfNumSafe(Math.floor(Math.random() * 65535), 1)},${obfNumSafe(Math.floor(Math.random() * 65535), 1)});`;
      case 3:
        return `do local ${v}=${obfNumSafe(Math.floor(Math.random() * 65535), 1)}+${obfNumSafe(Math.floor(Math.random() * 65535), 1)};end;`;
      default:
        return depth === 0 && Math.random() < 0.3 ? genInlineLongStringPad(120, 500) : "";
    }
  };
  const callHandler = (e) => {
    if (inlineCtx && e.opName && INLINE_OPCODES.has(e.opName)) {
      const body = genInlineBody(e.opName, inlineCtx);
      if (body) return body;
    }
    if (dispatchHelper) {
      return `${dispatchHelper}_selected=${e.handlerVar};`;
    }
    const rv = shortName();
    return `local ${rv}=${e.handlerVar}(${argVars});if ${rv} then ${pcVar}=${rv} end `;
  };
  if (entries.length === 1) {
    const e = entries[0];
    return `if ${opcodeVar}==${rawLit(e.encodedOp)} then ${inlinePad()}${callHandler(e)}end `;
  }
  entries.sort((a, b) => a.encodedOp - b.encodedOp);
  if (entries.length <= 3) {
    if (entries.length === 2 && Math.random() < 0.5) {
      const pad2 = inlinePad();
      return `if ${opcodeVar}<${rawLit(entries[1].encodedOp)} then ${pad2}${callHandler(entries[0])} else ${pad2}${callHandler(entries[1])} end `;
    }
    const parts = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const kw = i === 0 ? "if" : "elseif";
      parts.push(`${kw} ${opcodeVar}==${rawLit(e.encodedOp)} then ${inlinePad()}${callHandler(e)}`);
    }
    parts.push("end");
    return parts.join("");
  }
  const mid = Math.floor(entries.length / 2);
  const pivot = entries[mid - 1].encodedOp + 1 + Math.floor(Math.random() * Math.max(1, entries[mid].encodedOp - entries[mid - 1].encodedOp));
  const useGT = Math.random() < 0.5;
  const left = entries.slice(0, mid);
  const right = entries.slice(mid);
  const pad = inlinePad();
  if (useGT) {
    return `if ${opcodeVar}>=${rawLit(pivot)} then ${pad}${buildBinaryDispatchTree(right, opcodeVar, argVars, pcVar, regsVar, depth + 1, dispatchHelper, inlineCtx)} else ${pad}${buildBinaryDispatchTree(left, opcodeVar, argVars, pcVar, regsVar, depth + 1, dispatchHelper, inlineCtx)} end `;
  } else {
    return `if ${opcodeVar}<${rawLit(pivot)} then ${pad}${buildBinaryDispatchTree(left, opcodeVar, argVars, pcVar, regsVar, depth + 1, dispatchHelper, inlineCtx)} else ${pad}${buildBinaryDispatchTree(right, opcodeVar, argVars, pcVar, regsVar, depth + 1, dispatchHelper, inlineCtx)} end `;
  }
}
function encodeProto(p, out) {
  out.push(p.instructions.length, p.constants.length, p.numParams, p.protos.length, p.maxReg, p.upvalues.length);
  for (const uv of p.upvalues) {
    out.push(uv.source, uv.index);
  }
  for (const instr of p.instructions) {
    for (let j = 0; j < 4; j++) out.push(instr[j]);
  }
  for (const sub of p.protos) encodeProto(sub, out);
}
function collectConstants(p, out) {
  for (const c of p.constants) out.push(c);
  for (const sub of p.protos) collectConstants(sub, out);
}
function getProtoDataSize(p) {
  let size = 6 + p.upvalues.length * 2 + p.instructions.length * 4;
  for (const sub of p.protos) size += getProtoDataSize(sub);
  return size;
}
function getProtoConstCount(p) {
  let count = p.constants.length;
  for (const sub of p.protos) count += getProtoConstCount(sub);
  return count;
}
function computeProtoPositions(p, startPos, startConst, result) {
  result.set(p, { dataPos: startPos, constOff: startConst });
  let pos = startPos + 6 + p.upvalues.length * 2 + p.instructions.length * 4;
  let coff = startConst + p.constants.length;
  for (const sub of p.protos) {
    computeProtoPositions(sub, pos, coff, result);
    pos += getProtoDataSize(sub);
    coff += getProtoConstCount(sub);
  }
}
function patchClosureInstrs(p, closureOp, positions) {
  for (const instr of p.instructions) {
    if (instr[0] === closureOp) {
      const sub = p.protos[instr[2]];
      const info = positions.get(sub);
      if (!info) throw new Error("Missing closure prototype");
      instr[2] = info.dataPos + 1;
      instr[3] = info.constOff;
    }
  }
  for (const sub of p.protos) patchClosureInstrs(sub, closureOp, positions);
}
function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function genHandlerPrologue(argNames) {
  const pick = (a2) => a2[Math.floor(Math.random() * a2.length)];
  const a = pick(argNames);
  const b = pick(argNames);
  const tmp = shortName();
  const variant = Math.floor(Math.random() * 8);
  switch (variant) {
    case 0:
      return `local ${tmp}=${a} or 0;`;
    case 1:
      return `if false then return ${b} end;`;
    case 2:
      return `${a}=${a};`;
    case 3:
      return `local ${tmp}=${a} and 1 or 0;`;
    case 4:
      return `for ${tmp}=1,0 do end;`;
    case 5:
      return `local ${tmp};if ${a}==${b} then ${tmp}=${a} end;`;
    case 6:
      return `local ${tmp}=type(${a})=='number' and ${a} or 0;`;
    default:
      return `local ${tmp}=(${a} or 0);${tmp}=${tmp};`;
  }
}
function genJunkHandlerBody(argNames, bxAlias) {
  const pick = (a2) => a2[Math.floor(Math.random() * a2.length)];
  const a = pick(argNames), b = pick(argNames), c = pick(argNames);
  const t1 = shortName(), t2 = shortName();
  const variant = Math.floor(Math.random() * 7);
  const rn = () => Math.floor(Math.random() * 9999) + 1;
  switch (variant) {
    case 0:
      return `local ${t1}=${bxAlias}(${a} or 0,${rn()});return ${t1}%256;`;
    case 1:
      return `local ${t1}=0;for ${t2}=1,${1 + (Math.random() * 3 | 0)} do ${t1}=${t1}+(${b} or 0) end;return ${t1};`;
    case 2:
      return `local ${t1}=(${a} or 0)+(${b} or 0);if ${t1}>${rn()} then ${t1}=${t1}-1 end;return ${t1};`;
    case 3:
      return `if ${a} and ${b} then return (${a} or 0)*2 end;return 0;`;
    case 4:
      return `local ${t1}={${a},${b},${c}};return ${t1}[1] or 0;`;
    case 5:
      return `local ${t1}=setmetatable({},{__index=function()return ${rn()} end});return ${t1}[1];`;
    default:
      return `local ${t1}=math.floor((${a} or 0)/1);return ${t1};`;
  }
}
function genJunkFragmentState(bxAlias) {
  const t1 = shortName(), t2 = shortName();
  const rn = () => Math.floor(Math.random() * 9999) + 1;
  const variant = Math.floor(Math.random() * 6);
  switch (variant) {
    case 0:
      return `local ${t1}=${bxAlias}(${rn()},${rn()});${t1}=${t1}%256;`;
    case 1:
      return `local ${t1}=0;for ${t2}=1,${1 + (Math.random() * 3 | 0)} do ${t1}=${t1}+${rn()} end;`;
    case 2:
      return `local ${t1}=(${rn()}+${rn()})%${rn()};if ${t1}>${rn()} then ${t1}=${t1}-1 end;`;
    case 3:
      return `local ${t1}={${rn()},${rn()}};${t1}[1]=${t1}[2] or 0;`;
    case 4:
      return `local ${t1}=math.floor(${rn()}/1);${t1}=${t1}+0;`;
    default:
      return `local ${t1}=${rn()};if ${t1}>${rn() + 1} then ${t1}=${t1}-1 end;`;
  }
}
function fragmentHandler(handlerCode, bxAlias) {
  const fnEnd = handlerCode.indexOf(")") + 1;
  if (fnEnd <= 0) return handlerCode;
  const sig = handlerCode.substring(0, fnEnd);
  const body = handlerCode.substring(fnEnd).replace(/end\s*$/, "");
  const numStates = 2 + Math.floor(Math.random() * 4);
  const realState = Math.floor(Math.random() * numStates);
  const stateVals = [];
  const seen = /* @__PURE__ */ new Set();
  while (stateVals.length < numStates + 1) {
    const v2 = Math.floor(Math.random() * 65535);
    if (!seen.has(v2)) {
      seen.add(v2);
      stateVals.push(v2);
    }
  }
  const doneVal = stateVals[numStates];
  const v = shortName();
  const branches = [];
  for (let k = 0; k < numStates; k++) {
    const cur = stateVals[k];
    const next = k + 1 < numStates ? stateVals[k + 1] : doneVal;
    const kw = k === 0 ? "if" : "elseif";
    if (k === realState) {
      const content = body.replace(/;+\s*$/, "");
      branches.push(`${kw} ${v}==${luauNum(cur)} then ${v}=${luauNum(next)};${content} `);
    } else {
      const content = genJunkFragmentState(bxAlias).replace(/;+\s*$/, "");
      branches.push(`${kw} ${v}==${luauNum(cur)} then ${content};${v}=${luauNum(next)} `);
    }
  }
  return `${sig} local ${v}=${luauNum(stateVals[0])};while true do ${branches.join("")}else break end end end`;
}
function deepCloneProto(p) {
  return {
    instructions: p.instructions.map((i) => [...i]),
    constants: [...p.constants],
    numParams: p.numParams,
    hasVararg: p.hasVararg,
    maxReg: p.maxReg,
    protos: p.protos.map(deepCloneProto),
    upvalues: p.upvalues.map((u) => ({ ...u })),
    nativeSource: p.nativeSource
  };
}
function generateVM(inputProto, opcodes, optLevel, toggles = {}, diagnostic = false, audit, session) {
  if (!session) return withGenerationSession((context) => {
    const output = generateVM(inputProto, opcodes, optLevel, toggles, diagnostic, audit, context);
    if (context.callbackErrors.length) throw new Error(`E_GENERATION_OBSERVER: ${context.callbackErrors.join("; ")}`);
    return output;
  });
  assertGenerationSession(session);
  const saved = { registerFields, _ctx, _obfStrLevel, _curCharset, _curValueXor, __emittedStmts, __ctAliases };
  return withNameState(() => {
    try {
      return generateVMBody(inputProto, opcodes, optLevel, toggles, diagnostic, audit);
    } finally {
      ({ registerFields, _ctx, _obfStrLevel, _curCharset, _curValueXor, __emittedStmts, __ctAliases } = saved);
    }
  });
}
function generateVMBody(inputProto, opcodes, optLevel, toggles, diagnostic, audit) {
  const proto = deepCloneProto(inputProto);
  resetNames();
  pushLuraphNames();
  const policyName = shortName();
  const T = {
    intenseVm: !!toggles.intenseVm,
    instructionLimit: diagnostic && toggles.diagnosticInstructionLimit === true,
    directOutput: !!toggles.directOutput,
    gcFixes: !!toggles.gcFixes,
    compatMode: !!toggles.compatMode,
    hardcodeGlobals: !!toggles.hardcodeGlobals,
    staticEnv: !!toggles.staticEnv,
    vmCompression: !!toggles.vmCompression,
    lzmaWrapper: !!toggles.lzmaWrapper,
    debugLib: !!toggles.debugLib,
    ffiLibrary: !!toggles.ffiLibrary,
    int32bit: !!toggles.int32bit,
    robloxYield: !!toggles.robloxYield
  };
  const seed = Math.floor(Math.random() * 2e5) + 1e4;
  const numDepth = T.intenseVm ? 2 : optLevel >= 3 ? 2 : optLevel >= 2 ? 2 : 1;
  _obfStrLevel = T.intenseVm ? Math.max(optLevel, 2) : Math.min(optLevel, 2);
  const opcodeNames = Object.keys(opcodes);
  const validOpcodes = new Set(Object.values(opcodes));
  injectDeadInstructions(proto, opcodes);
  const usedRawOpcodes = /* @__PURE__ */ new Set();
  function collectUsedOpcodes(p) {
    for (const instr of p.instructions) usedRawOpcodes.add(instr[0]);
    for (const sub of p.protos) collectUsedOpcodes(sub);
  }
  collectUsedOpcodes(proto);
  const useBinaryTree = optLevel >= 1;
  const handlerSize = 256;
  const opcodeXorKey = Math.floor(Math.random() * 256);
  const opHashMul = Math.floor(Math.random() * 9e4) * 2 + 1;
  const opHashAdd = Math.floor(Math.random() * 1048575);
  const opHashSeed = Math.floor(Math.random() * 1048575);
  const opHashMod = 1048576;
  const hashOp = (b) => ((b * opHashMul + opHashAdd) % opHashMod ^ opHashSeed) >>> 0;
  const N = {
    bx: shortName(),
    bl: shortName(),
    br: shortName(),
    ba: shortName(),
    sc: shortName(),
    sel: shortName(),
    pk: shortName(),
    data: shortName(),
    cst: shortName(),
    dd: shortName(),
    run: shortName(),
    handlers: shortName(),
    dispatcher: shortName(),
    di: shortName(),
    p1: shortName(),
    p2: shortName(),
    p3: shortName(),
    op: shortName(),
    hf: shortName(),
    hIdx: shortName(),
    // Anti-hooking
    nf: shortName(),
    // native functions cache table
    chk: shortName(),
    // anti-hooking check function
    hProxy: shortName()
    // metamethod proxy for handler dispatch
  };
  _ctx = { bx: N.bx, bl: N.bl, br: N.br, ba: N.ba, sc: N.sc, pk: N.pk };
  registerFields = Object.fromEntries(REGISTER_FIELDS.map((field) => [field, shortName()]));
  const positions = /* @__PURE__ */ new Map();
  computeProtoPositions(proto, 0, 0, positions);
  patchClosureInstrs(proto, opcodes.CLOSURE, positions);
  validateInstructionLayout(proto, validOpcodes);
  const prototypeMetadata = emitPrototypeMetadata(Array.from(positions, ([p, position]) => ({
    position: position.dataPos + 1,
    captures: capturedRegisters(p)
  })));
  _ctx.native = Array.from(positions.keys()).some((p) => !!p.nativeSource);
  const nativeFactories = Array.from(positions, ([p, pos]) => p.nativeSource ? `[${pos.dataPos + 1}]=${p.nativeSource}` : "").filter(Boolean).join(",");
  const nativeChildren = Array.from(positions, ([p, pos]) => {
    const entries = p.protos.map((child) => {
      const cp = positions.get(child);
      if (!cp) throw new Error("Missing child");
      return `{${cp.dataPos + 1},${cp.constOff}}`;
    });
    return `[${pos.dataPos + 1}]={${entries.join(",")}}`;
  }).join(",");
  const flatInstr = [];
  encodeProto(proto, flatInstr);
  const perPcSeed = Math.floor(Math.random() * 65535) + 1;
  const perPcMul = Math.floor(Math.random() * 20) + 7;
  const perPcAdd = Math.floor(Math.random() * 50) + 3;
  function applyPerInstrMutation(p, offset) {
    const instrStart = offset + 6 + p.upvalues.length * 2;
    for (let i = 0; i < p.instructions.length; i++) {
      const perKey = (perPcSeed + i * perPcMul + perPcAdd) % 256;
      flatInstr[instrStart + i * 4] = (flatInstr[instrStart + i * 4] ^ perKey) >>> 0;
    }
    let subOffset = instrStart + p.instructions.length * 4;
    for (const sub of p.protos) {
      applyPerInstrMutation(sub, subOffset);
      subOffset += getProtoDataSize(sub);
    }
  }
  applyPerInstrMutation(proto, 0);
  let bytecodeKey = 0;
  for (let i = 0; i < Math.min(100, flatInstr.length); i++) {
    bytecodeKey = (bytecodeKey ^ flatInstr[i]) >>> 0;
  }
  bytecodeKey = bytecodeKey % 256;
  let integrityHash = 0;
  for (let i = 0; i < flatInstr.length; i++) {
    integrityHash = (integrityHash * 31 + flatInstr[i] & 16777215) >>> 0;
  }
  const chkHeadLen = Math.min(64, flatInstr.length);
  let chkHead = 0;
  for (let i = 0; i < chkHeadLen; i++) chkHead = (chkHead + flatInstr[i] * (i + 1) & 16777215) >>> 0;
  const chkTailStart = Math.max(0, flatInstr.length - 64);
  let chkTail = 0;
  for (let i = chkTailStart; i < flatInstr.length; i++) chkTail = (chkTail * 17 + flatInstr[i] + 7 & 16777215) >>> 0;
  let chkFold = 0;
  for (let i = 0; i < flatInstr.length; i += 7) chkFold = (chkFold ^ flatInstr[i]) >>> 0;
  const chkLen = flatInstr.length >>> 0;
  const allConstants = [];
  collectConstants(proto, allConstants);
  const encryptedFlat = flatInstr.map((v, i) => encryptValue(v, seed, i));
  const binXorKey = Math.floor(Math.random() * 4294967295) >>> 0;
  const binaryDataStr = encodeToBinaryString(encryptedFlat, binXorKey);
  const stringConstants = [];
  const stringSlotMap = [];
  const constEntries = [];
  const maskedNumberIndices = [];
  const numberMaskSeed = Math.floor(Math.random() * 16777216);
  const numberMaskMul = Math.floor(Math.random() * 32767) * 2 + 1;
  for (let ci = 0; ci < allConstants.length; ci++) {
    const c = allConstants[ci];
    if (typeof c === "string" && optLevel >= 2) stringSlotMap.push(ci + 1);
    if (c === null || c === void 0) constEntries.push("nil");
    else if (typeof c === "boolean") constEntries.push(c ? "true" : "false");
    else if (typeof c === "number") {
      if (Object.is(c, -0)) {
        constEntries.push("(-0.0)");
      } else if (Number.isInteger(c) && c >= -2147483648 && c <= 2147483647) {
        const mask = (numberMaskSeed + (ci + 1) * numberMaskMul + bytecodeKey) % 16777216;
        constEntries.push(obfNumSafe((c >>> 0 ^ mask) >>> 0, Math.min(numDepth, 1)));
        maskedNumberIndices.push(ci + 1);
      } else if (Number.isInteger(c) && c < 0) {
        constEntries.push(`(-(${obfNumSafe(Math.abs(c), Math.min(numDepth, 1))}))`);
      } else {
        constEntries.push(c.toString());
      }
    } else if (typeof c === "string") {
      if (optLevel >= 2) {
        const stIdx = stringConstants.length;
        stringConstants.push(c);
        constEntries.push("0");
      } else {
        const bytes = strToUtf8Bytes(c);
        const numParts = [luauNum(1)];
        for (let i = 0; i < bytes.length; i++) {
          const enc = (bytes[i] ^ (bytecodeKey + i * 7 + 5) % 256) & 255;
          numParts.push(luauNum(enc));
        }
        constEntries.push(`{${numParts.join(",")}}`);
      }
    }
  }
  const ctVarName = shortName();
  const confusionTable = genConfusionTable(ctVarName);
  resetEmitTracker();
  const ctAliasNames = [];
  const aliasCount = 3 + Math.floor(Math.random() * 3);
  for (let ai = 0; ai < aliasCount; ai++) ctAliasNames.push(shortName());
  setCtAliases(ctAliasNames);
  const ctAliasDecl = `local ${ctAliasNames.join(",")}=` + ctAliasNames.map(() => ctVarName).join(",") + ";";
  const opcodeEntries = [];
  const handlerLocals = [];
  const handlerBuiltins = makeBuiltinCtx(true);
  const handlerTableVar = shortName();
  _ctx.policy = T.robloxYield ? policyName : void 0;
  _ctx.diagnostic = diagnostic;
  const shuffledOpcodeNames = shuffle(opcodeNames);
  const numDummies = T.intenseVm ? 8 + Math.floor(Math.random() * 6) : Math.floor(Math.random() * 3) + 2;
  const realHandlerCount = shuffledOpcodeNames.filter((name) => {
    const rawOp = opcodes[name];
    return usedRawOpcodes.has(rawOp) || name === "CLOSURE";
  }).length;
  const numJunkEntries = T.intenseVm ? 55 + Math.floor(Math.random() * 20) : 6 + Math.floor(Math.random() * 5);
  const totalEntries = realHandlerCount + numDummies + numJunkEntries;
  const idxRange = Math.max(totalEntries * 4, 200);
  const idxOffset = 10 + Math.floor(Math.random() * 50);
  const idxPool = [];
  const seenIdx = /* @__PURE__ */ new Set();
  while (idxPool.length < totalEntries) {
    const candidate = idxOffset + Math.floor(Math.random() * idxRange);
    if (!seenIdx.has(candidate)) {
      seenIdx.add(candidate);
      idxPool.push(candidate);
    }
  }
  for (let i = idxPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxPool[i], idxPool[j]] = [idxPool[j], idxPool[i]];
  }
  let poolCursor = 0;
  const nextHandlerIdx = () => idxPool[poolCursor++];
  for (const name of shuffledOpcodeNames) {
    const rawOp = opcodes[name];
    if (!usedRawOpcodes.has(rawOp) && name !== "CLOSURE") continue;
    const encodedOp = hashOp(encodeOpcode(rawOp, opcodeXorKey));
    const hIdx = nextHandlerIdx();
    const handlerVarRef = `${handlerTableVar}[${hIdx}]`;
    const handlerCode = genHandler(name);
    const confusionChance = T.intenseVm ? 0.9 : 0.6;
    const useConfusion = Math.random() < confusionChance;
    const pred = useConfusion ? genConfusionPredicate(ctVarName, confusionTable.size) : "";
    let finalHandler;
    if (pred) {
      const fnEnd = handlerCode.indexOf(")") + 1;
      finalHandler = `${handlerCode.substring(0, fnEnd)} ${pred}${handlerCode.substring(fnEnd)}`;
    } else {
      finalHandler = handlerCode;
    }
    {
      const fnEnd = finalHandler.indexOf(")") + 1;
      const sig = finalHandler.substring(0, fnEnd);
      const m = sig.match(/\(([^)]*)\)/);
      const params = m ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
      if (params.length >= 2) {
        const prologue = genHandlerPrologue(params.slice(0, Math.min(6, params.length)));
        finalHandler = `${sig} ${prologue}${finalHandler.substring(fnEnd)}`;
      }
    }
    if (T.intenseVm && Math.random() < 0.5) {
      const fnEnd = finalHandler.indexOf(")") + 1;
      const extra = genConfusionPredicate(ctVarName, confusionTable.size) + genOpaquePredicate();
      finalHandler = `${finalHandler.substring(0, fnEnd)} ${extra}${finalHandler.substring(fnEnd)}`;
    }
    const willInline = INLINE_OPCODES.has(name);
    if (!willInline && (T.intenseVm || Math.random() < 0.5)) {
      finalHandler = fragmentHandler(finalHandler, N.bx);
    }
    if (!useBinaryTree || !willInline) handlerLocals.push(`${handlerTableVar}[${hIdx}]=${handlerBuiltins.hideRemaining(finalHandler)};`);
    opcodeEntries.push({ encodedOp, handlerVar: handlerVarRef, handlerCode: finalHandler, opName: name });
  }
  for (let i = 0; i < numDummies; i++) {
    const hIdx = nextHandlerIdx();
    const d1 = shortName(), d2 = shortName(), d3 = shortName();
    const dummyBody = `${genConfusionPredicate(ctVarName, confusionTable.size)}${genJunkHandlerBody([d1, d2, d3], N.bx)}`;
    const params = Math.random() < 0.5 ? `${d1},${d1},${d2},${d3}` : `${d1},${d2},${d3}`;
    handlerLocals.push(`${handlerTableVar}[${hIdx}]=function(${params})${dummyBody}end;`);
  }
  const usedEncoded = new Set(opcodeEntries.map((e) => e.encodedOp));
  for (let i = 0; i < numJunkEntries; i++) {
    let enc = 0;
    let tries = 0;
    do {
      enc = hashOp(Math.floor(Math.random() * 256));
      tries++;
    } while (usedEncoded.has(enc) && tries < 50);
    if (usedEncoded.has(enc)) break;
    usedEncoded.add(enc);
    const hIdx = nextHandlerIdx();
    const a1 = shortName(), a2 = shortName(), a3 = shortName();
    const a4 = shortName(), a5 = shortName(), a6 = shortName(), a7 = shortName();
    const junkBody = `${genConfusionPredicate(ctVarName, confusionTable.size)}${genJunkHandlerBody([a1, a2, a3, a4, a5, a6, a7], N.bx)}`;
    const params = Math.random() < 0.5 ? `${a1},${a1},${a2},${a3},${a4},${a5},${a6},${a7}` : `${a1},${a2},${a3},${a4},${a5},${a6},${a7}`;
    handlerLocals.push(
      `${handlerTableVar}[${hIdx}]=function(${params})${junkBody} end;`
    );
    opcodeEntries.push({
      encodedOp: enc,
      handlerVar: `${handlerTableVar}[${hIdx}]`,
      handlerCode: ""
    });
  }
  const shuffledHandlerLocals = shuffle(handlerLocals);
  let dispatchCode;
  const nCi = shortName(), nRet = shortName(), nOk = shortName();
  if (useBinaryTree) {
    const argList = `${nCi}[2],${nCi}[3],${nCi}[4],${shortName()},${shortName()},${shortName()},${shortName()},${shortName()},${shortName()},${shortName()},${shortName()},${shortName()}`;
    const R2 = shortName(), K2 = shortName(), G2 = shortName(), P2 = shortName();
    const I2 = shortName(), rn2 = shortName(), dd2 = shortName(), cs2 = shortName(), UV2 = shortName();
    const nPC2 = shortName(), nRegs2 = shortName(), nKst2 = shortName(), nGlob2 = shortName(), nUV2 = shortName();
    const nIns2 = shortName();
    const dispatchShape = toggles.singleDispatchTree ? 0 : Math.floor(Math.random() * 3);
    const argVarsStr = `${nCi}[2],${nCi}[3],${nCi}[4],${nRegs2},${nKst2},${nGlob2},${nPC2},${nIns2},${N.run},${N.dd},${N.cst},${nUV2}`;
    const dispatchHelper = shortName();
    const ictx = { ci: nCi, R: nRegs2, K: nKst2, G: nGlob2, pc: nPC2, UV: nUV2 };
    let dispatchTree;
    if (dispatchShape === 0 || opcodeEntries.length < 6) {
      dispatchTree = buildBinaryDispatchTree(opcodeEntries, N.op, argVarsStr, nPC2, nRegs2, 0, dispatchHelper, ictx);
    } else {
      const K = dispatchShape === 1 ? 2 : 3;
      const buckets = [];
      for (let i = 0; i < K; i++) buckets.push([]);
      for (const e of opcodeEntries) buckets[e.encodedOp % K].push(e);
      const bVar = shortName();
      const parts = [`local ${bVar}=${N.op}%${K};`];
      for (let i = 0; i < K; i++) {
        const kw = i === 0 ? "if" : i === K - 1 ? "else" : "elseif";
        const cond = i === K - 1 ? "" : `${bVar}==${i} then `;
        const sub = buckets[i].length > 0 ? buildBinaryDispatchTree(buckets[i], N.op, argVarsStr, nPC2, nRegs2, 0, dispatchHelper, ictx) : "";
        if (i === K - 1) {
          parts.push(`${kw} ${sub} end `);
        } else {
          parts.push(`${kw} ${cond}${sub} `);
        }
      }
      dispatchTree = parts.join("");
    }
    dispatchCode = "BINARY_TREE_MODE";
    N._btPC = nPC2;
    N._btRegs = nRegs2;
    N._btKst = nKst2;
    N._btGlob = nGlob2;
    N._btUV = nUV2;
    N._btIns = nIns2;
    N._btDispatchTree = dispatchTree;
    N._btDispatchHelper = dispatchHelper;
    N._btDispatchHelperArgs = argVarsStr;
  } else {
    dispatchCode = "TABLE_MODE";
  }
  const dc1 = `do ${deadCode(1)} end;`;
  const dc2 = optLevel >= 2 ? `do ${deadCode(1)} end;` : "";
  const dc3 = "";
  const dc4 = "";
  const bb1 = `do ${binaryBlobDeadCode()} end;`;
  const bb2 = "";
  const bb3 = "";
  const nPos = shortName(), nCoff = shortName(), nArgs = shortName(), nPUV = shortName();
  const nNI = shortName(), nNC = shortName(), nNP = shortName(), nNPr = shortName(), nMR = shortName();
  const nNUV = shortName(), nIBase = shortName();
  const nII = shortName(), nOff = shortName();
  const nKI = shortName();
  const nArgI = shortName();
  const nArgIC = shortName();
  const nPC = useBinaryTree ? N._btPC : shortName();
  const nRegs = useBinaryTree ? N._btRegs : shortName();
  const nKst = useBinaryTree ? N._btKst : shortName();
  const nGlob = useBinaryTree ? N._btGlob : shortName();
  const nUV = useBinaryTree ? N._btUV : shortName();
  const nIns = useBinaryTree ? N._btIns : shortName();
  const nEnv = shortName();
  const nBinStr = shortName();
  const luaCharset = _curCharset;
  const nLut = shortName();
  const nDescr = shortName();
  const xb0 = binXorKey & 255;
  const xb1 = binXorKey >>> 8 & 255;
  const xb2 = binXorKey >>> 16 & 255;
  const xb3 = binXorKey >>> 24 & 255;
  const nXk = shortName();
  const vxb0 = _curValueXor & 255;
  const vxb1 = _curValueXor >>> 8 & 255;
  const vxb2 = _curValueXor >>> 16 & 255;
  const vxb3 = _curValueXor >>> 24 & 255;
  const nVxk = shortName();
  let binDecoderSetup = [
    `local ${nBinStr}=${T.directOutput ? compressedDataExpression(binaryDataStr.slice(1, -1)) : splitStringLiteral(binaryDataStr)};`,
    `local ${N.data}={};`,
    `local ${nLut}={};`,
    // Encode shuffled charset as obfuscated byte values
    `local _cs={${luaCharset.split("").map((c) => obfNumSafe(c.charCodeAt(0), 1)).join(",")}};`,
    `for _i=1,#_cs do ${nLut}[_cs[_i]]=_i-1 end;`,
    // Value XOR key (base) for undoing position-dependent encoding-time spread
    `local ${nVxk}=${obfNumSafe(_curValueXor >>> 0, 2)};`,
    `local _pmul=${obfNumSafe(POS_XOR_MULT >>> 0, 2)};`,
    `local _idx=0;`,
    `local _pos=1;while _pos<=#${nBinStr} do `,
    `local _first=${nLut}[string.byte(${nBinStr},_pos)];if _first==nil then error(nil,0) end;_pos=_pos+1;`,
    `local _v=0;local _b=1;local _w=2;local _mod=#_cs*(#_cs-1);`,
    `if _first==#_cs-1 then _w=5;_mod=4294967296 else _v=_first;_b=#_cs-1;_w=1 end;`,
    `for _j=1,_w do local _lv=${nLut}[string.byte(${nBinStr},_pos)];if _lv==nil then error(nil,0) end;_v=_v+_lv*_b;_b=_b*#_cs;_pos=_pos+1 end;`,
    // Position-dependent key reduced to the correct range for each word.
    `local _pk=${_ctx.bx}(${nVxk},(_idx*_pmul)%4294967296);`,
    `_v=(_v-_pk)%_mod;`,
    `_idx=_idx+1;`,
    `${N.data}[#${N.data}+1]=_v end;`
  ];
  if (T.directOutput) {
    const binaryWords = emitWordData(encryptedFlat, N.data, nBinStr);
    if (binaryWords.length < binDecoderSetup.join("").length) binDecoderSetup = [binaryWords];
  }
  let vmLoopDispatch;
  let dispatchSetup = "";
  if (useBinaryTree) {
    const dispatchTree = N._btDispatchTree;
    const dispatchHelper = N._btDispatchHelper;
    const dispatchHelperArgs = N._btDispatchHelperArgs;
    const rvVar = shortName();
    dispatchSetup = `local ${nCi};local ${dispatchHelper}=function(_H) local ${rvVar}=_H(${dispatchHelperArgs});if ${rvVar} then ${nPC}=${rvVar} end end;`;
    vmLoopDispatch = [
      // Opcode pre-resolved at cache-build time (field [5]) — no per-instruction
      // XOR/hash in the hot loop.
      `local ${N.op}=${nCi}[5];`,
      // Single closure captures the 12-arg tuple as upvalues so each dispatch
      // complex leaf selects a handler; one call follows the tree.
      `do local ${dispatchHelper}_selected;${dispatchTree} if ${dispatchHelper}_selected then ${dispatchHelper}(${dispatchHelper}_selected) end end;`,
      // Fallback: if no handler matched, skip (prevents nil cascade)
      `if ${nRegs}[${JSON.stringify(registerFields.halt)}] then `,
      `local _rv=${nRegs}[${JSON.stringify(registerFields.rv)}];`,
      `if _rv and _rv.n and _rv.n>0 then return unpack(_rv,1,_rv.n) end;`,
      `return `,
      `end;`
    ].join("");
  } else {
    const handlerTableSize = handlerSize;
    const dispatcherTable = new Array(handlerTableSize).fill(-1);
    const handlerOrder = [];
    for (let i = 0; i < handlerTableSize; i++) handlerOrder.push(i);
    for (let i = handlerOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [handlerOrder[i], handlerOrder[j]] = [handlerOrder[j], handlerOrder[i]];
    }
    const handlerIndexMap = /* @__PURE__ */ new Map();
    let nextHandler = 0;
    for (const name of opcodeNames) {
      const rawOp = opcodes[name];
      const encodedSlot = encodeOpcode(rawOp, opcodeXorKey);
      const actualHandler = handlerOrder[nextHandler++];
      dispatcherTable[encodedSlot] = actualHandler;
      handlerIndexMap.set(name, actualHandler);
    }
    for (let i = 0; i < handlerTableSize; i++) {
      if (dispatcherTable[i] === -1) {
        dispatcherTable[i] = handlerOrder[nextHandler < handlerOrder.length ? nextHandler++ : Math.floor(Math.random() * handlerTableSize)];
      }
    }
    const realHandlers = /* @__PURE__ */ new Map();
    for (const name of opcodeNames) {
      const idx = handlerIndexMap.get(name);
      realHandlers.set(idx, genHandler(name));
    }
    const handlerParts = [];
    for (let i = 0; i < handlerTableSize; i++) {
      if (realHandlers.has(i)) {
        handlerParts.push(`[${i}]=${realHandlers.get(i)}`);
      } else {
        const d1 = shortName(), d2 = shortName(), d3 = shortName();
        handlerParts.push(`[${i}]=function(${d1},${d2},${d3})${deadCode()}end`);
      }
    }
    const dispatcherParts = [];
    for (let i = 0; i < handlerTableSize; i++) {
      dispatcherParts.push(`[${i}]=${dispatcherTable[i]}`);
    }
    vmLoopDispatch = [
      `local ${N.op}=${nCi}[5];`,
      `local ${N.hIdx}=${N.dispatcher}[${N.op}];`,
      `local ${N.hf}=${N.hIdx}~=nil and ${N.handlers}[${N.hIdx}] or nil;`,
      `if ${N.hf} then `,
      `local ${nRet}=${N.hf}(${nCi}[2],${nCi}[3],${nCi}[4],${nRegs},${nKst},${nGlob},${nPC},${nIns},${N.run},${N.dd},${N.cst},${nUV});`,
      `if ${nRegs}[${JSON.stringify(registerFields.halt)}] then `,
      `local _rv=${nRegs}[${JSON.stringify(registerFields.rv)}];`,
      `if _rv and _rv.n and _rv.n>0 then return unpack(_rv,1,_rv.n) end;`,
      `return `,
      `end;`,
      `if ${nRet} then ${nPC}=${nRet} end `,
      `end `
    ].join("");
  }
  const bctx = makeBuiltinCtx();
  let octalPreamble = "";
  let octalGetterVar = "";
  if (optLevel >= 2 && stringConstants.length > 0) {
    const strTableVar = shortName();
    const octalResult = genOctalStringTable(stringConstants, strTableVar, N.bx, N.sc, T.gcFixes, bctx.ref("math.floor"), bctx.ref("string.byte"), bytecodeKey);
    octalPreamble = octalResult.preamble;
    octalGetterVar = octalResult.getterVar;
  }
  const sp = () => optLevel >= 2 ? genScatteredPad(12, 35) : "";
  const spLg = () => optLevel >= 3 ? genScatteredPad(24, 65) : "";
  const spStr = () => optLevel >= 2 ? genInlineLongStringPad(150, 600) : "";
  const spStrLg = () => optLevel >= 3 ? genInlineLongStringPad(300, 1e3) : "";
  const dJ = shortName();
  const dC = shortName();
  const dT = shortName();
  const dS = shortName();
  const dU = shortName();
  const dP = shortName();
  const dA = shortName();
  const fillIdx = shortName();
  const closureLocals = `local ${dJ},${dC},${dT},${dS},${dU},${dP},${dA},${N.bx},${N.bl},${N.br},${N.ba},${N.sc}=${bctx.ref("string.byte")},{},${bctx.ref("tostring")},${bctx.ref("string.sub")},${bctx.ref("string.gsub")},${bctx.ref("pcall")},${bctx.ref("string.char")},${bctx.ref("bit32.bxor")},${bctx.ref("bit32.lrotate")},${bctx.ref("bit32.rrotate")},${bctx.ref("bit32.band")},${bctx.ref("string.char")};for ${fillIdx}=0,255 do ${dC}[${fillIdx}]=${dA}(${fillIdx});end;`;
  const polyfills = [
    `${N.bx}=${N.bx} or (function(a,b) local r,p=0,1;for _=0,31 do local x,y=a%2,b%2;if x~=y then r=r+p end;a=(a-x)/2;b=(b-y)/2;p=p*2 end;return r end);`,
    `${N.bl}=${N.bl} or (function(x,n) n=n%32;if n==0 then return x end;local l=x*2^n;local r=${bctx.ref("math.floor")}(x/2^(32-n));return l%4294967296+r%4294967296 end);`,
    `${N.br}=${N.br} or (function(x,n) n=n%32;if n==0 then return x end;local r=${bctx.ref("math.floor")}(x/2^n);local l=x*2^(32-n);return (r+l)%4294967296 end);`,
    `${N.ba}=${N.ba} or (function(a,b) local r,p=0,1;for _=0,31 do if a%2==1 and b%2==1 then r=r+p end;a=(a-a%2)/2;b=(b-b%2)/2;p=p*2 end;return r end);`
  ].join("");
  const chkArg = shortName();
  const tsVar = shortName();
  const corruptVar = shortName();
  const nfBuiltins = [
    "pcall",
    "type",
    "string.byte",
    "string.char",
    "tostring",
    "tonumber",
    "math.floor",
    "math.min",
    "setmetatable",
    "rawget",
    "rawset",
    "bit32.bxor",
    "bit32.band",
    "bit32.lrotate",
    "bit32.rrotate",
    "table.concat",
    "coroutine.resume",
    "coroutine.wrap",
    "select",
    "unpack or table.unpack"
  ];
  const coreSetup = [
    `local unpack=${bctx.ref("unpack or table.unpack")};local ${N.sel}=${bctx.ref("select")};`,
    `local ${N.pk}=function(...) local _t={...};_t.n=${N.sel}('#',...);return _t end;`,
    // nf array — every entry resolved via encoded module indexing, no plaintext
    `local ${N.nf}={${nfBuiltins.map((b) => bctx.ref(b)).join(",")}};`,
    // Anti-hook check: validate ALL 20 cached functions.
    // Fingerprints compare capture-time stability only, not native appearance.
    // Set a failure flag consumed by the controlled VM error path.
    `local ${tsVar}=${bctx.ref("tostring")};local _fingerprints={};for _ci=1,20 do if ${N.nf}[_ci] then _fingerprints[_ci]=${tsVar}(${N.nf}[_ci]) end end;`,
    (() => {
      const identity = emitNativeIdentity(nfBuiltins.map((b) => bctx.ref(b)), N.nf);
      return identity.declarations + `local ${N.chk}=function(${chkArg}) if ${identity.mismatch} then ${N.nf}[21]=true end;`;
    })() + // Fingerprint check — ALL 20 refs
    ` local ${corruptVar}=false; for _ci=1,20 do if ${N.nf}[_ci] then local _s=${tsVar}(${N.nf}[_ci]); if _s~=_fingerprints[_ci] then ${corruptVar}=true end end end; if not ${corruptVar} then local _ok,_r=${N.nf}[1](${N.nf}[3],${encCharKey("")},1);if not _ok or _r~=nil then ${corruptVar}=true end; _ok,_r=${N.nf}[1](${N.nf}[7],1.5);if not _ok or _r~=1 then ${corruptVar}=true end; _ok,_r=${N.nf}[1](${N.nf}[8],3,7);if not _ok or _r~=3 then ${corruptVar}=true end end; if ${corruptVar} then ${N.nf}[21]=true end end;`,
    // Anti-tamper check block (Luraph signature: do ... for E,M in c do ... end end)
    `do local ${shortName()}={${Math.floor(Math.random() * 65535)},${dT}(${dC})}; for ${shortName()},${shortName()} in pairs(${dC}) do break;end;end;`
  ].join("");
  const fakeCodeBlocks = [];
  const shuffledFakeBlocks = shuffle(fakeCodeBlocks);
  const paddingBlocks = [];
  if (optLevel >= 2) {
    const padLen = optLevel >= 3 ? 100 + Math.floor(Math.random() * 200) : 30 + Math.floor(Math.random() * 70);
    paddingBlocks.push(`local ${shortName()}=${genNumericPad(padLen)};`);
    if (optLevel >= 3) {
      paddingBlocks.push(`local ${shortName()}=${genNumericPad(50 + Math.floor(Math.random() * 100))};`);
    }
  }
  const regionBytes = /* @__PURE__ */ new Map();
  const region = (name, code) => {
    if (audit) regionBytes.set(name, (regionBytes.get(name) ?? 0) + byteLength(code));
    return code;
  };
  const vmBodyClosure = [
    emitTransportVerifier(),
    // Octal string table preamble (Luraph-style)
    region("strings", octalPreamble),
    sp(),
    // Confusion table (Luraph-style k[] opaque predicates)
    confusionTable.code,
    ctAliasDecl,
    genConfusionPredicate(ctVarName, confusionTable.size),
    sp(),
    dc1,
    genConfusionPredicate(ctVarName, confusionTable.size),
    bb1,
    // Data array
    region("bytecode-and-decoder", binDecoderSetup.join("")),
    sp(),
    genConfusionPredicate(ctVarName, confusionTable.size),
    // Decrypt data array
    `local ${N.dd}={};`,
    `do local _s=${luauNum(seed)};for ${N.di}=1,#${N.data} do ${N.dd}[${N.di}]=${N.bx}(${N.data}[${N.di}],(_s+((${N.di}-1)*3))%256) end end;`,
    sp(),
    genConfusionPredicate(ctVarName, confusionTable.size),
    // Integrity verification
    `do local _ih=0;for _i=1,#${N.dd} do _ih=(_ih*31+${N.dd}[_i])%16777216 end;if _ih~=${integrityHash} then error("E_INTEGRITY",0) end end;`,
    `do if #${N.dd}~=${chkLen} then error("E_INTEGRITY",0) end;local _hs=0;local _hn=math.min(${chkHeadLen},#${N.dd});for _i=1,_hn do _hs=(_hs+${N.dd}[_i]*_i)%16777216 end;if _hs~=${chkHead} then error("E_INTEGRITY",0) end end;`,
    `do local _ts=0;local _st=math.max(1,#${N.dd}-63);for _i=_st,#${N.dd} do _ts=(_ts*17+${N.dd}[_i]+7)%16777216 end;if _ts~=${chkTail} then error("E_INTEGRITY",0) end end;`,
    `do local _xf=0;for _i=1,#${N.dd},7 do _xf=${N.bx}(_xf,${N.dd}[_i]) end;if _xf~=${chkFold} then error("E_INTEGRITY",0) end end;`,
    // Constants array — emit sparsely so long runs of default slots (empty
    // string placeholders, nil holes) don't produce huge `,0,0,0,...` blocks.
    // String slots get filled later by the octal decoder; nil slots stay nil
    // (unset). Only non-default entries are written here.
    region("numeric-and-other-constants", (() => {
      if (optLevel < 2) {
        return `local ${N.cst}={${constEntries.join(",")}};`;
      }
      const strSlots = new Set(stringSlotMap);
      const kv = [];
      for (let i = 0; i < constEntries.length; i++) {
        const slot = i + 1;
        const e = constEntries[i];
        if (e === "nil") continue;
        if (strSlots.has(slot) && e === "0") continue;
        kv.push(`[${rawLit(slot)}]=${e}`);
      }
      for (let i = kv.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [kv[i], kv[j]] = [kv[j], kv[i]];
      }
      return `local ${N.cst}={${kv.join(",")}};`;
    })()),
    `${checkedTransport(N.cst, allConstants.map((c, ci) => {
      if (typeof c === "string") return optLevel >= 2 ? null : [1, ...strToUtf8Bytes(c).map((b, i) => (b ^ (bytecodeKey + i * 7 + 5) % 256) & 255)];
      if (typeof c === "number" && Number.isInteger(c) && !Object.is(c, -0) && c >= -2147483648 && c <= 2147483647) return (c >>> 0 ^ (numberMaskSeed + (ci + 1) * numberMaskMul + bytecodeKey) % 16777216) >>> 0;
      return c;
    }), allConstants.length)};`,
    // Reconstruct only the numeric slots, using a key derived from decoded bytecode.
    ...maskedNumberIndices.length ? (() => {
      const idx = shortName(), val = shortName(), mask = shortName(), key = shortName();
      return [
        `do local ${key}=0;for _i=1,math.min(100,#${N.dd}) do ${key}=${N.bx}(${key},${N.dd}[_i]) end;${key}=${key}%256;for _,${idx} in ipairs(${checkedTransport(`{${maskedNumberIndices.map((i) => rawLit(i)).join(",")}}`, maskedNumberIndices)}) do local ${mask}=(${checkedTransport(rawLit(numberMaskSeed), numberMaskSeed)}+${idx}*${checkedTransport(rawLit(numberMaskMul), numberMaskMul)}+${key})%16777216;local ${val}=${N.bx}(${N.cst}[${idx}],${mask});${N.cst}[${idx}]=${val}>=2147483648 and ${val}-4294967296 or ${val} end end;`
      ];
    })() : [],
    sp(),
    // Resolve string constants from octal table
    ...optLevel >= 2 && stringConstants.length > 0 ? (() => {
      return [region("position-map", emitBestPositionDecoder(stringSlotMap, allConstants.length, N.cst, octalGetterVar, true))];
    })() : [
      `local _kd=0;for _i=1,math.min(100,#${N.dd}) do _kd=${N.bx}(_kd,${N.dd}[_i]) end;_kd=_kd%256;`,
      `do for _ci=1,#${N.cst} do local _v=${N.cst}[_ci];if type(_v)==${luraphStr("table")} and _v[1]==1 then ${byteStringAccumulator("_r").setup}for _j=2,#_v do ${byteStringAccumulator("_r").append(`${N.sc}(${N.bx}(_v[_j],(_kd+(_j-2)*7+5)%256)%256)`)} end;${byteStringAccumulator("_r").finish}${N.cst}[_ci]=_r end end end;`
    ],
    sp(),
    sp(),
    genConfusionPredicate(ctVarName, confusionTable.size),
    dc2,
    handlerBuiltins.preamble,
    // Handler table
    // _protoCache: per-prototype instruction cache with pre-resolved opcodes.
    // Trade-off: keeping decoded instructions in memory means an attacker with
    // heap access can extract bytecode once instead of intercepting each rebuild.
    // The cache lives for the VM instance lifetime (same as the closure).
    `${nativeFactories ? region("native-factories", `local _nativeFactories={${nativeFactories}};local _nativeChildren={${nativeChildren}};`) : ""}local ${policyName};${region("prototype-metadata-data", prototypeMetadata)}local ${handlerTableVar}={};local _protoCache={};`,
    ...useBinaryTree ? (() => {
      const result = [];
      let gap = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < shuffledHandlerLocals.length; i++) {
        result.push(region("handlers", shuffledHandlerLocals[i]));
        if ((i + 1) % gap === 0 && i < shuffledHandlerLocals.length - 1) {
          if (Math.random() < 0.4) result.push(sp());
          if (Math.random() < 0.3) result.push(genConfusionPredicate(ctVarName, confusionTable.size));
          gap = 4 + Math.floor(Math.random() * 3);
        }
      }
      return result;
    })() : [],
    sp(),
    genConfusionPredicate(ctVarName, confusionTable.size),
    // Environment detection — script-scope only (getfenv(1)/_ENV). Nunca getgenv()/getfenv(0).
    // Randomized surface so grep for a fixed pattern won't fingerprint the loader.
    (() => {
      const forms = [
        `do local ${nEnv}=_ENV or (type(getfenv)==${safeStr("function")} and getfenv(1)) or {};`,
        `do local ${nEnv}=(type(getfenv)==${safeStr("function")} and getfenv(1)) or _ENV or {};`,
        `do local ${nEnv}; if _ENV then ${nEnv}=_ENV elseif type(getfenv)==${safeStr("function")} then ${nEnv}=getfenv(1) else ${nEnv}={} end;`,
        `do local ${nEnv}=(function() if type(getfenv)==${safeStr("function")} then return getfenv(1) end return _ENV or {} end)();`
      ];
      return forms[Math.floor(Math.random() * forms.length)];
    })(),
    sp(),
    // Anti-hooking check at VM init
    `${N.chk}();`,
    // Debug library protections (toggle: debugLib / "Trap de Debug")
    ...T.debugLib ? [
      `do local _dh=debug and debug.sethook;if _dh then _dh(function() end,'',0) end end;`,
      `do local _di=debug and debug.getinfo;if _di then local _fi=_di(1);if _fi and _fi.source and #_fi.source<3 then ${genErrorTrap()} end end end;`
    ] : [],
    emitExecutionPolicy(policyName, nEnv, N.chk, T.robloxYield, diagnostic),
    // VM Run function
    `local function ${N.run}(${nPos},${nCoff},${nArgs},${nPUV},_create) local _layout=_prototypeMetadata[${nPos}];if _layout==nil then error("E_PROTO",0) end;`,
    `local ${nNI}=${N.dd}[${nPos}];`,
    `local ${nNC}=${N.dd}[${nPos}+1];`,
    `local ${nNP}=${N.dd}[${nPos}+2];`,
    `local ${nNPr}=${N.dd}[${nPos}+3];`,
    `local ${nMR}=${N.dd}[${nPos}+4];`,
    `local ${nNUV}=${N.dd}[${nPos}+5];`,
    `local ${nIBase}=${nPos}+6+${nNUV}*2;`,
    sp(),
    // Instruction cache: build once per prototype position, reuse across calls.
    // Pre-resolves the hashed opcode (field [5]) so the hot loop skips 3 XOR +
    // 2 MUL + 2 MOD per instruction. Only immutable data is cached; registers,
    // PC, upvalue cells and execution state remain per-invocation.
    ...nativeFactories ? [`if _create then if _nativeFactories[${nPos}] then local _native=_nativeFactories[${nPos}](${nPUV} or {},${nEnv},function(_i,_cells) local _pos=_nativeChildren[${nPos}][_i+1];return ${N.run}(_pos[1],_pos[2],nil,_cells,true) end);${diagnostic ? "return function(...) _lpyDiag.nativeCalls+=1;local _t=os.clock();local _r=table.pack(_native(...));_lpyDiag.nativeInclusiveSeconds+=os.clock()-_t;return unpack(_r,1,_r.n) end;" : "return _native;"} end;return function(...) ${diagnostic ? "_lpyDiag.vmClosureCalls+=1;" : ""}return ${N.run}(${nPos},${nCoff},${N.pk}(...),${nPUV}) end end;`] : [],
    ...diagnostic ? [`_lpyDiag.vmEntries+=1;`] : [],
    `local ${nIns}=_protoCache[${nPos}];`,
    `if not ${nIns} then ${diagnostic ? "local _prep=os.clock();" : ""}${nIns}={};for ${nII}=0,${nNI}-1 do local ${nOff}=${nIBase}+${nII}*4;local _raw=${N.dd}[${nOff}];local _pk=(${rawLit(perPcSeed)}+${nII}*${rawLit(perPcMul)}+${rawLit(perPcAdd)})%256;local _rb=${N.bx}(${N.bx}(_raw,_pk),${rawLit(opcodeXorKey)});local _op=${N.bx}((_rb*${rawLit(opHashMul)}+${rawLit(opHashAdd)})%${rawLit(opHashMod)},${rawLit(opHashSeed)});${nIns}[${nII}+1]={_raw,${N.dd}[${nOff}+1],${N.dd}[${nOff}+2],${N.dd}[${nOff}+3],_op} end;_protoCache[${nPos}]=${nIns};${diagnostic ? "_lpyDiag.protoSeconds+=os.clock()-_prep;_lpyDiag.prototypes+=1;" : ""} end;`,
    // Register proxy: __index reads captured registers from their upvalue box,
    // __newindex routes captured writes to the box and uncaptured to rawset.
    // For uncaptured registers after the first rawset, subsequent reads and
    // writes are direct (no metamethod) — the proxy is zero-cost for them.
    `local _boxes={};local ${nRegs}={[${JSON.stringify(registerFields.boxes)}]=_boxes};if ${toggles.forceRegisterProxy ? "true" : `_layout~=false`} then local _captured={};if _layout then for _,k in ipairs(_layout) do _captured[k]=true;_boxes[k]={} end end;setmetatable(${nRegs},{__index=function(t,k) local box=_boxes[k];if box then return box[1] end end,__newindex=function(t,k,v) if _captured[k] then _boxes[k][1]=v else rawset(t,k,v) end end}) end;`,
    `local ${nKst}={};`,
    `for ${nKI}=1,${nNC} do ${nKst}[${nKI}-1]=${N.cst}[${nCoff}+${nKI}] end;`,
    // Globals
    ...T.hardcodeGlobals ? [
      `local ${nGlob}={};for _gk,_gv in pairs(${nEnv}) do ${nGlob}[_gk]=_gv end;`
    ] : [
      `local ${nGlob}=${nEnv};`
    ],
    `local ${nUV}=${nPUV} or {};`,
    `local ${nArgIC}=${nArgs} and (${nArgs}.n or #${nArgs}) or 0;`,
    `if ${nArgs} then for ${nArgI}=1,math.min(${nArgIC},${nNP}) do ${nRegs}[${nArgI}-1]=${nArgs}[${nArgI}] end end;`,
    `if ${nArgIC}>${nNP} then local _va={};for ${nArgI}=${nNP}+1,${nArgIC} do _va[${nArgI}-${nNP}]=${nArgs}[${nArgI}] end;${nRegs}[${JSON.stringify(registerFields.va)}]=_va;${nRegs}[${JSON.stringify(registerFields.vac)}]=${nArgIC}-${nNP} else ${nRegs}[${JSON.stringify(registerFields.va)}]=nil;${nRegs}[${JSON.stringify(registerFields.vac)}]=0 end;`,
    `local ${nPC}=1;`,
    dc4,
    // Diagnostics only: explicit instruction limit per invocation.
    // When enabled, exceeding the limit raises an error instead of silently
    // breaking — silent truncation hides bugs and can corrupt program state.
    // The counter is never emitted by the production entry point, saving one increment
    // and one comparison per instruction in the hot loop.
    ...T.instructionLimit ? [
      `local _vm_icount=0;`
    ] : [],
    `local _state=${policyName}.${T.robloxYield ? "enter" : "get"}();`,
    ...T.robloxYield ? [`local _ok,_result=pcall(function() return ${N.pk}((function() `] : [],
    region("dispatch-setup", dispatchSetup),
    // VM Loop (Phase 2: metamorphic loop shape, one of 3 equivalent forms)
    ...(() => {
      const shape = Math.floor(Math.random() * 3);
      const bodyMid = [
        `${useBinaryTree ? "" : "local "}${nCi}=${nIns}[${nPC}];`,
        `if not ${nCi} then break end;`,
        `if ${N.nf}[21] then error(${diagnostic ? '"VM integrity check failed"' : '"E_HOOK"'},0) end;`,
        // Shared counter: decrement _state.remaining per instruction, step at zero
        `_state.remaining=_state.remaining-1;if _state.remaining<=0 then _state.remaining=${VM_SAMPLE_INTERVAL};${policyName}.step(_state,${VM_SAMPLE_INTERVAL}) end;`,
        ...T.debugLib ? [`if debug and debug.getinfo then local _si=debug.getinfo(8);if _si then break end end;`] : [],
        ...T.instructionLimit ? [`_vm_icount=_vm_icount+1;if _vm_icount>5000000 then error("VM instruction limit exceeded (5000000 per invocation)",0) end;`] : [],
        ...diagnostic ? [`_lpyDiag.instructions+=1;_lpyDiag.opcodes[${nCi}[5]]=(_lpyDiag.opcodes[${nCi}[5]] or 0)+1;`] : [],
        `${nPC}=${nPC}+1;`,
        region("dispatch", vmLoopDispatch)
      ];
      if (shape === 0) {
        return [`repeat `, ...bodyMid, `until ${nPC}>#${nIns};`];
      } else if (shape === 1) {
        return [`while ${nPC}<=#${nIns} do `, ...bodyMid, `end;`];
      } else {
        return [`while true do `, ...bodyMid, `if ${nPC}>#${nIns} then break end;`, `end;`];
      }
    })(),
    ...T.robloxYield ? [`end)()) end);${policyName}.leave(_state);if not _ok then error(_result,0) end;return unpack(_result,1,_result.n);`] : [],
    `end;`,
    sp(),
    genConfusionPredicate(ctVarName, confusionTable.size),
    // Shared handlers/cache remain alive as long as escaped VM closures need them.
    // Entry point
    `${diagnostic ? "_lpyDiag.initSeconds=os.clock()-_lpyDiag.started;" : ""}${N.run}(1,0) end;`
  ].join("");
  const rawClosureBody = [
    closureLocals,
    polyfills,
    coreSetup,
    // Scatter fake blocks at the beginning
    ...shuffledFakeBlocks.slice(0, Math.floor(shuffledFakeBlocks.length / 2)),
    ...paddingBlocks,
    sp(),
    // Main VM body
    vmBodyClosure,
    // Remaining fake blocks after VM
    ...shuffledFakeBlocks.slice(Math.floor(shuffledFakeBlocks.length / 2))
  ].join("");
  const hiddenClosureBody = bctx.hideRemaining(rawClosureBody);
  const closureBody = bctx.preamble + hiddenClosureBody;
  const luraphKeys = ["F", "Xa", "i", "Aa", "BG", "K", "LG", "YF", "da", "_F", "X", "ra", "Za", "AG", "OF", "CG", "ta", "H", "XF", "kG", "XG", "c", "M", "Va", "sG", "FG", "ma", "Da", "Ja", "Ha", "oa", "xF", "kF", "lG", "Ka", "La", "Ma", "Na", "Oa", "Pa", "Qa", "Ra", "Sa", "Ta", "Ua", "Va", "Wa"];
  const shuffledKeys = [...luraphKeys].sort(() => Math.random() - 0.5);
  const stateKey = shuffledKeys.shift() || "b";
  const stateSelf = shortName();
  const stateTable = shortName();
  const stateValue = shortName();
  const stateMul = (Math.floor(Math.random() * 1048575) | 1) >>> 0;
  const stateAdd = Math.floor(Math.random() * 16777215) >>> 0;
  const stateSlot = 1 + Math.floor(Math.random() * 48);
  const stateEntry = `${stateKey}=function(${stateSelf})local ${stateTable}=${stateSelf}[0] or ${stateSelf};return function()local ${stateValue}=${stateTable}[${luauNum(stateSlot)}] or ${luauNum(1)};${stateValue}=(${stateValue}*${luauNum(stateMul)}+${luauNum(stateAdd)})%${luauNum(16777216)};${stateTable}[${luauNum(stateSlot)}]=${stateValue};end;end`;
  const decoyEntries = [];
  const wrapperCtx = makeBuiltinCtx();
  const numericApiPool = [
    "setmetatable",
    "getmetatable",
    "rawget",
    "rawset",
    "rawequal",
    "select",
    "pcall",
    "xpcall",
    "type",
    "tostring",
    "tonumber",
    "unpack or table.unpack",
    "math.floor",
    "math.min",
    "math.max",
    "math.abs",
    "math.huge",
    "string.byte",
    "string.char",
    "string.sub",
    "string.gsub",
    "string.rep",
    "string.find",
    "string.format",
    "string.len",
    "string.reverse",
    "table.insert",
    "table.remove",
    "table.concat",
    "table.unpack or unpack",
    "bit32.bxor",
    "bit32.band",
    "bit32.bor",
    "bit32.lshift",
    "bit32.rshift",
    "bit32.lrotate",
    "bit32.rrotate",
    "bit32.bnot",
    "coroutine.create",
    "coroutine.resume",
    "coroutine.yield",
    "coroutine.wrap",
    "coroutine.status",
    "coroutine.running"
  ];
  const shuffledApis = [...numericApiPool].sort(() => Math.random() - 0.5);
  const usedNumericKeys = /* @__PURE__ */ new Set();
  const pickNumericKey = () => {
    while (true) {
      const k = 1 + Math.floor(Math.random() * 250);
      if (!usedNumericKeys.has(k)) {
        usedNumericKeys.add(k);
        return k;
      }
    }
  };
  const numApiSlots = 10 + Math.floor(Math.random() * 8);
  for (let i = 0; i < numApiSlots && i < shuffledApis.length; i++) {
    decoyEntries.push(`[${pickNumericKey()}]=${wrapperCtx.ref(shuffledApis[i])}`);
  }
  const dispatchKey = "x";
  const selfVar = shortName();
  const varargsVar = "...";
  const methodBody = `local ${shortName()}=${selfVar};${closureBody}`;
  const dispatchEntry = `${dispatchKey}=function(${selfVar},${varargsVar}) ${methodBody} end`;
  const allEntries = [stateEntry, ...decoyEntries];
  const insertPos = Math.max(1, Math.floor(allEntries.length / 2) + Math.floor(Math.random() * 3));
  allEntries.splice(insertPos, 0, dispatchEntry);
  const smtLocal = shortName();
  const smtReference = wrapperCtx.ref("setmetatable");
  let finalOutput = `${wrapperCtx.preamble}local ${smtLocal}=${smtReference};return ${smtLocal}({${allEntries.join(",")}},{}):${dispatchKey}(...);`;
  finalOutput = removeUnusedNumericTables(finalOutput).code;
  if (T.vmCompression && !T.directOutput) {
    const input = finalOutput;
    const DICT_CAP = 8463;
    let dict = /* @__PURE__ */ new Map();
    for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);
    let nextCode = 256;
    let w = "";
    const codes = [];
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      const wc = w + c;
      if (dict.has(wc)) {
        w = wc;
      } else {
        codes.push(dict.get(w));
        dict.set(wc, nextCode++);
        if (nextCode > DICT_CAP) {
          dict = /* @__PURE__ */ new Map();
          for (let j = 0; j < 256; j++) dict.set(String.fromCharCode(j), j);
          nextCode = 256;
        }
        w = c;
      }
    }
    if (w !== "") codes.push(dict.get(w));
    const B92 = shuffleAlphabet(" !#$%&()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~");
    const base = B92.length;
    const xorKey = Math.floor(Math.random() * 200) + 10;
    let encoded = "";
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i] & 65535;
      let c1 = Math.floor(code / base);
      let c2 = code % base;
      const k1 = (xorKey + i * 7 + 3) % base;
      const k2 = (xorKey + i * 11 + 5) % base;
      c1 = (c1 + k1) % base;
      c2 = (c2 + k2) % base;
      encoded += B92[c1] + B92[c2];
    }
    const vMaj = Math.floor(Math.random() * 9) + 1;
    const vMin = Math.floor(Math.random() * 9);
    const vPatch = Math.floor(Math.random() * 9e3) + 1e3;
    const header1 = `${vMaj}B${String(vMin).padStart(2, "0")}${vPatch}`;
    const header2 = `${Math.floor(Math.random() * 9) + 1}B${String(Math.floor(Math.random() * 99)).padStart(4, "0")}`;
    const vD = shortName(), vK = shortName(), vR = shortName();
    const vI = shortName(), vJ = shortName(), vC = shortName();
    const vDc = shortName(), vNc = shortName(), vEn = shortName();
    const vLut = shortName(), vCs = shortName();
    const vC1 = shortName(), vC2 = shortName(), vCode = shortName(), vW = shortName();
    const csBytes = [...B92].map((ch) => ch.charCodeAt(0));
    const csGroupSize = 8 + Math.floor(Math.random() * 5);
    const csGroups = [];
    for (let i = 0; i < csBytes.length; i += csGroupSize) {
      csGroups.push(`string.char(${csBytes.slice(i, i + csGroupSize).map((b) => luauNum(b)).join(",")})`);
    }
    const encodedBytes = [...encoded].map((c) => c.charCodeAt(0) & 255);
    const byteChunkSize = 60 + Math.floor(Math.random() * 20);
    const byteChunks = [];
    for (let i = 0; i < encodedBytes.length; i += byteChunkSize) {
      byteChunks.push(`string.char(${encodedBytes.slice(i, i + byteChunkSize).map((b) => luauNum(b)).join(",")})`);
    }
    const layer1 = `return(function(${shortName()},${shortName()})`;
    let layer2 = `local ${vCs}=${csGroups.join("..")};`;
    layer2 += `local ${vLut}={};`;
    layer2 += `local ${vI};`;
    layer2 += `for ${vI}=1,#${vCs} do ${vLut}[string.sub(${vCs},${vI},${vI})]=${vI}-1 end;`;
    layer2 += `local ${vD}=${byteChunks.join("..")};`;
    layer2 += `local ${vK}=${xorKey};`;
    let layer3 = `local ${vC}={};`;
    layer3 += `local ${vJ}=0;`;
    layer3 += `for ${vI}=1,#${vD},2 do `;
    layer3 += `local ${vC1}=(${vLut}[string.sub(${vD},${vI},${vI})] or 0);`;
    layer3 += `local ${vC2}=(${vLut}[string.sub(${vD},${vI}+1,${vI}+1)] or 0);`;
    layer3 += `${vC1}=(${vC1}-(${vK}+${vJ}*7+3))%${base};`;
    layer3 += `${vC2}=(${vC2}-(${vK}+${vJ}*11+5))%${base};`;
    layer3 += `${vC}[#${vC}+1]=${vC1}*${base}+${vC2};`;
    layer3 += `${vJ}=${vJ}+1 end;`;
    layer3 += `local ${vDc}={};for ${vI}=0,255 do ${vDc}[${vI}]=string.char(${vI}) end;`;
    layer3 += `local ${vNc}=256;`;
    layer3 += `local ${vW}=${vDc}[${vC}[1]];`;
    layer3 += `local ${vR}=${vW};`;
    layer3 += `for ${vI}=2,#${vC} do `;
    layer3 += `local ${vCode}=${vC}[${vI}];`;
    layer3 += `local ${vEn};`;
    layer3 += `if ${vDc}[${vCode}] then ${vEn}=${vDc}[${vCode}] `;
    layer3 += `elseif ${vCode}==${vNc} then ${vEn}=${vW}..string.sub(${vW},1,1) `;
    layer3 += `else error("",0) end;`;
    layer3 += `${vR}=${vR}..${vEn};`;
    layer3 += `${vDc}[${vNc}]=${vW}..string.sub(${vEn},1,1);${vNc}=${vNc}+1;`;
    layer3 += `if ${vNc}>${DICT_CAP} then ${vDc}={};for ${vJ}=0,255 do ${vDc}[${vJ}]=string.char(${vJ}) end;${vNc}=256 end;`;
    layer3 += `${vW}=${vEn} end;`;
    layer3 += `return(loadstring or load)(${vR})(...) end)`;
    finalOutput = layer1 + layer2 + layer3 + `("${header1}","${header2}");`;
  }
  popLuraphNames();
  finalOutput = dedupJunkStatements(finalOutput);
  if (toggles.legacyRuntimeLayout !== true && !(T.vmCompression && !T.directOutput)) finalOutput = distributeRuntimeHelpers(finalOutput, [N.pk, N.chk]);
  if (audit) {
    const rawBytes = byteLength(finalOutput);
    const accounted = Array.from(regionBytes.values()).reduce((a, b) => a + b, 0);
    regionBytes.set("bootstrap-checks-artificial-and-runtime-remainder", rawBytes - accounted);
    observeGeneration(() => audit({ regions: Array.from(regionBytes, ([name, bytes]) => ({ name, bytes })), rawBytes, captureSlots: Array.from(positions.keys()).reduce((total, p) => total + capturedRegisters(p).length, 0), prototypes: positions.size }));
  }
  return (diagnostic ? `local _lpyDiag=...;_lpyDiag.opcodes={};_lpyDiag.opcodeNames={${opcodeEntries.filter((e) => e.opName).map((e) => `[${e.encodedOp}]=${JSON.stringify(e.opName)}`).join(",")}};_lpyDiag.started=os.clock();` : "") + finalOutput;
}
function dedupJunkStatements(src) {
  const DEDUP_MAX = 3;
  const MAX_LEN = 220;
  const parts = [];
  const counts = /* @__PURE__ */ new Map();
  let i = 0;
  let buf = "";
  let depth = 0;
  let inStr = false;
  let strCh = "";
  while (i < src.length) {
    const c = src[i];
    if (!inStr && c === "[") {
      let eq = 0, j = i + 1;
      while (j < src.length && src[j] === "=") {
        eq++;
        j++;
      }
      if (j < src.length && src[j] === "[") {
        const closer = "]" + "=".repeat(eq) + "]";
        const end = src.indexOf(closer, j + 1);
        if (end >= 0) {
          buf += src.slice(i, end + closer.length);
          i = end + closer.length;
          continue;
        }
      }
    }
    if (inStr) {
      buf += c;
      if (c === "\\" && i + 1 < src.length) {
        buf += src[i + 1];
        i += 2;
        continue;
      }
      if (c === strCh) inStr = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      strCh = c;
      buf += c;
      i++;
      continue;
    }
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth = Math.max(0, depth - 1);
    buf += c;
    if (c === ";" && depth === 0) {
      const stmt = buf;
      buf = "";
      if (stmt.length <= MAX_LEN) {
        const trimmed = stmt.trimStart();
        const isJunkShape = /^(if |for |do |local )/.test(trimmed) || /=\s*[^;]*;$/.test(trimmed);
        if (isJunkShape) {
          const n = (counts.get(stmt) || 0) + 1;
          counts.set(stmt, n);
          if (n > DEDUP_MAX) {
            i++;
            continue;
          }
        }
      }
      parts.push(stmt);
    }
    i++;
  }
  if (buf.length) parts.push(buf);
  return parts.join("");
}
function validateLuaOutput(code) {
  if (/while\s+true\s+do\s+end/.test(code)) {
    return { valid: false, error: "Unbounded empty loop detected" };
  }
  if (/while\s*-\s*\([^)]*(?:==|~=|<=|>=|<|>)[^)]*\)/.test(code)) {
    return { valid: false, error: "Invalid unary minus on a boolean predicate" };
  }
  if (/(?:false\s*,\s*){8,}/.test(code)) {
    return { valid: false, error: "Repeated boolean sentinel sequence" };
  }
  const stack = [];
  const pairs = { "(": ")", "{": "}" };
  const closers = /* @__PURE__ */ new Set([")", "}"]);
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (!inString && ch === "[") {
      let eqCount = 0;
      let j = i + 1;
      while (j < code.length && code[j] === "=") {
        eqCount++;
        j++;
      }
      if (j < code.length && code[j] === "[") {
        const closer = "]" + "=".repeat(eqCount) + "]";
        const closeIdx = code.indexOf(closer, j + 1);
        if (closeIdx >= 0) {
          i = closeIdx + closer.length - 1;
          continue;
        }
      }
      continue;
    }
    if (!inString && ch === "]") continue;
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (pairs[ch]) {
      stack.push(pairs[ch]);
    } else if (closers.has(ch)) {
      if (stack.length === 0) return { valid: false, error: `Unexpected '${ch}' at position ${i}` };
      const expected = stack.pop();
      if (expected !== ch) return { valid: false, error: `Expected '${expected}' but found '${ch}' at position ${i}` };
    }
  }
  if (stack.length > 0) return { valid: false, error: `Unclosed delimiter, expected '${stack[stack.length - 1]}'` };
  if (inString) return { valid: false, error: "Unterminated string literal" };
  return { valid: true };
}
export {
  __vmCipherKey,
  __vmEncodeOpcode,
  __vmFlattenProto,
  __vmValidateInstructionLayout,
  __vmXorInstructionValue,
  generateVM,
  hideBuiltinNames,
  validateLuaOutput
};
