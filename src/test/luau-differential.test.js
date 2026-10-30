import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { obfuscateWithReport } from "@/lib/obfuscator/engine";
const luau = process.env.LUAU_BIN ?? "/nix/store/95x1rdpz2jq2kn4vbwqk2nyl44g0f3wk-luau-0.703/bin/luau";
const cases = {
  hello: 'print("Hello")',
  loops: "local n=0; for i=1,8 do if i==6 then break end if i%2==0 then continue end n=n+i end print(n)",
  repeatContinue: "local n=0; repeat n+=1; if n<4 then continue end; print(n) until n>=4",
  genericContinue: "local n=0; for _,v in ipairs({1,2,3,4}) do if v%2==0 then continue end n+=v end print(n)",
  whileContinue: "local n=0; local total=0; while n<5 do n+=1; if n%2==0 then continue end total+=n end print(total)",
  closures: "local function outer(n) return function(m) return function() return n+m end end end print(outer(4)(7)())",
  protected: 'local ok,v=pcall(function() error("oops") end); print(ok); local ok2,val=xpcall(function() return 7 end,function(e) return e end); print(ok2,val)',
  metamethods: 'local t=setmetatable({}, {__index=function(_,k) return k end,__newindex=function(self,k,v) rawset(self,k,v*2) end,__call=function(self,k) return self[k] end}); t.n=8; print(t.n,t.m,t("n"))',
  coroutines: 'local c=coroutine.create(function() coroutine.yield("first"); return "last" end); local a,b=coroutine.resume(c);print(a,b);local d,e=coroutine.resume(c);print(d,e)',
  format: 'print(string.format("%s:%03d", "code", 8))',
  sort: 'local t={4,1,3,2};table.sort(t,function(a,b) return a>b end);print(table.concat(t,","))',
  service: 'game={GetService=function(_,name) return {Name=name} end};print(game:GetService("Players").Name)',
  returnsAndEffects: "local t={}; local function f() t.x=12; return 4,9 end; local a,b=f(); print(a,b,t.x)",
  metatableAccessOrder: `
    local trace={}
    local backing={}
    local t=setmetatable({}, {
      __index=function(_,key)
        trace[#trace+1]="read:"..key
        return backing[key]
      end,
      __newindex=function(_,key,value)
        trace[#trace+1]="write:"..key..":"..value
        backing[key]=value
      end,
    })
    local n=0
    while n<3 do
      n=n+1
      if t.count==nil then t.count=0 end
      if n==2 then t.count=t.count+10 else t.count=t.count+1 end
    end
    repeat t.count=t.count-1 until t.count<10
    print(table.concat(trace,"|"),backing.count)
  `,
  protectedErrorMessages: `
    local trace={}
    local function fail(message)
      trace[#trace+1]="before:"..message
      error(message,0)
    end
    local ok,value=pcall(function() fail("pcall failure") end)
    trace[#trace+1]="after:"..tostring(ok)..":"..tostring(value)
    local ok2,value2=xpcall(function() fail("xpcall failure") end,function(err)
      trace[#trace+1]="handler:"..tostring(err)
      return "handled:"..tostring(err)
    end)
    print(table.concat(trace,"|"),ok2,value2)
  `,
  coroutineIntermediateState: `
    local trace={}
    local co=coroutine.create(function(first)
      trace[#trace+1]="start:"..first
      local second=coroutine.yield("pause:"..first)
      trace[#trace+1]="resumed:"..second
      return first..":"..second
    end)
    local ok1,v1=coroutine.resume(co,"alpha")
    trace[#trace+1]="state:"..coroutine.status(co)
    local ok2,v2=coroutine.resume(co,"beta")
    print(table.concat(trace,"|"),ok1,v1,ok2,v2,coroutine.status(co))
  `,
  sharedTableMutation: `
    local shared={items={},count=0}
    local function add(label)
      shared.count=shared.count+1
      shared.items[#shared.items+1]=label..":"..shared.count
    end
    local function inspect()
      add("inspect")
      return shared.count,table.concat(shared.items,"|")
    end
    add("first")
    local count,snapshot=inspect()
    add("last")
    print(count,snapshot,shared.count,table.concat(shared.items,"|"))
  `,
  heavyMathRepeat: `
    local function calc()
      local r=0
      for i=1,12000 do
        local x=math.sin(i*0.013)
        local y=math.cos(i*0.027)
        local z=math.sqrt(i+1)
        r+=(x*y)/z
        local matriz=(x^2+y^2)/(z+1)
        r+=matriz*0.0001
      end
      return r
    end
    local seed=42
    local function nextInt(lo,hi)
      seed=(seed*1103515245+12345)%2147483648
      return lo+(seed%(hi-lo+1))
    end
    local result=""
    local word="KONTRA"
    for i=1,#word do
      local tries=0
      repeat
        calc()
        tries+=1
      until tries>=1 and nextInt(1,4)==1
      result=result..word:sub(i,i)
    end
    print(result)
  `
};
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), "lurapy-luau-"));
  try {
    const path = join(dir, "script.luau");
    writeFileSync(path, source + "\n", "utf8");
    return execFileSync(luau, [path], { encoding: "utf8", timeout: 15e3 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
describe.skipIf(!existsSync(luau))("offline Luau differential (observable effects)", () => {
  it("executes the complete VM with Roblox-style empty shared globals", () => {
    const source = "shared.result=marker; print(string.upper(shared.result)); print(_G==shared)";
    for (const level of [1, 2, 3]) {
      const result = obfuscateWithReport(source, {
        platform: "roblox",
        optimizationLevel: level,
        code: source,
        toggles: { robloxEnvLock: false, intenseVm: false, gcFixes: true }
      });
      const script = `local shared={}
local threadEnv=getfenv(0)
threadEnv.shared=shared;threadEnv._G=shared;threadEnv.marker="script environment"
local fn=assert(loadstring(${JSON.stringify(result.output)}))
fn()
assert(shared.result=="script environment")
threadEnv.shared=nil;threadEnv._G=_G;threadEnv.marker=nil`;
      expect(run(script)).toBe("SCRIPT ENVIRONMENT\ntrue\n");
    }
  }, 6e4);
  it("keeps behavior with GC fixes enabled", () => {
    const source = 'local a="hello"; local b="world"; print(a.." "..b); print(a.." "..b)';
    const plain = run(source);
    for (const level of [2, 3]) {
      const result = obfuscateWithReport(source, {
        platform: "luau",
        optimizationLevel: level,
        code: source,
        toggles: { intenseVm: true, gcFixes: true }
      });
      expect(run(result.output)).toBe(plain);
      expect(result.output).not.toContain(source);
    }
  }, 6e4);
  for (const [name, source] of Object.entries(cases)) {
    it(name, () => {
      const plain = run(source);
      for (const level of [1, 2, 3]) {
        const result = obfuscateWithReport(source, {
          platform: "luau",
          optimizationLevel: level,
          code: source,
          toggles: { intenseVm: false }
        });
        expect(result.usedLevel).toBeLessThanOrEqual(level);
        expect(run(result.output)).toBe(plain);
      }
    }, 6e4);
  }
  it("preserves fixed calls, callable tables, captured writes and resumed calls", () => {
    const source = `
      local shared=false
      local function set(value) shared=value; return nil,false,value end
      local function read() return shared end
      local a,b,c=set(7);print(a,b,c,read(),shared)
      local object=setmetatable({offset=4},{__call=function(self,a,b,c) print(select('#',a,b,c));return self.offset+a end})
      print(object(3,nil,false))
      local function count(...) return select('#',...) end
      print(count(),count(nil),count(false,nil),count(1,nil,false))
      local function values() return nil,false,9 end
      print(values());print(count(values()))
      local function recur(n) if n==0 then return 1 end return n*recur(n-1) end
      print(recur(6))
      local co=coroutine.create(function() local x=coroutine.yield(false);set(x);return read() end)
      print(coroutine.resume(co));print(coroutine.resume(co,12));print(shared)
    `;
    for (const level of [1, 2, 3]) {
      const result = obfuscateWithReport(source, { platform: "roblox", optimizationLevel: level, code: source, toggles: { intenseVm: true, robloxEnvLock: false } });
      expect(result.usedLevel).toBe(level);
      expect(run(result.output)).toBe(run(source));
    }
  }, 6e4);
  it("runs the full 12000-iteration KONTRA animation with Roblox scheduling and intense VM", () => {
    const source = cases.heavyMathRepeat.replace("        calc()", "        calc();task.wait(0.035)");
    const plain = run("local explicit=0;task={wait=function(delay) if delay==0.035 then explicit+=1 end end};" + source + ';print("SOURCE_WAITS",explicit)');
    for (const level of [1, 2, 3]) {
      const result = obfuscateWithReport(source, { platform: "roblox", optimizationLevel: level, code: source, toggles: { intenseVm: true, robloxEnvLock: false } });
      const wrapper = `local explicit=0;local threadEnv=getfenv(0)
threadEnv.task={wait=function(delay) if delay==0.035 then explicit+=1 end end}
local fn=assert(loadstring(${JSON.stringify(result.output)}));fn();print("SOURCE_WAITS",explicit)
threadEnv.task=nil`;
      expect(result.usedLevel).toBe(level);
      expect(run(wrapper)).toBe(plain);
    }
  }, 6e4);
  it("blocks Roblox output in a plain offline Luau sandbox without crashing", () => {
    const source = 'print("should not execute")';
    const result = obfuscateWithReport(source, {
      platform: "roblox",
      optimizationLevel: 3,
      code: source,
      toggles: {}
    });
    expect(run(result.output)).toBe("");
    expect(result.output).not.toMatch(/Players|ReplicatedStorage|RunService/);
  });
});
