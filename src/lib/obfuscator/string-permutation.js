const BASE = 85;
const fail = () => {
  throw new Error("Invalid string permutation");
};
function permutationWidth(maxIndex) {
  if (!Number.isSafeInteger(maxIndex) || maxIndex < 0) return fail();
  let width = 1, capacity = BASE;
  while (capacity <= maxIndex) {
    width++;
    capacity *= BASE;
  }
  return width;
}
function packStringPermutation(indices, alphabet) {
  if (alphabet.length !== BASE || new Set(alphabet).size !== BASE || [...alphabet].some((c) => c.charCodeAt(0) > 127)) return fail();
  const width = permutationWidth(indices.length);
  const seen = /* @__PURE__ */ new Set();
  const parts = [];
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 1 || index > indices.length || seen.has(index)) return fail();
    seen.add(index);
    let value = index;
    const digits = new Array(width);
    for (let i = width - 1; i >= 0; i--) {
      digits[i] = alphabet[value % BASE];
      value = Math.floor(value / BASE);
    }
    parts.push(digits.join(""));
  }
  return { data: parts.join(""), width };
}
function unpackStringPermutation(data, alphabet, count) {
  const width = permutationWidth(count);
  if (alphabet.length !== BASE || new Set(alphabet).size !== BASE || data.length !== count * width) return fail();
  const indices = [], seen = /* @__PURE__ */ new Set();
  for (let offset = 0; offset < data.length; offset += width) {
    let value = 0;
    for (let i = 0; i < width; i++) {
      const digit = alphabet.indexOf(data[offset + i]);
      if (digit < 0) return fail();
      value = value * BASE + digit;
    }
    if (value < 1 || value > count || seen.has(value)) return fail();
    seen.add(value);
    indices.push(value);
  }
  return indices;
}
function emitStringPermutationDecoder(count, names) {
  const width = permutationWidth(count);
  const { packed, table, permutation, cursor, digit, lut } = names;
  const terms = Array.from({ length: width }, (_, i) => {
    const lookup = `(${lut}[string.byte(${packed},${cursor}${i ? `+${i}` : ""})] or error('E_INTEGRITY',0))`;
    const factor = BASE ** (width - i - 1);
    return factor === 1 ? lookup : `${lookup}*${factor}`;
  });
  return `if #${packed}~=${count * width} or #${table}<${count} then error('E_INTEGRITY',0) end;local ${permutation}={};for ${cursor}=1,#${packed},${width} do local ${digit}=${terms.join("+")};if ${digit}<1 or ${digit}>${count} then error('E_INTEGRITY',0) end;${permutation}[#${permutation}+1]=${digit} end;`;
}
export {
  emitStringPermutationDecoder,
  packStringPermutation,
  permutationWidth,
  unpackStringPermutation
};
