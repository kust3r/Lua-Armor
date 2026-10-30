import { describe, expect, it } from "vitest";
import { tokenize } from "@/lib/obfuscator/lexer";
import { parse } from "@/lib/obfuscator/parser";
import { compile } from "@/lib/obfuscator/compiler";
import {
  __vmEncodeOpcode,
  __vmCipherKey,
  __vmFlattenProto,
  __vmValidateInstructionLayout,
  __vmXorInstructionValue
} from "@/lib/obfuscator/vm-codegen";
const robloxGuiScript = `
local s=Instance.new("ScreenGui")
local f=Instance.new("Frame")
local b=Instance.new("TextButton")
local t=Instance.new("TextLabel")
s.Parent=game.Players.LocalPlayer:WaitForChild("PlayerGui")
f.Parent=s
f.Size=UDim2.new(0,300,0,200)
f.Position=UDim2.new(0.5,-150,0.5,-100)
f.BackgroundColor3=Color3.fromRGB(20,20,20)
t.Parent=f
t.Size=UDim2.new(1,0,0,50)
t.Text="Antora"
t.TextColor3=Color3.fromRGB(255,255,255)
t.BackgroundTransparency=1
t.TextScaled=true
b.Parent=f
b.Size=UDim2.new(0.8,0,0,50)
b.Position=UDim2.new(0.1,0,0.5,0)
b.Text="Click"
b.TextScaled=true
b.BackgroundColor3=Color3.fromRGB(255,0,100)
b.TextColor3=Color3.fromRGB(255,255,255)
b.MouseButton1Click:Connect(function()
  t.Text="Clicked"
end)
`;
describe("vm bytecode encoding", () => {
  it("mant\xE9m o decode sim\xE9trico e o layout alinhado em blocos de 4", () => {
    const { proto, opcodes } = compile(parse(tokenize(robloxGuiScript)));
    expect(() => __vmValidateInstructionLayout(proto, new Set(Object.values(opcodes)))).not.toThrow();
    const flat = __vmFlattenProto(proto);
    const seed = 91357;
    flat.forEach((value, index) => {
      const encoded = __vmXorInstructionValue(value, seed, index);
      const decoded = __vmXorInstructionValue(encoded, seed, index);
      expect(decoded >>> 0).toBe(value >>> 0);
      expect(__vmCipherKey(seed, index)).toBeGreaterThanOrEqual(0);
      expect(__vmCipherKey(seed, index)).toBeLessThanOrEqual(255);
    });
    for (let i = 6; i < flat.length; i += 4) {
      expect(Number.isInteger(flat[i])).toBe(true);
    }
  });
  it("usa encoding de opcode sem colis\xE3o para todos os handlers", () => {
    const { opcodes } = compile(parse(tokenize(robloxGuiScript)));
    const opcodeValues = Object.values(opcodes);
    for (let xorKey = 0; xorKey < 256; xorKey++) {
      const encoded = opcodeValues.map((value) => __vmEncodeOpcode(value, xorKey));
      expect(new Set(encoded).size).toBe(encoded.length);
    }
  });
});
