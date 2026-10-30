import { gzipSync } from "fflate";
import { payloadName } from "./names";
const CHARSET = "!#$%&()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^abcdefghijklmnopqrstuvwxyz";
function encodeBase85(bytes) {
  const rem = bytes.length % 4;
  const padLen = rem === 0 ? bytes.length : bytes.length + (4 - rem);
  const padded = new Uint8Array(padLen);
  padded.set(bytes);
  let out = "";
  for (let i = 0; i < padded.length; i += 4) {
    let v = padded[i] * 16777216 + padded[i + 1] * 65536 + padded[i + 2] * 256 + padded[i + 3];
    const chars = new Array(5);
    for (let j = 4; j >= 0; j--) {
      chars[j] = CHARSET[v % 85];
      v = Math.floor(v / 85);
    }
    out += chars.join("");
  }
  return out;
}
function uniqName(used) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const n = payloadName();
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
  let i = 0;
  while (true) {
    const n = `_p${i++}`;
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
}
function buildLoader(payload) {
  const used = /* @__PURE__ */ new Set();
  const P = uniqName(used);
  const C = uniqName(used);
  const M = uniqName(used);
  const I = uniqName(used);
  const D = uniqName(used);
  const S = uniqName(used);
  const O = uniqName(used);
  const V = uniqName(used);
  const N = uniqName(used);
  const d = uniqName(used);
  const R = uniqName(used);
  const L = uniqName(used);
  const B = uniqName(used);
  const E = uniqName(used);
  const A = uniqName(used);
  const T = uniqName(used);
  return `return (function(${P},...) local ${C}=${JSON.stringify(CHARSET)} local ${M}={} for ${I}=1,#${C} do ${M}[${C}:sub(${I},${I})]=${I}-1 end local function ${D}(${S}) local ${O},${V},${N}={},0,0 for ${I}=1,#${S} do local ${d}=${M}[${S}:sub(${I},${I})] if ${d}==nil then return nil end ${V}=${V}*85+${d} ${N}=${N}+1 if ${N}==5 then ${O}[#${O}+1]=string.char(math.floor(${V}/16777216)%256,math.floor(${V}/65536)%256,math.floor(${V}/256)%256,${V}%256) ${V}=0 ${N}=0 end end return table.concat(${O}) end local ${R}=${D}(${P}) local ${L}=string.byte(${R},1)*16777216+string.byte(${R},2)*65536+string.byte(${R},3)*256+string.byte(${R},4) local ${B}=string.sub(${R},5,4+${L}) local ${E}=game:GetService(${JSON.stringify("EncodingService")}) local ${A}=Enum.CompressionAlgorithm.Gzip local ${T}=buffer.tostring(${E}:DecompressBuffer(buffer.fromstring(${B}),${A})) return (loadstring or load)(${T})(...) end)(${JSON.stringify(payload)},...)`;
}
function packLua(source) {
  const enc = new TextEncoder();
  const raw = enc.encode(source);
  const gz = gzipSync(raw, { level: 9 });
  const len = gz.length;
  const buf = new Uint8Array(4 + gz.length);
  buf[0] = len >>> 24 & 255;
  buf[1] = len >>> 16 & 255;
  buf[2] = len >>> 8 & 255;
  buf[3] = len & 255;
  buf.set(gz, 4);
  const payload = encodeBase85(buf);
  return buildLoader(payload);
}
export {
  packLua
};
