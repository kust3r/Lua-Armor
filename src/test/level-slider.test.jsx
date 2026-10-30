import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ObfuscationComposer from "../components/ObfuscationComposer";
import { snapLevel } from "../components/LevelSlider";
describe("level reset and tactile feedback", () => {
  it("resets the saved selection to the existing Level 2 default", async () => {
    localStorage.setItem("lpy_level", "3");
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Intensidade de ofuscamento: 3" }));
    fireEvent.click(await screen.findByRole("button", { name: "Restaurar n\xEDvel padr\xE3o" }));
    expect(localStorage.getItem("lpy_level")).toBe("2");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "2");
  });
  it("vibrates for 8ms only on an actual level change, not opening or repeated endpoint requests", async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Intensidade de ofuscamento: 2" }));
    const slider = await screen.findByRole("slider");
    expect(vibrate).not.toHaveBeenCalled();
    fireEvent.keyDown(slider, { key: "End" });
    expect(vibrate.mock.calls).toEqual([[8]]);
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(vibrate.mock.calls).toEqual([[8]]);
    fireEvent.click(screen.getByRole("button", { name: "Restaurar n\xEDvel padr\xE3o" }));
    expect(vibrate.mock.calls).toEqual([[8], [8]]);
    fireEvent.click(screen.getByRole("button", { name: "Restaurar n\xEDvel padr\xE3o" }));
    expect(vibrate).toHaveBeenCalledTimes(2);
    delete navigator.vibrate;
  });
  it("still changes level when tactile feedback is unavailable or rejected", async () => {
    Object.defineProperty(navigator, "vibrate", { value: () => {
      throw new Error("Unavailable");
    }, configurable: true });
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Intensidade de ofuscamento: 2" }));
    fireEvent.keyDown(await screen.findByRole("slider"), { key: "End" });
    expect(localStorage.getItem("lpy_level")).toBe("3");
    delete navigator.vibrate;
  });
});
afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", class {
    observe() {
    }
    unobserve() {
    }
    disconnect() {
    }
  });
});
describe("three-level selection", () => {
  it("snaps freely dragged positions to the closest valid level", () => {
    expect([1, 1.25, 1.49, 1.51, 1.9, 2.49, 2.51, 2.8, 3].map(snapLevel)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });
  it("uses only levels 1, 2 and 3 and clamps keyboard movement at both ends", async () => {
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Intensidade de ofuscamento: 2" }));
    const slider = await screen.findByRole("slider");
    fireEvent.keyDown(slider, { key: "Home" });
    expect(localStorage.getItem("lpy_level")).toBe("1");
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(localStorage.getItem("lpy_level")).toBe("1");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(localStorage.getItem("lpy_level")).toBe("2");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(localStorage.getItem("lpy_level")).toBe("3");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(localStorage.getItem("lpy_level")).toBe("3");
    fireEvent.keyDown(slider, { key: "Home" });
    fireEvent.keyDown(slider, { key: "End" });
    expect(localStorage.getItem("lpy_level")).toBe("3");
  });
  it("immediately persists the selection and passes that exact level to generation", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "Intensidade de ofuscamento: 2" }));
    fireEvent.keyDown(await screen.findByRole("slider"), { key: "End" });
    expect(localStorage.getItem("lpy_level")).toBe("3");
    fireEvent.keyDown(screen.getByRole("slider"), { key: "Escape" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "print(42)" } });
    fireEvent.click(screen.getByRole("button", { name: "Ofuscar" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ level: 3, code: "print(42)" })));
  });
});
