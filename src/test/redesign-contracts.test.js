import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { Blob as NodeBlob } from "node:buffer";
import { saveJob, clearAll, getJobs, getJobById, deleteJob, reconcileInterrupted } from "../lib/history-store";
import { applyPhase, emptyPhases, estimatedCompletion, supportedFile } from "../lib/job-contract";
import { obfuscateWithReport } from "../lib/obfuscator/engine";
import { DEFAULT_NAME_CONFIG } from "../lib/obfuscator/types";
const options = { code: "print(42)", platform: "luau", optimizationLevel: 2, toggles: { intenseVm: true }, nameConfig: { ...DEFAULT_NAME_CONFIG, seed: 42 } };
describe("real generation events", () => {
  it("does not change the deterministic output or consume randomness", () => {
    const events = [];
    const plain = obfuscateWithReport(options.code, options);
    const observed = obfuscateWithReport(options.code, options, (event) => events.push(event));
    expect(observed).toEqual(plain);
    expect(events.some((e) => e.phase === 0 && e.status === "done")).toBe(true);
    expect(events.some((e) => e.phase === 1 && e.status === "done")).toBe(true);
    expect(events.at(-1)).toEqual({ phase: 2, status: "done", attempt: 1 });
  });
  it("isolates observer failures from generation", () => {
    const result = obfuscateWithReport(options.code, options, () => {
      throw new Error("observer");
    });
    const plain = obfuscateWithReport(options.code, options);
    expect(result.output).toBe(plain.output);
    expect(result.metadata).toEqual(plain.metadata);
    expect(result.callbackErrors.length).toBeGreaterThan(0);
    expect(result.callbackErrors.every((e) => e === "observer")).toBe(true);
  });
  it("never completes the final stage for invalid source", () => {
    const events = [];
    expect(() => obfuscateWithReport("local =", options, (event) => events.push(event))).toThrow();
    expect(events.some((e) => e.phase === 2 && e.status === "done")).toBe(false);
  });
  it("reserves 100 percent for an available artifact", () => {
    const done = emptyPhases().map(() => ({ status: "done", progress: 100 }));
    expect(estimatedCompletion(done, false)).toBe(99);
    expect(estimatedCompletion(done, true)).toBe(100);
  });
  it("resets phase completions when an internal attempt starts again", () => {
    const done = emptyPhases().map(() => ({ status: "done", progress: 100 }));
    expect(applyPhase(done, { phase: 0, status: "running", attempt: 2 }).map((p) => p.status)).toEqual(["running", "pending", "pending"]);
  });
  it("accepts the three supported extensions, not arbitrary input", () => {
    for (const name of ["a.lua", "a.luau", "a.txt", "A.LUA"]) expect(supportedFile(name)).toBe(true);
    expect(supportedFile("a.exe")).toBe(false);
  });
});
describe("local history contracts", () => {
  beforeEach(async () => {
    await reconcileInterrupted();
    await clearAll();
  });
  const entry = (id, time = 1) => ({ id, createdAt: time, fileName: `${id}.lua`, status: "completed", platform: "luau", level: 2, outputSize: 3, artifact: new NodeBlob(["abc"]) });
  it("updates a job without duplication and reads back the exact artifact", async () => {
    await saveJob({ ...entry("a"), status: "running", artifact: void 0 });
    await saveJob(entry("a"));
    expect((await getJobs(6, 0)).items).toHaveLength(1);
    const stored = await getJobById("a");
    expect(stored?.artifact?.size).toBe(3);
    expect(stored).not.toHaveProperty("code");
    expect(stored).not.toHaveProperty("key");
  });
  it("paginates in a stable order and reports only real remaining records", async () => {
    for (const id of ["a", "b", "c"]) await saveJob(entry(id));
    const first = await getJobs(2, 0);
    expect(first.items.map((i) => i.id)).toEqual(["c", "b"]);
    expect(first.hasMore).toBe(true);
    const second = await getJobs(2, 2);
    expect(second.items.map((i) => i.id)).toEqual(["a"]);
    expect(second.hasMore).toBe(false);
  });
  it("deletes saved artifacts and records together", async () => {
    await saveJob(entry("a"));
    await deleteJob("a");
    expect(await getJobById("a")).toBeUndefined();
  });
  it("keeps active jobs when clearing history and reconciles them only under coordinator control", async () => {
    await saveJob({ ...entry("active"), status: "running" });
    await saveJob(entry("done"));
    await clearAll();
    expect((await getJobs(6, 0)).items.map((i) => i.id)).toEqual(["active"]);
    await reconcileInterrupted();
    expect((await getJobById("active"))?.status).toBe("interrupted");
  });
});
