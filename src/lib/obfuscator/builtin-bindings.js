import { tokenize } from "./lexer";
import { parse } from "./parser";
import { resolveBindings } from "./bindings";
import { walk } from "./ast-walk";
function replaceGlobalReferences(code, replacements, analyzed) {
  const prefix = analyzed ? "" : /^\s*function\s*\(/.test(code) ? "return " : "";
  const source = prefix + code;
  const tokens = analyzed?.tokens ?? tokenize(source);
  const ast = parse(tokens);
  const bindings = resolveBindings(ast);
  const indices = new Map(tokens.map((token, index) => [token.span?.start, index]));
  const edits = [];
  walk(ast, (node) => {
    if (node.kind !== "NameExpr" || bindings.uses.has(node) || !node.span) return;
    const index = indices.get(node.span.start);
    if (index === void 0) return;
    const token = tokens[index];
    if (!token.span) return;
    let key = node.name;
    let end = token.span.end;
    const dot = tokens[index + 1], field = tokens[index + 2];
    if (dot?.value === "." && field?.span && Object.prototype.hasOwnProperty.call(replacements, `${key}.${field.value}`)) {
      key += `.${field.value}`;
      end = field.span.end;
    }
    const replacement = replacements[key];
    if (replacement === void 0) return;
    edits.push({ start: token.span.start - prefix.length, end: end - prefix.length, value: typeof replacement === "function" ? replacement() : replacement });
  });
  edits.sort((a, b) => a.start - b.start);
  let cursor = 0;
  const result = [];
  for (const edit of edits) {
    if (edit.start < cursor) throw new Error("Overlapping builtin binding edits");
    result.push(code.slice(cursor, edit.start), edit.value);
    cursor = edit.end;
  }
  result.push(code.slice(cursor));
  return result.join("");
}
export {
  replaceGlobalReferences
};
