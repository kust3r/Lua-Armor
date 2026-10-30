import { tokenize } from "./lexer";
import { parse } from "./parser";
import { astToLua } from "./unparser";
import { flattenControlFlow } from "./obfuscations/control-flow";
function regenerateSource(source, options = {}) {
  const ast = parse(tokenize(source, { comments: options.comments }));
  const transformed = options.flatten ? flattenControlFlow(ast) : ast;
  return astToLua(transformed, options);
}
export {
  regenerateSource
};
