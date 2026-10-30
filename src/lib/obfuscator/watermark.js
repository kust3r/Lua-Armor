const ZW_CHARS = [
  "\u200B",
  // zero-width space
  "\u200C",
  // zero-width non-joiner
  "\u200D",
  // zero-width joiner
  "\uFEFF"
  // zero-width no-break space
];
function textToBits(text) {
  const bits = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    for (let b = 7; b >= 0; b--) {
      bits.push(code >> b & 1);
    }
  }
  return bits;
}
function bitsToText(bits) {
  let text = "";
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let code = 0;
    for (let b = 0; b < 8; b++) {
      code = code << 1 | bits[i + b];
    }
    if (code > 0) text += String.fromCharCode(code);
  }
  return text;
}
function encodeZeroWidth(watermark) {
  const bits = textToBits(watermark);
  let encoded = "";
  for (let i = 0; i < bits.length; i += 2) {
    const val = bits[i] << 1 | (bits[i + 1] || 0);
    encoded += ZW_CHARS[val];
  }
  return encoded;
}
function decodeZeroWidth(encoded) {
  const bits = [];
  for (const ch of encoded) {
    const idx = ZW_CHARS.indexOf(ch);
    if (idx >= 0) {
      bits.push(idx >> 1 & 1);
      bits.push(idx & 1);
    }
  }
  return bitsToText(bits);
}
function embedWatermark(luaSource, config) {
  let result = luaSource;
  const method = config.method || "all";
  if (method === "zerowidth" || method === "all") {
    result = embedZeroWidthWatermark(result, config.text);
  }
  if (method === "variable" || method === "all") {
    result = embedVariableWatermark(result, config.text);
  }
  if (method === "numeric" || method === "all") {
    result = embedNumericWatermark(result, config.text);
  }
  return result;
}
function embedZeroWidthWatermark(source, text) {
  const encoded = encodeZeroWidth(text);
  const headerEnd = source.indexOf("\n");
  if (headerEnd >= 0) {
    return source.substring(0, headerEnd) + encoded + source.substring(headerEnd);
  }
  return encoded + source;
}
function embedVariableWatermark(source, text) {
  const bits = textToBits(text);
  const vars = [];
  for (let i = 0; i < bits.length; i++) {
    const bit = bits[i];
    let name = "_wm" + i.toString(36);
    const charSum = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
    if (charSum % 2 !== bit) {
      name += "_";
    }
    vars.push(`local ${name}=${Math.floor(Math.random() * 1e3)}`);
  }
  const insertPoint = source.lastIndexOf("end)()");
  if (insertPoint > 0) {
    const deadBlock = ";do " + vars.join(";") + " end;";
    return source.substring(0, insertPoint) + deadBlock + source.substring(insertPoint);
  }
  return source;
}
function embedNumericWatermark(source, text) {
  const bits = textToBits(text);
  let bitIdx = 0;
  return source.replace(/local\s+\w+\s*=\s*(\d+)/g, (match, numStr) => {
    if (bitIdx >= bits.length) return match;
    const num = parseInt(numStr, 10);
    if (isNaN(num) || num < 2) return match;
    const bit = bits[bitIdx++];
    const adjusted = num & ~1 | bit;
    return match.replace(numStr, adjusted.toString());
  });
}
function extractWatermark(source) {
  const zwChars = [...source].filter((ch) => ZW_CHARS.includes(ch));
  if (zwChars.length >= 8) {
    const decoded = decodeZeroWidth(zwChars.join(""));
    if (decoded.length > 0) return decoded;
  }
  return null;
}
export {
  decodeZeroWidth,
  embedWatermark,
  encodeZeroWidth,
  extractWatermark
};
