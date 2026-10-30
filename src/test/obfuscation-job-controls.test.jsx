import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useObfuscationJob } from "../hooks/useObfuscationJob";
const history = vi.hoisted(() => ({ saveJob: vi.fn().mockResolvedValue(void 0), reconcileInterrupted: vi.fn().mockResolvedValue(void 0) }));
vi.mock("../lib/history-store", () => ({ ...history, GENERATION_LOCK: "test-generation" }));
class FakeWorker {
  static instances = [];
  onmessage;
  onerror;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  emit(data) {
    this.onmessage?.({ data });
  }
}
const input = { code: "print(42)", fileName: "script.lua", platform: "luau", level: 2, toggles: {} };
let locksHeld = 0;
beforeEach(() => {
  vi.clearAllMocks();
  FakeWorker.instances = [];
  locksHeld = 0;
  vi.stubGlobal("Worker", FakeWorker);
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name, _options, cb) => {
    locksHeld++;
    try {
      await cb({});
    } finally {
      locksHeld--;
    }
  } } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function acceptJob(result) {
  let started = Promise.resolve(false);
  act(() => {
    started = result.current.start(input);
  });
  await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
  const worker = FakeWorker.instances[0];
  await act(async () => {
    worker.emit({ type: "ready" });
    await started;
  });
  expect(result.current.state).toBe("running");
  return worker;
}
describe("generation controls", () => {
  it("terminates generation, persists interrupted metadata and releases the lock", async () => {
    const { result } = renderHook(useObfuscationJob);
    const worker = await acceptJob(result);
    await act(async () => {
      result.current.cancel();
    });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("error");
    expect(result.current.output).toBe("");
    expect(history.saveJob).toHaveBeenLastCalledWith(expect.objectContaining({ status: "interrupted" }));
    expect(locksHeld).toBe(0);
    await act(async () => {
      worker.emit({ type: "result", jobId: worker.postMessage.mock.calls[0][0].jobId, output: "late output", usedLevel: 2 });
    });
    expect(result.current.output).toBe("");
  });
  it("rejects validation retries instead of silently lowering the chosen intensity", async () => {
    const { result } = renderHook(useObfuscationJob);
    const worker = await acceptJob(result);
    await act(async () => {
      worker.emit({ type: "progress", jobId: worker.postMessage.mock.calls[0][0].jobId, event: { phase: 0, status: "running", attempt: 2 } });
    });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("error");
    expect(result.current.output).toBe("");
    expect(history.saveJob).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed" }));
    expect(locksHeld).toBe(0);
  });
  it("cancels while the worker is still loading, preserving an unaccepted submission", async () => {
    const { result } = renderHook(useObfuscationJob);
    let started = Promise.resolve(true);
    act(() => {
      started = result.current.start(input);
    });
    await waitFor(() => expect(FakeWorker.instances).toHaveLength(1));
    await act(async () => {
      result.current.cancel();
      expect(await started).toBe(false);
    });
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("idle");
    expect(locksHeld).toBe(0);
  });
});
