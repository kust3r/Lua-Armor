const GENERIC = "A ofusca\xE7\xE3o falhou. Tente de novo.";
const ENGINE_SHAPED = /^[A-Z][A-Z0-9_]* \[[a-z]+(\/[a-z0-9]+)?\]/;
const CATEGORY = {
  INVALID_SOURCE: "Erro de sintaxe",
  EXPECTED_TOKEN: "Erro de sintaxe",
  UNEXPECTED_TOKEN: "Erro de sintaxe",
  INVALID_INTERPOLATION: "Erro de sintaxe",
  UNSUPPORTED_SYNTAX: "Erro de sintaxe",
  UNSUPPORTED_TYPES: "Erro de sintaxe",
  UNSUPPORTED_TYPE_FUNCTION: "Erro de sintaxe",
  UNSUPPORTED_CAST: "Erro de sintaxe",
  UNSUPPORTED_ATTRIBUTE: "Erro de sintaxe",
  INVALID_STATEMENT: "Erro de sintaxe",
  EXPRESSION_AS_STATEMENT: "Erro de sintaxe",
  INVALID_IDENTIFIER: "Erro de sintaxe",
  INVALID_LVALUE: "Erro de sintaxe",
  INVALID_ASSIGNMENT: "Erro de sintaxe",
  INVALID_OPERATOR: "Erro de sintaxe",
  INVALID_TABLE_FIELD: "Erro de sintaxe",
  INVALID_VARARG: "Erro de sintaxe",
  INVALID_LOOP_CONTROL: "Erro de sintaxe",
  INVALID_NODE: "Erro de sintaxe",
  UNKNOWN_NODE: "Erro de sintaxe",
  EMPTY_DECLARATION: "Erro de sintaxe",
  RETURN_POSITION: "Erro de sintaxe",
  BREAK_POSITION: "Erro de sintaxe",
  NUMERIC_OVERFLOW: "Erro de sintaxe",
  RESERVED_MACRO: "Erro de sintaxe",
  INVALID_MACRO: "Erro de sintaxe",
  UNSUPPORTED_FEATURE: "N\xE3o suportado",
  UNSUPPORTED_EXPRESSION: "N\xE3o suportado",
  UNSUPPORTED_STATEMENT: "N\xE3o suportado",
  UNSUPPORTED_OPERATOR: "N\xE3o suportado",
  UNSUPPORTED_DIRECTIVE: "N\xE3o suportado",
  UNSUPPORTED_VM_TARGET: "N\xE3o suportado",
  UNSUPPORTED_VM_ENV: "N\xE3o suportado",
  UNSUPPORTED_VM_INTEGER: "N\xE3o suportado",
  UNSUPPORTED_DYNAMIC_MACRO: "N\xE3o suportado",
  UNSUPPORTED_NATIVE_GLOBAL_SNAPSHOT: "N\xE3o suportado",
  UNSUPPORTED_NATIVE_INTROSPECTION: "N\xE3o suportado",
  NATIVE_BINDING: "N\xE3o suportado",
  NATIVE_UNSHARED_CAPTURE: "N\xE3o suportado",
  INVALID_BYTE: "Falha na ofusca\xE7\xE3o",
  INVALID_ARTIFACT: "Falha na ofusca\xE7\xE3o",
  COMMENTS_IN_COMPACT: "Falha na ofusca\xE7\xE3o"
};
const DETAIL = {
  INVALID_SOURCE: "c\xF3digo inv\xE1lido",
  EXPECTED_TOKEN: "token inesperado",
  UNEXPECTED_TOKEN: "token inesperado",
  INVALID_INTERPOLATION: "interpola\xE7\xE3o inv\xE1lida",
  UNSUPPORTED_SYNTAX: "sintaxe n\xE3o suportada",
  UNSUPPORTED_TYPES: "anota\xE7\xE3o de tipo n\xE3o suportada",
  UNSUPPORTED_TYPE_FUNCTION: "fun\xE7\xE3o de tipo do Luau n\xE3o suportada",
  UNSUPPORTED_CAST: "convers\xE3o de tipo n\xE3o suportada",
  UNSUPPORTED_ATTRIBUTE: "atributo de vari\xE1vel n\xE3o suportado",
  UNSUPPORTED_DIRECTIVE: "diretiva n\xE3o suportada",
  UNSUPPORTED_FEATURE: "recurso n\xE3o suportado",
  UNSUPPORTED_EXPRESSION: "express\xE3o n\xE3o suportada",
  UNSUPPORTED_STATEMENT: "instru\xE7\xE3o n\xE3o suportada",
  UNSUPPORTED_OPERATOR: "operador n\xE3o suportado",
  UNSUPPORTED_VM_TARGET: "plataforma n\xE3o suportada neste modo",
  UNSUPPORTED_VM_ENV: "_ENV n\xE3o \xE9 suportado por esta VM",
  UNSUPPORTED_VM_INTEGER: "n\xFAmero inteiro n\xE3o suportado pela VM",
  UNSUPPORTED_DYNAMIC_MACRO: "macro din\xE2mica exige modo de carregamento expl\xEDcito",
  UNSUPPORTED_NATIVE_GLOBAL_SNAPSHOT: "combina\xE7\xE3o de op\xE7\xF5es n\xE3o suportada",
  UNSUPPORTED_NATIVE_INTROSPECTION: "introspec\xE7\xE3o n\xE3o suportada",
  NATIVE_BINDING: "fun\xE7\xE3o nativa n\xE3o dispon\xEDvel",
  NATIVE_UNSHARED_CAPTURE: "captura compartilhada indispon\xEDvel",
  RESERVED_MACRO: "nome de macro reservado",
  INVALID_MACRO: "macro inv\xE1lida",
  INVALID_STATEMENT: "express\xE3o inv\xE1lida",
  EXPRESSION_AS_STATEMENT: "express\xE3o usada como instru\xE7\xE3o",
  INVALID_IDENTIFIER: "nome inv\xE1lido",
  INVALID_LVALUE: "alvo de atribui\xE7\xE3o inv\xE1lido",
  INVALID_ASSIGNMENT: "atribui\xE7\xE3o inv\xE1lida",
  INVALID_OPERATOR: "operador inv\xE1lido",
  INVALID_TABLE_FIELD: "campo de tabela inv\xE1lido",
  INVALID_VARARG: "use de ... fora de uma fun\xE7\xE3o vari\xE1dica",
  INVALID_LOOP_CONTROL: "break ou continue fora de um la\xE7o",
  INVALID_NODE: "estrutura do c\xF3digo inv\xE1lida",
  UNKNOWN_NODE: "constru\xE7\xE3o desconhecida",
  INVALID_BYTE: "byte inv\xE1lido",
  INVALID_ARTIFACT: "o arquivo gerado n\xE3o passou na verifica\xE7\xE3o",
  NUMERIC_OVERFLOW: "n\xFAmero fora do intervalo suportado",
  EMPTY_DECLARATION: "declara\xE7\xE3o sem nomes",
  RETURN_POSITION: "return precisa terminar o bloco",
  BREAK_POSITION: "break precisa terminar o bloco no Lua 5.1",
  COMMENTS_IN_COMPACT: "coment\xE1rios exigem modo leg\xEDvel"
};
const FEATURE = {
  "unterminated long string/comment": "string ou coment\xE1rio longo n\xE3o terminado",
  "unterminated interpolation escape": "escape de interpola\xE7\xE3o n\xE3o terminado",
  "unicode escape in interpolated string": "escape unicode em string interpolada",
  "newline in interpolated string": "quebra de linha em string interpolada",
  "unescaped closing brace in interpolated string": "chave de fechamento sem escape em string interpolada",
  "unterminated interpolated string": "string interpolada n\xE3o terminada",
  "invalid escape in interpolated string": "escape inv\xE1lido em string interpolada",
  number: "n\xFAmero inv\xE1lido",
  "invalid numeric suffix": "sufixo num\xE9rico inv\xE1lido",
  "newline in short string": "quebra de linha em string",
  string: "string inv\xE1lida",
  "unterminated escape": "escape n\xE3o terminado",
  "decimal escape exceeds 255": "escape decimal maior que 255",
  "hex escape": "escape hexadecimal inv\xE1lido",
  "unicode escape": "escape unicode inv\xE1lido",
  "unterminated string": "string n\xE3o terminada",
  "unterminated interpolation expression": "express\xE3o de interpola\xE7\xE3o n\xE3o terminada",
  "type annotation": "anota\xE7\xE3o de tipo n\xE3o suportada",
  "generic type parameters": "par\xE2metros de tipo gen\xE9rico n\xE3o suportados",
  "Luau type functions are not supported": "fun\xE7\xF5es de tipo do Luau n\xE3o suportadas",
  "type cast": "convers\xE3o de tipo n\xE3o suportada",
  "type cast or label": "convers\xE3o de tipo n\xE3o suportada",
  "variable attributes": "atributos de vari\xE1vel n\xE3o suportados",
  "expected literal segment": "interpola\xE7\xE3o espera um segmento literal",
  "LPY_NO_VIRTUALIZE requires one function": "LPY_NO_VIRTUALIZE precisa de exatamente uma fun\xE7\xE3o",
  "LPY_NO_VIRTUALIZE requires a static function": "LPY_NO_VIRTUALIZE precisa de uma fun\xE7\xE3o est\xE1tica",
  LPY_NO_VIRTUALIZE: "LPY_NO_VIRTUALIZE \xE9 um nome reservado",
  "interpolation requires Luau format conversion": "interpola\xE7\xE3o exige convers\xE3o para o formato Luau",
  "compound assignment": "atribui\xE7\xE3o composta n\xE3o suportada nesta plataforma",
  continue: "continue n\xE3o suportado nesta plataforma",
  "conditional expression": "express\xE3o condicional n\xE3o suportada nesta plataforma",
  "integer division": "divis\xE3o inteira n\xE3o suportada nesta plataforma",
  "native integer bitwise operations": "opera\xE7\xF5es bitwise nativas n\xE3o suportadas neste modo",
  "native integer bitwise operation": "opera\xE7\xE3o bitwise nativa n\xE3o suportada neste modo",
  "binary/underscored numeral": "numeral bin\xE1rio ou com sublinhado n\xE3o suportado nesta plataforma",
  "integer subtype is not represented by the VM": "a VM n\xE3o representa o subtype inteiro",
  "integer precision exceeds VM Number": "a precis\xE3o inteira excede o Number da VM",
  "lexical _ENV is not implemented by this VM": "_ENV l\xE9xico n\xE3o \xE9 implementado por esta VM",
  "lexical _ENV": "_ENV l\xE9xico n\xE3o \xE9 implementado por esta VM",
  "literal outside supported range": "n\xFAmero fora do intervalo suportado",
  "no names": "declara\xE7\xE3o sem nomes",
  "empty list": "lista de atribui\xE7\xE3o vazia",
  "only calls are expression statements": "express\xE3o inv\xE1lida",
  "return must end its block": "return precisa terminar o bloco",
  "break must end its block in Lua 5.1": "break precisa terminar o bloco no Lua 5.1",
  "comments require readable mode": "coment\xE1rios exigem modo leg\xEDvel",
  "missing node kind": "estrutura do c\xF3digo inv\xE1lida",
  "artifact must contain one physical line": "o arquivo gerado precisa ter uma linha",
  "forbidden plaintext literal": "literal proibido no arquivo gerado",
  "hexadecimal/unicode string escape": "escape hexadecimal ou unicode no arquivo gerado",
  "byte escape must contain three decimal digits": "escape de byte precisa de tr\xEAs d\xEDgitos decimais"
};
const QUOTED = /* @__PURE__ */ new Set([
  "INVALID_IDENTIFIER",
  "INVALID_OPERATOR",
  "UNKNOWN_NODE",
  "UNSUPPORTED_STATEMENT",
  "UNSUPPORTED_EXPRESSION",
  "NATIVE_BINDING",
  "NATIVE_UNSHARED_CAPTURE",
  "UNSUPPORTED_NATIVE_INTROSPECTION",
  "UNSUPPORTED_SYNTAX"
]);
function pattern(code, feature) {
  const expected = /^Expected '(.*)' got '(.*)'$/.exec(feature);
  if (expected) return expected[2] ? `esperava '${expected[1]}' e encontrou '${expected[2]}'` : `esperava '${expected[1]}' e chegou ao fim do c\xF3digo`;
  const directive = /^(--\S*|--!\S*): cannot transfer this directive to (\S+)/.exec(feature);
  if (directive) return `n\xE3o \xE9 poss\xEDvel transferir a diretiva '${directive[1]}' para ${directive[2]}`;
  const escape = /^unknown escape (.*)$/.exec(feature);
  if (escape) return `escape desconhecido '${escape[1]}'`;
  if (code === "UNEXPECTED_TOKEN") return `token inesperado '${feature}'`;
  return void 0;
}
function detail(code, feature) {
  const bare = feature.replace(/^[A-Za-z_][A-Za-z_0-9]*: /, "");
  const text = FEATURE[feature] ?? pattern(code, feature) ?? FEATURE[bare] ?? pattern(code, bare);
  if (text) return text;
  const base = DETAIL[code] ?? "n\xE3o foi poss\xEDvel processar o c\xF3digo";
  if (QUOTED.has(code) && bare) return `${base}: '${bare}'`;
  return base;
}
function describeGenerationFailure(message, diagnostic) {
  if (!diagnostic || typeof diagnostic.code !== "string" || !diagnostic.code) {
    return message && !ENGINE_SHAPED.test(message) ? message : GENERIC;
  }
  const category = CATEGORY[diagnostic.code] ?? "Falha na ofusca\xE7\xE3o";
  const line = diagnostic.span?.line;
  const where = Number.isFinite(line) ? ` na linha ${line}` : "";
  return `${category}${where}: ${detail(diagnostic.code, diagnostic.feature ?? "")}.`;
}
export {
  describeGenerationFailure
};
