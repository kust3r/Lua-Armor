function xorEncrypt(str, key) {
  const result = [];
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    const k = key + i * 7 + 3 & 255;
    result.push((charCode ^ k) & 255);
  }
  return result;
}
function xorDecryptLua(arrayVar, keyVar, lenVar) {
  return [
    `local _r=""`,
    `for _i=1,${lenVar} do`,
    `  local _k=((${keyVar}+(_i-1)*7+3)%256)`,
    `  local _b=bit32.bxor(${arrayVar}[_i],_k)%256`,
    `  _r=_r..string.char(_b)`,
    `end`
  ].join(";");
}
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64Encode(str) {
  let result = "";
  const bytes = [];
  for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i));
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += B64_CHARS[b0 >> 2 & 63];
    result += B64_CHARS[(b0 << 4 | b1 >> 4) & 63];
    result += i + 1 < bytes.length ? B64_CHARS[(b1 << 2 | b2 >> 6) & 63] : "=";
    result += i + 2 < bytes.length ? B64_CHARS[b2 & 63] : "=";
  }
  return result;
}
function base64DecoderLua() {
  return [
    `local _b64="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"`,
    `local _lut={}`,
    `for _i=1,#_b64 do _lut[string.byte(_b64,_i)]=_i-1 end`,
    `local function _b64dec(_s)`,
    `  local _r=""`,
    `  for _i=1,#_s,4 do`,
    `    local _a=_lut[string.byte(_s,_i)] or 0`,
    `    local _b=_lut[string.byte(_s,_i+1)] or 0`,
    `    local _c=_lut[string.byte(_s,_i+2)] or 0`,
    `    local _d=_lut[string.byte(_s,_i+3)] or 0`,
    `    _r=_r..string.char((_a*4)+math.floor(_b/16))`,
    `    if string.sub(_s,_i+2,_i+2)~="=" then _r=_r..string.char((_b%16)*16+math.floor(_c/4)) end`,
    `    if string.sub(_s,_i+3,_i+3)~="=" then _r=_r..string.char((_c%4)*64+_d) end`,
    `  end`,
    `  return _r`,
    `end`
  ].join("\n");
}
function rotatingCipherEncrypt(str, key, multiplier = 13, offset = 37) {
  const result = [];
  let state = key;
  for (let i = 0; i < str.length; i++) {
    state = state * multiplier + offset & 65535;
    const k = state & 255;
    result.push((str.charCodeAt(i) ^ k) & 255);
  }
  return result;
}
function rotatingCipherDecryptLua(arrayVar, keyVal, lenVar, multiplier = 13, offset = 37) {
  return [
    `local _r=""`,
    `local _st=${keyVal}`,
    `for _i=1,${lenVar} do`,
    `  _st=((_st*${multiplier}+${offset})%65536)`,
    `  local _k=_st%256`,
    `  _r=_r..string.char(bit32.bxor(${arrayVar}[_i],_k)%256)`,
    `end`
  ].join(";");
}
function encryptStrings(source, config = { mode: "xor" }) {
  const key = config.key ?? Math.floor(Math.random() * 65e3) + 1;
  if (config.mode === "base64") {
    return encryptStringsBase64(source);
  }
  if (config.mode === "rotating") {
    return encryptStringsRotating(source, key);
  }
  return encryptStringsXor(source, key);
}
function encryptStringsXor(source, key) {
  let counter = 0;
  const decryptors = [];
  const result = source.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
    if (content.length < 3) return match;
    const encrypted = xorEncrypt(content, key);
    const varName = `_es${counter++}`;
    const arrStr = "{" + encrypted.join(",") + "}";
    decryptors.push(
      `local ${varName}=(function() local _a=${arrStr};local _r="";for _i=1,${encrypted.length} do local _k=((${key}+(_i-1)*7+3)%256);_r=_r..string.char(bit32.bxor(_a[_i],_k)%256) end;return _r end)()`
    );
    return varName;
  });
  if (decryptors.length === 0) return source;
  return decryptors.join(";") + ";" + result;
}
function encryptStringsBase64(source) {
  let counter = 0;
  const decryptors = [];
  const result = source.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
    if (content.length < 3) return match;
    const encoded = base64Encode(content);
    const varName = `_bs${counter++}`;
    decryptors.push(`local ${varName}=_b64dec("${encoded}")`);
    return varName;
  });
  if (decryptors.length === 0) return source;
  return base64DecoderLua() + "\n" + decryptors.join(";") + ";" + result;
}
function encryptStringsRotating(source, key) {
  let counter = 0;
  const decryptors = [];
  const mul = Math.floor(Math.random() * 50) + 7;
  const off = Math.floor(Math.random() * 100) + 11;
  const result = source.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
    if (content.length < 3) return match;
    const encrypted = rotatingCipherEncrypt(content, key, mul, off);
    const varName = `_rs${counter++}`;
    const arrStr = "{" + encrypted.join(",") + "}";
    decryptors.push(
      `local ${varName}=(function() local _a=${arrStr};local _r="";local _st=${key};for _i=1,${encrypted.length} do _st=((_st*${mul}+${off})%65536);local _k=_st%256;_r=_r..string.char(bit32.bxor(_a[_i],_k)%256) end;return _r end)()`
    );
    return varName;
  });
  if (decryptors.length === 0) return source;
  return decryptors.join(";") + ";" + result;
}
export {
  base64DecoderLua,
  base64Encode,
  encryptStrings,
  rotatingCipherDecryptLua,
  rotatingCipherEncrypt,
  xorDecryptLua,
  xorEncrypt
};
