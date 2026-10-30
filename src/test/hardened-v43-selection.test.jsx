import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useObfuscationJob } from "../hooks/useObfuscationJob";
vi.mock("../lib/history-store", () => ({ saveJob: vi.fn().mockResolvedValue(void 0), reconcileInterrupted: vi.fn().mockResolvedValue(void 0), GENERATION_LOCK: "v43-selection" }));
class SelectionWorker {
  static instances = [];
  onmessage;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    SelectionWorker.instances.push(this);
  }
}
beforeEach(() => {
  SelectionWorker.instances = [];
  vi.stubGlobal("Worker", SelectionWorker);
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name, _options, callback) => callback({}) } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Level 3 hardened backend selection", () => {
  for (const rollback of ["", "0", "1", "true"]) for (const level of [1, 2, 3]) {
    it(`rollback ${JSON.stringify(rollback)} and Level ${level} select the required backend`, async () => {
      vi.stubEnv("VITE_LURAPY_LEGACY_LEVEL3", rollback);
      const { result } = renderHook(useObfuscationJob);
      const input = { code: "print(42)", fileName: "fixture.lua", platform: "luau", level, toggles: {} };
      let accepted = Promise.resolve(false);
      act(() => {
        accepted = result.current.start(input);
      });
      await waitFor(() => expect(SelectionWorker.instances).toHaveLength(1));
      const worker = SelectionWorker.instances[0];
      await act(async () => {
        worker.onmessage?.({ data: { type: "ready" } });
        await accepted;
      });
      const request = worker.postMessage.mock.calls[0]?.[0];
      expect(request?.options.optimizationLevel).toBe(level);
      expect(request?.options.hardenedVmVersion).toBe(rollback !== "1" && level === 3 ? 4 : void 0);
      await act(async () => result.current.cancel());
    });
  }
});
