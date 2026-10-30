const integerEncoders = [
  // Addition split: n = a + b
  (n) => {
    const a = Math.floor(Math.random() * 1e3) + 1;
    return `(${n - a}+${a})`;
  },
  // Multiplication: n = a * b (if divisible)
  (n) => {
    if (n === 0) return "(0*1)";
    for (const d of [2, 3, 5, 7, 11, 13]) {
      if (n % d === 0) return `(${n / d}*${d})`;
    }
    const a = Math.floor(Math.random() * 500) + 1;
    return `(${n + a}-${a})`;
  },
  // Subtraction: n = a - b
  (n) => {
    const a = Math.floor(Math.random() * 2e3) + n + 1;
    return `(${a}-${a - n})`;
  },
  // Nested: n = (a + b) - c
  (n) => {
    const a = Math.floor(Math.random() * 500) + 1;
    const b = Math.floor(Math.random() * 500) + 1;
    return `((${n + a + b}-${a})-${b})`;
  },
  // XOR-based (bit32)
  (n) => {
    const k = Math.floor(Math.random() * 65535);
    return `bit32.bxor(${(n ^ k) >>> 0},${k})`;
  },
  // Function call wrapper
  (n) => {
    const a = Math.floor(Math.random() * 1e3) + 1;
    return `(function() return ${n + a}-${a} end)()`;
  },
  // Modular arithmetic: n = (a * b) % m + r
  (n) => {
    if (n <= 0) return `(${n + 1}-1)`;
    const m = n + Math.floor(Math.random() * 100) + 50;
    const remainder = n % m;
    return `(${n - remainder + remainder})`;
  },
  // Double negation
  (n) => {
    return `(-(-${n}))`;
  },
  // Floor division trick
  (n) => {
    const d = Math.floor(Math.random() * 5) + 2;
    return `(${n * d}/${d})`;
  }
];
const floatEncoders = [
  // Split into integer + decimal
  (n) => {
    const intPart = Math.floor(n);
    const fracPart = n - intPart;
    return `(${intPart}+${fracPart.toFixed(10)})`;
  },
  // Multiplication by reciprocal
  (n) => {
    const factor = Math.floor(Math.random() * 100) + 2;
    return `(${(n * factor).toFixed(10)}/${factor})`;
  },
  // Function wrapper
  (n) => {
    const offset = Math.random() * 100;
    return `(function() return ${(n + offset).toFixed(10)}-${offset.toFixed(10)} end)()`;
  }
];
function encodeNumber(n, depth = 1) {
  if (depth <= 0) return n.toString();
  if (Number.isInteger(n)) {
    const encoder = integerEncoders[Math.floor(Math.random() * integerEncoders.length)];
    return encoder(n);
  } else {
    const encoder = floatEncoders[Math.floor(Math.random() * floatEncoders.length)];
    return encoder(n);
  }
}
function encodeNumberDeep(n, maxDepth = 2) {
  if (maxDepth <= 0) return n.toString();
  if (!Number.isInteger(n)) {
    const encoder = floatEncoders[Math.floor(Math.random() * floatEncoders.length)];
    return encoder(n);
  }
  const r = Math.random();
  if (r < 0.4) {
    const a = Math.floor(Math.random() * 500) + 1;
    return `(${encodeNumberDeep(n + a, maxDepth - 1)}-${encodeNumberDeep(a, maxDepth - 1)})`;
  }
  if (r < 0.7) {
    const a = Math.floor(Math.random() * 500) + 1;
    return `(${encodeNumberDeep(n - a, maxDepth - 1)}+${encodeNumberDeep(a, maxDepth - 1)})`;
  }
  for (const d of [2, 3, 5, 7]) {
    if (n % d === 0 && n !== 0) {
      return `(${encodeNumberDeep(n / d, maxDepth - 1)}*${d})`;
    }
  }
  return encodeNumber(n, 0);
}
function encodeNumbersInSource(source, depth = 1) {
  let result = "";
  let i = 0;
  let inString = false;
  let stringChar = "";
  while (i < source.length) {
    const ch = source[i];
    if (inString) {
      result += ch;
      if (ch === "\\") {
        i++;
        if (i < source.length) result += source[i];
      } else if (ch === stringChar) inString = false;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      result += ch;
      i++;
      continue;
    }
    if (/\d/.test(ch) || ch === "." && i + 1 < source.length && /\d/.test(source[i + 1])) {
      if (result.length > 0 && /[a-zA-Z_]/.test(result[result.length - 1])) {
        result += ch;
        i++;
        continue;
      }
      let numStr = "";
      while (i < source.length && /[\d.eExX]/.test(source[i])) {
        numStr += source[i];
        i++;
      }
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 1 && Number.isInteger(num) && num < 1e5) {
        result += encodeNumber(num, depth);
      } else {
        result += numStr;
      }
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}
export {
  encodeNumber,
  encodeNumberDeep,
  encodeNumbersInSource
};
