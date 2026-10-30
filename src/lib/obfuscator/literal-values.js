import { LuaDiagnostic } from "./diagnostics";
function utf8Bytes(value) {
  return Array.from(new TextEncoder().encode(value));
}
function bytesToBinary(bytes) {
  return bytes.map((b) => String.fromCharCode(b)).join("");
}
function binaryToBytes(value) {
  return Array.from(value, (c) => c.charCodeAt(0));
}
function quoteBytes(bytes) {
  return '"' + bytes.map((b) => {
    if (!Number.isInteger(b) || b < 0 || b > 255) throw new LuaDiagnostic("INVALID_BYTE", "emit", String(b));
    if (b === 34) return '\\"';
    if (b === 92) return "\\\\";
    return b >= 32 && b < 127 ? String.fromCharCode(b) : "\\" + String(b).padStart(3, "0");
  }).join("") + '"';
}
function numberLiteral(value, exact) {
  if (exact && Object.is(value, exact.valueAtParse)) return exact.lexeme;
  if (Object.is(value, -0)) return "(-0.0)";
  if (Number.isNaN(value)) return "(0/0)";
  if (value === Infinity) return "(1/0)";
  if (value === -Infinity) return "(-1/0)";
  return value < 0 ? `(${String(value)})` : String(value);
}
export {
  binaryToBytes,
  bytesToBinary,
  numberLiteral,
  quoteBytes,
  utf8Bytes
};
