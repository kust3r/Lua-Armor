function decimalBytes(value) {
  return '"' + Array.from(value, (c) => {
    const byte = c.charCodeAt(0);
    if (byte > 255) throw new Error("E_NAME_BYTE");
    return "\\" + byte.toString().padStart(3, "0");
  }).join("") + '"';
}
function emitNameDirectory(names, table, char) {
  if (names.some((name) => name.includes("\0"))) throw new Error("E_NAME_SEPARATOR");
  const data = names.join("\0") + (names.length ? "\0" : "");
  const encoded = Array.from(data, (c, i) => charCode(c, i));
  const packed = '"' + encoded.map((n) => "\\" + n.toString().padStart(3, "0")).join("") + '"';
  return `local ${table}=(function(_c) local _s=${packed};local _t={};local _v="";for _i=1,#_s do local _b=(string.byte(_s,_i)-((_i*29+71)%256))%256;if _b==0 then _t[#_t+1]=_v;_v="" else _v=_v.._c(_b) end end;return _t end)(${char});`;
}
function charCode(c, i) {
  const byte = c.charCodeAt(0);
  if (byte > 255) throw new Error("E_NAME_BYTE");
  return (byte + ((i + 1) * 29 + 71) % 256) % 256;
}
export {
  decimalBytes,
  emitNameDirectory
};
