import { describe, it, expect } from "vitest";
import { tokenize } from "@/lib/obfuscator/lexer";
import { parse } from "@/lib/obfuscator/parser";
import { compile } from "@/lib/obfuscator/compiler";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { obfuscate } from "@/lib/obfuscator/engine";
import { generateVM, validateLuaOutput } from "@/lib/obfuscator/vm-codegen";
const code = `
local Players=game:GetService("Players")
local LocalPlayer=Players.LocalPlayer
local Mouse=LocalPlayer:GetMouse()
local ScreenGui=Instance.new("ScreenGui")
ScreenGui.Name="ComplexTestGUI"
ScreenGui.Parent=LocalPlayer:WaitForChild("PlayerGui")
local Frame=Instance.new("Frame")
Frame.Size=UDim2.new(0,400,0,300)
Frame.Position=UDim2.new(0.5,-200,0.5,-150)
Frame.BackgroundColor3=Color3.fromRGB(25,25,25)
Frame.Parent=ScreenGui
local Button=Instance.new("TextButton")
Button.Size=UDim2.new(0,150,0,50)
Button.Position=UDim2.new(0.5,-75,0.5,-25)
Button.Text="EXECUTE"
Button.Parent=Frame
local Output=Instance.new("TextLabel")
Output.Size=UDim2.new(1,0,0,50)
Output.Position=UDim2.new(0,0,1,-50)
Output.Text="Idle"
Output.Parent=Frame
local mt=getrawmetatable(game)
local old=mt.__namecall
setreadonly(mt,false)
local calls={}
local function randomString()
    local s=""
    for i=1,math.random(5,15) do
        s=s..string.char(math.random(65,122))
    end
    return s
end
mt.__namecall=newcclosure(function(self,...)
    local method=getnamecallmethod()
    local args={...}
    table.insert(calls,{self,method,args})
    if method=="Kick" then return nil end
    return old(self,...)
end)
setreadonly(mt,true)
local proxy=setmetatable({},{
    __index=function(t,k)
        return function(...)
            return tostring(k)..":"..#({...})
        end
    end,
    __newindex=function(t,k,v) rawset(t,k,v) end
})
local function heavyCompute(n)
    local t={}
    for i=1,n do t[i]=math.sin(i)*math.random() end
    return t
end
local function deepTable()
    local t={}
    for i=1,50 do
        t[i]={}
        for j=1,20 do t[i][j]=randomString() end
    end
    return t
end
local function coroutineSpam()
    for i=1,20 do
        coroutine.wrap(function()
            local x=0
            for j=1,1000 do x=x+j end
        end)()
    end
end
local function remoteSpam()
    for _,v in pairs(game:GetDescendants()) do
        if v:IsA("RemoteEvent") then
            pcall(function() v:FireServer(randomString(),math.random(),{}) end)
        end
    end
end
local function hookTest()
    local fake=Instance.new("RemoteEvent")
    fake.Name="Fake"..randomString()
    fake.Parent=game
    pcall(function() fake:FireServer("test") end)
end
local function namecallTest()
    pcall(function() game:Kick("Intercept") end)
end
local function proxyTest()
    proxy[randomString()]=math.random()
    return proxy[randomString()](1,2,3)
end
local function stress()
    heavyCompute(5000)
    deepTable()
    coroutineSpam()
end
Button.MouseButton1Click:Connect(function()
    Output.Text="Running..."
    stress()
    remoteSpam()
    hookTest()
    namecallTest()
    local r=proxyTest()
    local sum=0
    for i=1,#calls do sum=sum+i end
    Output.Text="Done "..tostring(sum).." "..tostring(r)
end)
Mouse.KeyDown:Connect(function(k)
    if k=="x" then Frame.Visible=not Frame.Visible end
end)
task.spawn(function()
    while true do
        task.wait(1)
        for i=1,10 do randomString() end
    end
end)
`;
describe("complex Roblox script obfuscation", () => {
  const tokens = tokenize(code);
  const ast = parse(tokens);
  const { proto, opcodes } = compile(ast);
  it("tokenizes, parses and compiles without errors", () => {
    expect(tokens.length).toBeGreaterThan(100);
    expect(ast.body.length).toBeGreaterThan(10);
    expect(proto.instructions.length).toBeGreaterThan(50);
    expect(proto.protos.length).toBeGreaterThan(5);
  });
  it("namecall closure correctly forwards varargs (return old(self,...))", () => {
    const namecallProto = proto.protos.find(
      (p) => p.hasVararg && p.numParams === 1
    );
    expect(namecallProto).toBeDefined();
    const hasVarargB0 = namecallProto.instructions.some(
      (i) => i[0] === opcodes.VARARG && i[2] === 0
    );
    const hasCallB0 = namecallProto.instructions.some(
      (i) => i[0] === opcodes.CALL && i[2] === 0
    );
    expect(hasVarargB0).toBe(true);
    expect(hasCallB0).toBe(true);
  });
  it("generates valid VM output for levels 2 and 3", () => {
    for (const level of [2, 3]) {
      const vm = generateVM(proto, opcodes, level);
      const v = validateLuaOutput(vm);
      if (!v.valid) {
        console.log(`Level ${level} error: ${v.error}`);
      }
      expect(v.valid, `Level ${level}: ${v.error}`).toBe(true);
      expect(vm.length).toBeGreaterThan(1e3);
    }
  }, 6e4);
  it("generates VM output for level 1 without crashes", () => {
    const vm = generateVM(proto, opcodes, 1);
    expect(vm.length).toBeGreaterThan(1e3);
    let parens = 0, brackets = 0, braces = 0;
    let inStr = false, strCh = "";
    for (let i = 0; i < vm.length; i++) {
      const c = vm[i];
      if (!inStr && c === "[") {
        let eqCount = 0;
        let j = i + 1;
        while (j < vm.length && vm[j] === "=") {
          eqCount++;
          j++;
        }
        if (j < vm.length && vm[j] === "[") {
          const closer = "]" + "=".repeat(eqCount) + "]";
          const closeIdx = vm.indexOf(closer, j + 1);
          if (closeIdx >= 0) {
            i = closeIdx + closer.length - 1;
            continue;
          }
        }
      }
      if (inStr) {
        if (c === "\\") {
          i++;
          continue;
        }
        if (c === strCh) inStr = false;
        continue;
      }
      if (c === "'" || c === '"') {
        inStr = true;
        strCh = c;
        continue;
      }
      if (c === "(") parens++;
      else if (c === ")") parens--;
      if (c === "[") brackets++;
      else if (c === "]") brackets--;
      if (c === "{") braces++;
      else if (c === "}") braces--;
    }
    expect(parens).toBe(0);
    expect(brackets).toBe(0);
    expect(braces).toBe(0);
  });
  it("uses script-scope env only (never getgenv/getfenv(0))", () => {
    const vm = generateVM(proto, opcodes, 2);
    expect(vm).not.toContain("getgenv");
    expect(vm).not.toContain("getfenv(0)");
    expect(vm).toContain("getfenv(1)");
  }, 6e4);
  it("preserves variable-length argument counts with private register metadata", () => {
    const source = 'local function f(...) return ... end;local function g(...) print(select("#",...),...) end;g(f(1,nil,false,nil))';
    const vm = obfuscate(source, { code: source, platform: "luau", optimizationLevel: 2, toggles: {} });
    const dir = mkdtempSync(join(tmpdir(), "lpy-top-"));
    try {
      const file = join(dir, "case.luau");
      writeFileSync(file, vm);
      expect(execFileSync(process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau", [file], { encoding: "utf8" }).trim()).toBe("4	1	nil	false	nil");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 3e4);
  it.skipIf(!existsSync(process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau"))("preserves arithmetic errors and boolean types with inline-only emission", () => {
    const source = `local a,b=3,4;print(a+b,a*b,a-b);local ok=pcall(function() return true+a end);print(ok);local t,f=true,false;print(type(t),type(f),t,f)`;
    const vm = obfuscate(source, { code: source, platform: "luau", optimizationLevel: 2, toggles: {} });
    const dir = mkdtempSync(join(tmpdir(), "lpy-types-"));
    try {
      const file = join(dir, "case.luau");
      writeFileSync(file, vm);
      expect(execFileSync(process.env.LUAU_BIN ?? "/tmp/lurapy-runtimes/luau", [file], { encoding: "utf8" }).trim()).toBe("7	12	-1\nfalse\nboolean	boolean	true	false");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("KONTRA-style script: no original strings or numbers leak in output", () => {
    const kontraCode = `
local ScreenGui = Instance.new("ScreenGui")
local Frame = Instance.new("Frame")
local Label = Instance.new("TextLabel")
ScreenGui.Parent = game.Players.LocalPlayer:WaitForChild("PlayerGui")
Frame.Parent = ScreenGui
Frame.Size = UDim2.new(0, 300, 0, 200)
Frame.Position = UDim2.new(0.5, -150, 0.5, -100)
Frame.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
Frame.BorderSizePixel = 0
Label.Parent = Frame
Label.Size = UDim2.new(1, 0, 1, 0)
Label.BackgroundTransparency = 1
Label.Text = "KONTRA"
Label.TextColor3 = Color3.fromRGB(255, 255, 255)
Label.TextSize = 36
Label.Font = Enum.Font.GothamBold
Label.TextXAlignment = Enum.TextXAlignment.Center
Label.TextYAlignment = Enum.TextYAlignment.Center
`;
    const tokens2 = tokenize(kontraCode);
    const ast2 = parse(tokens2);
    const { proto: kProto, opcodes: kOpcodes } = compile(ast2);
    const vm = generateVM(kProto, kOpcodes, 3, { intenseVm: true });
    const v = validateLuaOutput(vm);
    expect(v.valid, `Validation: ${v.error}`).toBe(true);
    const forbidden = [
      "KONTRA",
      "ScreenGui",
      "TextLabel",
      "PlayerGui",
      "WaitForChild",
      "LocalPlayer",
      "GothamBold",
      "BackgroundColor3",
      "BackgroundTransparency",
      "TextXAlignment",
      "TextYAlignment",
      "BorderSizePixel"
    ];
    for (const s of forbidden) {
      expect(vm).not.toContain(s);
    }
  }, 6e4);
});
