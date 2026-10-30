import "fake-indexeddb/auto";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Blob as NodeBlob } from "node:buffer";
import { saveJob, getJobById } from "../lib/history-store";
import ObfuscationComposer from "../components/ObfuscationComposer";
vi.mock("../components/CodeEditor", () => ({ default: ({ value, onChange }) => <textarea aria-label="source" value={value} onChange={(e) => onChange(e.target.value)} /> }));
describe("retired option persistence", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });
  it("removes the legacy field when the history entry is next written while preserving artifact bytes", async () => {
    const artifact = new NodeBlob(["unchanged-artifact"]);
    const legacy = { id: "legacy-field", fileName: "test.lua", createdAt: 1, status: "completed", platform: "luau", level: 3, outputSize: 18, toggles: { disableLineInfo: true, gcFixes: true }, artifact };
    await new Promise((resolve, reject) => {
      const req = indexedDB.open("lurapy_history", 2);
      req.onupgradeneeded = () => {
        const s = req.result.createObjectStore("jobs", { keyPath: "id" });
        s.createIndex("order", ["createdAt", "id"]);
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result, tx = db.transaction("jobs", "readwrite");
        tx.objectStore("jobs").put(legacy);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
    const old = await getJobById("legacy-field");
    expect(old?.toggles).toHaveProperty("disableLineInfo", true);
    if (!old) throw new Error("Legacy entry was not loaded");
    await saveJob(old);
    const restored = await getJobById("legacy-field");
    expect(restored?.toggles).toEqual({ gcFixes: true });
    expect(restored?.artifact?.size).toBe(18);
    expect(await restored?.artifact?.text()).toBe("unchanged-artifact");
  });
  it("loads old preferences, ignores the field on submission and removes it on the next preference write", async () => {
    localStorage.setItem("lpy_toggles", JSON.stringify({ disableLineInfo: true, gcFixes: true }));
    const submit = vi.fn().mockResolvedValue(true);
    render(<ObfuscationComposer busy={false} onSubmit={submit} externalError="" />);
    fireEvent.change(screen.getByLabelText("source"), { target: { value: "print(42)" } });
    fireEvent.click(screen.getByRole("button", { name: "Ofuscar" }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Op\xE7\xF5es de ofusca\xE7\xE3o" })).toBeEnabled());
    expect(submit.mock.calls[0][0].toggles).not.toHaveProperty("disableLineInfo");
    vi.stubGlobal("PointerEvent", MouseEvent);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Op\xE7\xF5es de ofusca\xE7\xE3o" }), { button: 0, ctrlKey: false, pointerType: "mouse" });
    const option = await screen.findByRole("menuitemcheckbox", { name: /GC Fixes/i });
    fireEvent.click(option);
    expect(JSON.parse(localStorage.getItem("lpy_toggles") ?? "{}")).not.toHaveProperty("disableLineInfo");
  });
  it("accepts legacy CLI configuration, strips it from resolved output and rejects new explicit use", () => {
    const dir = mkdtempSync(join(tmpdir(), "legacy-cli-"));
    try {
      const file = join(dir, "config.json");
      writeFileSync(file, JSON.stringify({ toggles: { disableLineInfo: false, gcFixes: true } }));
      const result = JSON.parse(execFileSync("bun", ["cli.js", "--config", file, "--print-config"], { encoding: "utf8" }));
      expect(result.toggles).not.toHaveProperty("disableLineInfo");
      const explicit = spawnSync("bun", ["cli.js", "--on", "disableLineInfo", "--print-config"], { encoding: "utf8" });
      expect(explicit.status).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
