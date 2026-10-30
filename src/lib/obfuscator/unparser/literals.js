import { numberLiteral, quoteBytes, utf8Bytes } from "../literal-values";
function emitNumber(node) {
  return numberLiteral(node.value, node.exact);
}
function emitString(node, escapeAll = false) {
  const bytes = node.bytes && (node.valueAtParse === void 0 || node.value === node.valueAtParse) ? node.bytes : utf8Bytes(node.value);
  return escapeAll ? '"' + bytes.map((b) => "\\" + String(b).padStart(3, "0")).join("") + '"' : quoteBytes(bytes);
}
export {
  emitNumber,
  emitString
};
