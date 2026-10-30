import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ObfuscationExchange from "../components/ObfuscationExchange";
import { emptyPhases, formatKb, sessionArtifactName } from "../lib/job-contract";
afterEach(cleanup);
describe("session file naming", () => {
  it("replaces the suffix after the first hyphen in Chu-laele.lua", () => {
    expect(sessionArtifactName({ fileName: "Chu-laele.lua", inputKind: "attachment" }, "exact")).toBe("Chu-Obfuscated.lua");
  });
  it("appends -Obfuscated before the extension when the name has no hyphen", () => {
    expect(sessionArtifactName({ fileName: "chupinha.lua", inputKind: "attachment" }, "exact")).toBe("chupinha-Obfuscated.lua");
    expect(sessionArtifactName({ fileName: "KB.lua", inputKind: "attachment" }, "exact")).toBe("KB-Obfuscated.lua");
  });
  it("names pasted output with its stable artifact hash", () => {
    expect(sessionArtifactName({ fileName: "script.lua" }, "hello")).toBe("Obfuscated-4f9f2cab.lua");
    expect(sessionArtifactName({ fileName: "script.lua" }, "hello!")).not.toBe("Obfuscated-4f9f2cab.lua");
  });
});
describe("compact size label", () => {
  it("uses B, KB, MB, GB and TB in binary steps", () => {
    expect(formatKb(79085)).toBe("77,23 KB");
    expect(formatKb(400)).toBe("400 B");
    expect(formatKb(1723 * 1024)).toBe("1,68 MB");
    expect(formatKb(1024 ** 3)).toBe("1 GB");
    expect(formatKb(1024 ** 4 * 2.5)).toBe("2,5 TB");
  });
  it("shows the size instead of Arquivo or bytes on the cards", () => {
    const entry = { id: "s", input: { code: "x".repeat(79085), fileName: "KB.lua", inputKind: "attachment", platform: "luau", level: 2, toggles: {} }, output: "x".repeat(79085), status: "done", error: "", attempt: 1, phases: emptyPhases() };
    render(<ObfuscationExchange entry={entry} />);
    expect(screen.queryByText("Arquivo")).toBeNull();
    expect(screen.queryByText(/bytes/)).toBeNull();
    expect(screen.getAllByText("77,23 KB")).toHaveLength(2);
    expect(screen.getByText("KB-Obfuscated.lua")).toBeTruthy();
  });
});
describe("exact result actions", () => {
  it("expands and copies only the output belonging to this submission", async () => {
    const output = 'return "exact artifact"\n';
    const writeText = vi.fn().mockResolvedValue(void 0);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const entry = { id: "a", input: { code: "print(1)", fileName: "Chu-laele.lua", inputKind: "attachment", platform: "luau", level: 2, toggles: {} }, output, status: "done", error: "", attempt: 1, phases: emptyPhases() };
    const { container } = render(<ObfuscationExchange entry={entry} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expandir" }));
    const dialog = screen.getByRole("dialog", { name: "Chu-Obfuscated.lua" });
    expect(dialog.querySelector("pre")?.textContent).toBe(output);
    expect(container.querySelector("pre")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith(output);
    await screen.findByRole("button", { name: "Copiado" });
  });
  it("returns to the copy icon after the confirmation", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(void 0) } });
    const entry = { id: "c", input: { code: "print(1)", fileName: "a.lua", platform: "luau", level: 2, toggles: {} }, output: "x", status: "done", error: "", attempt: 1, phases: emptyPhases() };
    render(<ObfuscationExchange entry={entry} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Copiado" })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByRole("button", { name: "Copiar" })).toBeTruthy();
    vi.useRealTimers();
  });
  it("never shows attempt counts while working", () => {
    const entry = { id: "d", input: { code: "print(1)", fileName: "a.lua", platform: "luau", level: 2, toggles: {} }, output: "", status: "running", error: "", attempt: 3, phases: emptyPhases() };
    render(<ObfuscationExchange entry={entry} />);
    expect(screen.queryByText(/Tentativa/)).toBeNull();
  });
});
describe("message presentation", () => {
  const submission = (code, extra) => ({
    id: "m",
    input: { code, fileName: "script.lua", platform: "luau", level: 2, toggles: {} },
    output: "",
    error: "",
    attempt: 1,
    phases: emptyPhases(),
    status: "error",
    ...extra
  });
  it("reports an error without a recover button", () => {
    render(<ObfuscationExchange entry={submission("1 + 1", { error: "Erro de sintaxe na linha 1: express\xE3o inv\xE1lida." })} />);
    expect(screen.getByRole("alert").textContent).toBe("Erro de sintaxe na linha 1: express\xE3o inv\xE1lida.");
    expect(screen.queryByRole("button", { name: "Recuperar script" })).toBeNull();
  });
  it("shows a short script complete, with no show-more control", () => {
    const { container } = render(<ObfuscationExchange entry={submission("print(1)\nprint(2)", { error: "x" })} />);
    expect(screen.queryByText("Mostrar mais")).toBeNull();
    expect(container.querySelector(".obf-user-code-text")?.textContent).toBe("print(1)\nprint(2)");
    expect(container.querySelector(".obf-user-code")?.className).not.toContain("obf-user-code-clamped");
  });
  it("folds a long script and reveals it with Mostrar mais", () => {
    const code = Array.from({ length: 24 }, (_, i) => `local v${i} = ${i}`).join("\n");
    const { container } = render(<ObfuscationExchange entry={submission(code, { error: "x" })} />);
    const bubble = container.querySelector(".obf-user-code");
    expect(bubble?.className).toContain("obf-user-code-clamped");
    expect(screen.getByText("Mostrar mais")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar mais" }));
    expect(bubble?.className).not.toContain("obf-user-code-clamped");
    expect(screen.getByRole("button", { name: "Mostrar menos" })).toBeTruthy();
  });
  it("collapses an expanded long script when it leaves the viewport", () => {
    const code = Array.from({ length: 24 }, (_, i) => `local v${i} = ${i}`).join("\n");
    let notify;
    class FakeObserver {
      constructor(cb) {
        notify = (intersecting) => cb([{ isIntersecting: intersecting }], this);
      }
      observe() {
      }
      unobserve() {
      }
      disconnect() {
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const { container } = render(<ObfuscationExchange entry={submission(code, { error: "x" })} />);
    const bubble = container.querySelector(".obf-user-code");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar mais" }));
    expect(bubble?.className).not.toContain("obf-user-code-clamped");
    act(() => notify?.(true));
    expect(bubble?.className).not.toContain("obf-user-code-clamped");
    act(() => notify?.(false));
    expect(bubble?.className).toContain("obf-user-code-clamped");
    expect(screen.getByRole("button", { name: "Mostrar mais" })).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
describe("progress stages", () => {
  const working = (done, running = -1) => {
    const phases = emptyPhases();
    for (let i = 0; i < done; i++) phases[i] = { status: "done", progress: 100 };
    if (running >= 0) phases[running] = { status: "running", progress: 0 };
    return {
      id: "w",
      input: { code: "print(1)", fileName: "script.lua", platform: "luau", level: 2, toggles: {} },
      output: "",
      error: "",
      attempt: 1,
      phases,
      status: "running"
    };
  };
  it("opens with Pensando...", () => {
    render(<ObfuscationExchange entry={working(0)} />);
    expect(screen.getByText("Pensando...")).toBeTruthy();
  });
  it("advances to Ofuscando... after the first phase finishes", () => {
    render(<ObfuscationExchange entry={working(1)} />);
    expect(screen.getByText("Ofuscando...")).toBeTruthy();
    expect(screen.queryByText("Pensando...")).toBeNull();
  });
  it("advances to Finalizando... after the second phase finishes", () => {
    render(<ObfuscationExchange entry={working(2)} />);
    expect(screen.getByText("Finalizando...")).toBeTruthy();
    expect(screen.queryByText("Pensando...")).toBeNull();
  });
  it("holds the stage while a phase is running", () => {
    render(<ObfuscationExchange entry={working(1, 1)} />);
    expect(screen.getByText("Ofuscando...")).toBeTruthy();
  });
});
