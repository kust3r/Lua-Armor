import { shortName, pushLuraphNames, popLuraphNames } from "./names";
function shuffleString(s) {
  const a = [...s];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join("");
}
const PRIMES = { Q: 16381, G: 40961, N: 61441, L: 2147483647 };
function base85Encode(data, seed1, seed2) {
  let j = seed1, o = seed2;
  const out = [];
  const padLen = Math.ceil(data.length / 4) * 4;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  for (let i = 0; i < padded.length; i += 4) {
    let val = (padded[i] | padded[i + 1] << 8 | padded[i + 2] << 16 | padded[i + 3] << 24 >>> 0) >>> 0;
    if (j + o > 0) {
      j = (j * PRIMES.Q + PRIMES.G) % PRIMES.L;
      o = (o * PRIMES.Q + PRIMES.N) % PRIMES.L;
      const k0 = j & 255;
      const k1 = Math.floor(j / 16777216) * 2 + (j & 1) & 255;
      const k2 = o & 255;
      const k3 = Math.floor(o / 16777216) * 2 + (o & 1) & 255;
      const b0 = k0 - (val & 255) + 256 & 255;
      const b1 = k1 - (val >>> 8 & 255) + 256 & 255;
      const b2 = k2 - (val >>> 16 & 255) + 256 & 255;
      const b3 = k3 - (val >>> 24 & 255) + 256 & 255;
      val = (b0 | b1 << 8 | b2 << 16 | b3 << 24 >>> 0) >>> 0;
    }
    let rem = val;
    for (let d = 0; d < 5; d++) {
      out.push(String.fromCharCode(rem % 85 + 33));
      rem = Math.floor(rem / 85);
    }
  }
  return out.join("");
}
const DICT_CAP = 8463;
function lzwCompress(src) {
  let dict = /* @__PURE__ */ new Map();
  for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);
  let nextCode = 256;
  let w = "";
  const codes = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const wc = w + c;
    if (dict.has(wc)) {
      w = wc;
    } else {
      const code = dict.get(w);
      if (code === void 0) throw new Error("Invalid LZW dictionary state");
      codes.push(code);
      dict.set(wc, nextCode++);
      if (nextCode > DICT_CAP) {
        dict = /* @__PURE__ */ new Map();
        for (let j = 0; j < 256; j++) dict.set(String.fromCharCode(j), j);
        nextCode = 256;
      }
      w = c;
    }
  }
  if (w !== "") {
    const code = dict.get(w);
    if (code === void 0) throw new Error("Invalid LZW dictionary state");
    codes.push(code);
  }
  const buf = new Uint8Array(codes.length * 2);
  for (let i = 0; i < codes.length; i++) {
    buf[i * 2] = codes[i] >> 8 & 255;
    buf[i * 2 + 1] = codes[i] & 255;
  }
  return buf;
}
function wrapWithLZMA(vmSource) {
  pushLuraphNames();
  const compressed = lzwCompress(vmSource);
  const seed1 = Math.floor(Math.random() * 2e9) + 1;
  const seed2 = Math.floor(Math.random() * 2e9) + 1;
  const payload = base85Encode(compressed, seed1, seed2);
  const ALPHA_SRC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`";
  const ZL = shuffleString(ALPHA_SRC);
  const zlEscaped = ZL.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const encName = (name, gw, iw, zl) => {
    const indices = [...name].map((ch) => {
      const idx = ZL.indexOf(ch);
      return idx < 0 ? null : idx + 1;
    });
    if (indices.some((i) => i === null)) {
      return `string.char(${[...name].map((c) => c.charCodeAt(0)).join(",")})`;
    }
    return `${iw}(${indices.map((i) => `${gw}(${zl},${i})`).join(",")})`;
  };
  const usedIdx = /* @__PURE__ */ new Set();
  const ri = () => {
    let v;
    do {
      v = Math.floor(Math.random() * 90) + 10;
    } while (usedIdx.has(v));
    usedIdx.add(v);
    return v;
  };
  const I = {
    bufCreate: ri(),
    bufReadu8: ri(),
    tblMove: ri(),
    bufCopy: ri(),
    bufWriteu8: ri(),
    tblPack: ri(),
    tblCreate: ri(),
    strChar: ri(),
    strSub: ri(),
    tblConcat: ri()
  };
  const vB = shortName(), vT = shortName();
  const vU = shortName();
  const vGW = shortName(), vIW = shortName(), vZL = shortName(), vDM = shortName();
  const vCX = shortName(), vGC = shortName();
  const vQ = shortName(), vG = shortName(), vN = shortName(), vL = shortName();
  const vO = shortName(), vK = shortName();
  const vJ = shortName(), vM = shortName();
  const vE = shortName(), vC = shortName();
  const gR = shortName(), gS = shortName(), gP = shortName(), gTmp = shortName();
  const tR = shortName(), tS = shortName(), tP = shortName();
  const tRd = shortName(), tPos = shortName(), tDict = shortName();
  const tI = shortName(), tNc = shortName(), tOut = shortName();
  const tHi = shortName(), tLo = shortName(), tCode = shortName();
  const tW = shortName(), tEn = shortName(), tBuf = shortName();
  const tCh = shortName(), tSb = shortName();
  const jT = shortName(), jJ = shortName(), jO = shortName();
  const jP = shortName(), jQ2 = shortName(), jR2 = shortName(), jKM = shortName();
  const jS2 = shortName(), jU2 = shortName();
  const jX = shortName(), jY = shortName(), jZ = shortName(), jW = shortName();
  const jK0 = shortName(), jK1 = shortName(), jK2 = shortName(), jK3 = shortName();
  const pows = Array.from({ length: 33 }, (_, i) => Math.pow(2, i));
  let level = 0;
  while ((payload + "]" + "=".repeat(level) + "]").indexOf("]" + "=".repeat(level) + "]") !== payload.length) level++;
  const lsOpen = "[" + "=".repeat(level) + "[";
  const lsClose = "]" + "=".repeat(level) + "]";
  const o = [];
  o.push(`return(function(...)local ${vB},${vT}={`);
  o.push(`[${I.bufCreate}]=buffer.create,`);
  o.push(`[${I.bufReadu8}]=buffer.readu8,`);
  o.push(`[${I.tblMove}]=table.move,`);
  o.push(`[${I.bufCopy}]=buffer.copy,`);
  o.push(`[${I.bufWriteu8}]=buffer.writeu8,`);
  o.push(`[${I.tblPack}]=table.pack,`);
  o.push(`[${I.tblCreate}]=table.create,`);
  o.push(`[${I.strChar}]=string.char,`);
  o.push(`[${I.strSub}]=string.sub,`);
  o.push(`[${I.tblConcat}]=table.concat,`);
  o.push(`g=function(${gR},${gS},${gP},...)local ${gTmp}=${gR}[${I.tblPack}](...);${gR}[${I.tblMove}](${gTmp},1,${gTmp}[${gR}.n],${gP}+1,${gS});end,`);
  o.push(`n="n",`);
  o.push(`${vU}={[0]=${pows.join(",")}}},`);
  o.push(`function(${tR},${tS},${tP})`);
  o.push(`local ${tRd},${tCh},${tSb}=${tR}[${I.bufReadu8}],${tR}[${I.strChar}],${tR}[${I.strSub}];`);
  o.push(`local ${tPos},${tDict},${tNc},${tOut},${tBuf}=0,{},256,{},0;`);
  o.push(`for ${tI}=0,255 do ${tDict}[${tI}]=${tCh}(${tI}) end;`);
  o.push(`local ${tHi}=${tRd}(${tS},${tPos});${tPos}=${tPos}+1;`);
  o.push(`local ${tLo}=${tRd}(${tS},${tPos});${tPos}=${tPos}+1;`);
  o.push(`local ${tCode}=${tHi}*256+${tLo};`);
  o.push(`local ${tW}=${tDict}[${tCode}];`);
  o.push(`${tBuf}=${tBuf}+1;${tOut}[${tBuf}]=${tW};`);
  o.push(`while ${tPos}<${tP} do `);
  o.push(`${tHi}=${tRd}(${tS},${tPos});${tPos}=${tPos}+1;`);
  o.push(`${tLo}=${tRd}(${tS},${tPos});${tPos}=${tPos}+1;`);
  o.push(`${tCode}=${tHi}*256+${tLo};`);
  o.push(`local ${tEn};`);
  o.push(`if ${tDict}[${tCode}] then ${tEn}=${tDict}[${tCode}]`);
  o.push(` elseif ${tCode}==${tNc} then ${tEn}=${tW}..${tSb}(${tW},1,1)`);
  o.push(` else error("") end;`);
  o.push(`${tDict}[${tNc}]=${tW}..${tSb}(${tEn},1,1);`);
  o.push(`${tNc}=${tNc}+1;`);
  o.push(`if ${tNc}>${DICT_CAP} then ${tDict}={};`);
  o.push(`for ${tI}=0,255 do ${tDict}[${tI}]=${tCh}(${tI}) end;`);
  o.push(`${tNc}=256 end;`);
  o.push(`${tBuf}=${tBuf}+1;${tOut}[${tBuf}]=${tEn};`);
  o.push(`${tW}=${tEn} end;`);
  o.push(`return buffer.fromstring(${tR}[${I.tblConcat}](${tOut})) end `);
  o.push(`local ${vGW},${vIW},${vZL},${vDM}=string.byte,string.char,"${zlEscaped}",getfenv(1) `);
  const lsEnc = encName("loadstring", vGW, vIW, vZL);
  const cnEnc = encName("Lurapy", vGW, vIW, vZL);
  o.push(`local ${vCX},${vGC}=loadstring or load or ${vDM}[${lsEnc}] or ${vDM}[${encName("load", vGW, vIW, vZL)}],${cnEnc} `);
  o.push(`local ${vQ},${vG},${vN},${vL}=${PRIMES.Q},${PRIMES.G},${PRIMES.N},${PRIMES.L} `);
  o.push(`local ${vO},${vK}=33,{1,85,7225,614125,52200625}`);
  o.push(` local ${vJ}=function(${jT},${jJ},${jO})`);
  o.push(`local ${jP},${jQ2},${jR2},${jKM}={},0,1,0 `);
  o.push(`while ${jR2}+4<=#${jT} do `);
  o.push(`local ${jS2}=0 `);
  o.push(`for ${jU2}=0,4 do ${jS2}=(${vGW}(${jT},${jR2}+${jU2})-${vO})*${vK}[${jU2}+1]+${jS2} end `);
  o.push(`${jS2}=${jS2}%4294967296 `);
  o.push(`if ${jJ}+${jO}>0 then `);
  o.push(`${jJ}=(${jJ}*${vQ}+${vG})%${vL} `);
  o.push(`${jO}=(${jO}*${vQ}+${vN})%${vL} `);
  o.push(`local ${jX}=${jS2}%256 `);
  o.push(`local ${jY}=${jS2}//256%256 `);
  o.push(`local ${jZ}=${jS2}//65536%256 `);
  o.push(`local ${jW}=${jS2}//16777216%256 `);
  o.push(`local ${jK0}=${jJ}%256 `);
  o.push(`local ${jK1}=(${jJ}//16777216)*2+${jJ}%2 `);
  o.push(`local ${jK2}=${jO}%256 `);
  o.push(`local ${jK3}=(${jO}//16777216)*2+${jO}%2 `);
  o.push(`${jS2}=(${jK0}-${jX}+256)%256+(${jK1}-${jY}+256)%256*256+(${jK2}-${jZ}+256)%256*65536+(${jK3}-${jW}+256)%256*16777216 `);
  o.push(`${jKM}=(${jKM}*31+${jS2})%${vL} end `);
  o.push(`for ${jU2}=0,3 do ${jQ2}=${jQ2}+1;${jP}[${jQ2}]=${vIW}(${jS2}%256);${jS2}=${jS2}//256 end `);
  o.push(`${jR2}=${jR2}+5 end `);
  o.push(`return table.concat(${jP}),${jKM} end `);
  const payloadSize = compressed.length;
  o.push(`local ${vM}=buffer.tostring(${vT}(${vB},buffer.fromstring(${vJ}(${lsOpen}${payload}${lsClose},${seed1},${seed2})),${payloadSize})) `);
  o.push(`local ${vE},${vC}=pcall(${vCX},${vM},${vGC}) `);
  o.push(`if not ${vE} or type(${vC})~="function" then error("Lua compilation failed: "..tostring(${vC}),0) end `);
  o.push(`if setfenv then setfenv(${vC},${vDM}) end `);
  o.push(`return ${vC}(...) `);
  o.push(`end)(...)`);
  popLuraphNames();
  return o.join("");
}
export {
  wrapWithLZMA
};
