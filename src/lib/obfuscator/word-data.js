import { compressedDataExpression } from "./data-compression";
function encodeWords(words) {
  const parts = [];
  for (const word of words) {
    if (!Number.isInteger(word) || word < 0 || word > 4294967295) throw new Error("Invalid VM word");
    let value = word;
    do {
      const byte = value % 128;
      value = Math.floor(value / 128);
      parts.push(String.fromCharCode(byte + (value ? 128 : 0)));
    } while (value);
  }
  return parts.join("");
}
function decodeWords(bytes, expected) {
  const words = [];
  let value = 0, factor = 1, width = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes.charCodeAt(i);
    if (byte > 255) throw new Error("Invalid VM word data");
    value += byte % 128 * factor;
    width++;
    if (width > 5 || value > 4294967295) throw new Error("Invalid VM word data");
    if (byte < 128) {
      if (width > 1 && byte === 0) throw new Error("Noncanonical VM word");
      words.push(value);
      if (words.length > expected) throw new Error("Invalid VM word count");
      value = 0;
      factor = 1;
      width = 0;
    } else factor *= 128;
  }
  if (width || words.length !== expected) throw new Error("Invalid VM word count");
  return words;
}
function emitWordData(words, destination, payload) {
  return `local ${payload}=${compressedDataExpression(encodeWords(words))};local ${destination}={};do local _v=0;local _factor=1;local _width=0;for _i=1,#${payload} do local _byte=string.byte(${payload},_i);_width+=1;_v+=(_byte%128)*_factor;if _width>5 or _v>4294967295 then error("",0) end;if _byte<128 then if _width>1 and _byte==0 then error("",0) end;${destination}[#${destination}+1]=_v;if #${destination}>${words.length} then error("",0) end;_v=0;_factor=1;_width=0 else _factor*=128 end end;if _width~=0 or #${destination}~=${words.length} then error("",0) end end;`;
}
export {
  decodeWords,
  emitWordData,
  encodeWords
};
