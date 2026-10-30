import { describe, expect, it } from "vitest";
import { obfuscateWithReport } from "../lib/obfuscator/engine";
import { serializeDiagnostic } from "../lib/obfuscator/diagnostics";
import { describeGenerationFailure } from "../lib/error-messages";
function translated(source, platform = "roblox") {
  try {
    obfuscateWithReport(source, { code: source, platform, optimizationLevel: 2, toggles: {} });
    throw new Error("expected diagnostic");
  } catch (error) {
    const raw = error.message;
    return { raw, pt: describeGenerationFailure(raw, serializeDiagnostic(error)) };
  }
}
describe("engine diagnostics in Brazilian Portuguese", () => {
  it.each([
    ["1 + 1", "Erro de sintaxe na linha 1: express\xE3o inv\xE1lida."],
    ["print(1)\nlocal x = 1\nx + x", "Erro de sintaxe na linha 3: express\xE3o inv\xE1lida."],
    ['local s = "abc', "Erro de sintaxe na linha 1: string n\xE3o terminada."],
    ["local x: number = 1", "Erro de sintaxe na linha 1: anota\xE7\xE3o de tipo n\xE3o suportada."],
    ["local x = 1 | 2", "N\xE3o suportado na linha 1: opera\xE7\xF5es bitwise nativas n\xE3o suportadas neste modo."],
    ["if 1 then\nprint(2)", "Erro de sintaxe na linha 2: esperava 'end' e chegou ao fim do c\xF3digo."],
    ["local LPY_NO_VIRTUALIZE = 1", "Erro de sintaxe: LPY_NO_VIRTUALIZE \xE9 um nome reservado."],
    ["goto skip\n::skip::", "Erro de sintaxe na linha 1: sintaxe n\xE3o suportada: 'goto'."],
    ["local x = 1e999", "Erro de sintaxe na linha 1: n\xFAmero fora do intervalo suportado."]
  ])("%s is presented as %s", (source, expected) => {
    expect(translated(source).pt).toBe(expected);
  });
  it("keeps the engine diagnostic itself in English for the CLI and the audit trail", () => {
    expect(translated("1 + 1").raw).toBe("INVALID_STATEMENT [virtualize/roblox] ExprStmt: only calls are expression statements at 1:1");
  });
});
describe("failures without an engine diagnostic", () => {
  it("passes workspace messages through unchanged", () => {
    const message = "Outra aba est\xE1 gerando um arquivo. Aguarde terminar e tente de novo.";
    expect(describeGenerationFailure(message)).toBe(message);
  });
  it.each([["INVALID_THING [parse] something odd at 1:1"], [""]])("hides unlabelled engine text %s", (message) => {
    expect(describeGenerationFailure(message)).toBe("A ofusca\xE7\xE3o falhou. Tente de novo.");
  });
  it("never shows the raw engine spelling to the user", () => {
    const detail = { name: "LuaDiagnostic", message: "UNSUPPORTED_VM_ENV [virtualize/roblox] lexical _ENV is not implemented by this VM at root", code: "UNSUPPORTED_VM_ENV", phase: "virtualize", feature: "lexical _ENV is not implemented by this VM", target: "roblox", astPath: "root" };
    expect(describeGenerationFailure(detail.message, detail)).toBe("N\xE3o suportado: _ENV l\xE9xico n\xE3o \xE9 implementado por esta VM.");
  });
});
