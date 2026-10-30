import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { emitExecutionPolicy, VM_SAMPLE_INTERVAL, VM_CHECK_INTERVAL, VM_EXECUTION_BUDGET_SECONDS } from "@/lib/obfuscator/execution-policy";
const luau = process.env.LUAU_BIN ?? "/nix/store/95x1rdpz2jq2kn4vbwqk2nyl44g0f3wk-luau-0.703/bin/luau";
function run(body, authorized = true) {
  const dir = mkdtempSync(join(tmpdir(), "vm-policy-"));
  try {
    const path = join(dir, "case.luau");
    writeFileSync(path, `local now,waits,checks=0,0,0
local env={os={clock=function() return now end},task={wait=function() waits+=1;now+=100 end}}
local function check() checks+=1 end
local policy
${emitExecutionPolicy("policy", "env", "check", authorized)}
${body}`);
    return execFileSync(luau, [path], { encoding: "utf8", timeout: 15e3 }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const stepsPerCheck = Math.floor(VM_CHECK_INTERVAL / VM_SAMPLE_INTERVAL);
const budgetBelow = VM_EXECUTION_BUDGET_SECONDS - 1e-3;
const budgetAbove = VM_EXECUTION_BUDGET_SECONDS + 1e-3;
describe.skipIf(!existsSync(luau))("VM execution policy in emitted Luau", () => {
  it("does not add waits below the work budget", () => {
    expect(run(`local s=policy.get();now=${budgetBelow};policy.step(s,${VM_SAMPLE_INTERVAL});print(waits)`)).toBe("0");
  });
  it("yields after accumulated work exceeds budget, then excludes the suspension", () => {
    expect(run(`local s=policy.get();now=${budgetAbove};policy.step(s,${VM_SAMPLE_INTERVAL});policy.step(s,${VM_SAMPLE_INTERVAL});print(waits,s.spent)`)).toBe("1	0");
  });
  it("shares the budget across nested and repeated VM calls via shared state", () => {
    expect(run(`local s=policy.get();local function child() local t=policy.get();print(t==s);t.remaining=0;policy.step(t,${VM_SAMPLE_INTERVAL}) end;child();print(s.checks)`)).toBe(`true
${VM_SAMPLE_INTERVAL}`);
  });
  it("pause/resume excludes wait time from CPU budget", () => {
    const small = VM_EXECUTION_BUDGET_SECONDS * 0.3;
    expect(run(`local s=policy.get();now=${small};policy.pause(s);now+=100;policy.resume(s,true);now+=${small};policy.step(s,${VM_SAMPLE_INTERVAL});print(waits,s.spent<${VM_EXECUTION_BUDGET_SECONDS})`)).toBe("0	true");
  });
  it("runs integrity check after accumulated instructions reach the check interval", () => {
    const before = stepsPerCheck - 1;
    expect(run(`local s=policy.get();for i=1,${before} do policy.step(s,${VM_SAMPLE_INTERVAL}) end;print(checks);policy.step(s,${VM_SAMPLE_INTERVAL});print(checks);for i=1,${stepsPerCheck} do policy.step(s,${VM_SAMPLE_INTERVAL}) end;print(checks)`)).toBe("0\n1\n2");
  });
  it("isolates concurrent coroutines while sharing nested calls on each one", () => {
    expect(run(`local main=policy.get();local co=coroutine.create(function() local s=policy.get();print(s~=main);policy.step(s,${VM_SAMPLE_INTERVAL});coroutine.yield();print(s==policy.get()) end);assert(coroutine.resume(co));assert(coroutine.resume(co));print(main.checks)`)).toBe("true\ntrue\n0");
  });
  it("several short functions accumulate instructions until step fires", () => {
    const quarter = Math.floor(VM_SAMPLE_INTERVAL / 4);
    const remainder = VM_SAMPLE_INTERVAL - quarter * 4;
    expect(run(`local s=policy.get();s.remaining=${VM_SAMPLE_INTERVAL};for i=1,4 do for j=1,${quarter} do s.remaining=s.remaining-1;if s.remaining<=0 then s.remaining=${VM_SAMPLE_INTERVAL};policy.step(s,${VM_SAMPLE_INTERVAL}) end end end;print(s.checks)`)).toBe(`${remainder === 0 ? VM_SAMPLE_INTERVAL : "0"}`);
  });
  it("waitRef captures the task.wait function reference", () => {
    expect(run(`print(policy.waitRef==env.task.wait)`)).toBe("true");
  });
  it("unknown function time is conservatively counted as CPU work", () => {
    expect(run(`local s=policy.get();local f=function() now+=100 end;now=0;f();policy.step(s,${VM_SAMPLE_INTERVAL});print(waits)`)).toBe("1");
  });
  it("resume after known wait zeroes spent so short slices do not accumulate old budget", () => {
    const slice = VM_EXECUTION_BUDGET_SECONDS * 0.4;
    expect(run(`local s=policy.get()
for i=1,4 do
  now=now+${slice}
  policy.pause(s)
  now=now+100  -- known wait suspension
  policy.resume(s,true)
  policy.step(s,${VM_SAMPLE_INTERVAL})
end
print(waits,s.remaining)`)).toBe(`0	${VM_SAMPLE_INTERVAL - 4 * VM_SAMPLE_INTERVAL < 0 ? VM_SAMPLE_INTERVAL : VM_SAMPLE_INTERVAL}`);
  });
  it("resume preserves remaining and checks across known waits", () => {
    expect(run(`local s=policy.get()
s.remaining=100
s.checks=50000
policy.pause(s)
now=now+100
policy.resume(s,true)
print(s.remaining,s.checks)`)).toBe("100	50000");
  });
  it("does not clear spent for a known function that returned without suspension", () => {
    expect(run(`local s=policy.get();now=0.004;policy.pause(s);policy.resume(s,false);print(s.spent>0,s.remaining,s.checks)`)).toBe(`true	${VM_SAMPLE_INTERVAL}	0`);
  });
  it("does not reset on an error path without normal wait return", () => {
    expect(run(`local s=policy.get();now=0.004;policy.pause(s);local ok=pcall(function() now+=0.005;error('failed') end);policy.step(s,4096);print(ok,waits)`)).toBe("false	1");
  });
  it("normal confirmed suspension starts a fresh slice", () => {
    expect(run(`local s=policy.get();now=0.004;policy.pause(s);now+=50;policy.resume(s,true);now+=0.002;policy.step(s,4096);print(waits,s.spent<0.003)`)).toBe("0	true");
  });
  it("default-deny mode still verifies integrity without scheduler suspension", () => {
    expect(run(`local s=policy.get();for i=1,64 do policy.step(s,4096) end;print(checks,waits,s.remaining)`, false)).toBe("1	0	4096");
  });
  it("does not authorize child coroutines by yieldability", () => {
    expect(run(`local co=coroutine.create(function() local s=policy.enter();now=100;policy.step(s,4096);print(waits,s.authorized);coroutine.yield(nil,false);policy.leave(s);return 7 end);local function emit(...) print(select('#',...),...) end;emit(coroutine.resume(co));emit(coroutine.resume(co));print(coroutine.status(co))`)).toBe("0	false\n3	true	nil	false\n2	true	7\ndead");
  });
  it("excludes idle gaps without resetting short-call work or counters", () => {
    expect(run(`for i=1,4 do local s=policy.enter();s.remaining-=1;now+=0.001;policy.leave(s);now+=100 end;local s=policy.enter();print(s.depth,s.remaining,s.checks,s.spent>0.0039,s.spent<0.0041);policy.leave(s)`)).toBe("1	4092	0	true	true");
  });
  it("nested entry counts each elapsed interval only once", () => {
    expect(run(`local a=policy.enter();now+=0.001;local b=policy.enter();now+=0.002;policy.leave(b);now+=0.001;policy.leave(a);print(a==b,a.depth,a.spent>0.0039,a.spent<0.0041)`)).toBe("true	0	true	true");
  });
  it("failed known wait does not poison subsequent reentry", () => {
    expect(run(`local s=policy.enter();s.remaining=123;s.checks=50000;now=0.002;policy.pause(s);local ok=pcall(function() now+=0.001;error('wait failed',0) end);policy.leave(s);now+=100;local t=policy.enter();print(ok,t.depth,t.remaining,t.checks,t.spent>0.0029,t.spent<0.0031);policy.leave(t)`)).toBe("false	1	123	50000	true	true");
  });
});
