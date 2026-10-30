import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ObfuscationComposer from "../components/ObfuscationComposer";
afterEach(cleanup);
beforeEach(() => localStorage.clear());
describe("inline source submission", () => {
  it("clears source only after an accepted submission", async () => {
    let accept = () => {
    };
    const submit = vi.fn(() => new Promise((resolve) => {
      accept = resolve;
    }));
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={submit} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "print(42)" } });
    fireEvent.click(screen.getByRole("button", { name: "Ofuscar" }));
    expect(screen.getByRole("textbox")).toHaveValue("print(42)");
    accept(true);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
  });
  it("preserves source when the job rejects the start", async () => {
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn().mockResolvedValue(false)} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "print(7)" } });
    fireEvent.click(screen.getByRole("button", { name: "Ofuscar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ofuscar" })).toBeEnabled());
    expect(screen.getByRole("textbox")).toHaveValue("print(7)");
  });
  it("does not submit an empty source", () => {
    const submit = vi.fn();
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "Ofuscar" }));
    expect(submit).not.toHaveBeenCalled();
  });
  it("submits pasted raw source with the saved platform, level and toggles", async () => {
    localStorage.setItem("lpy_platform", "luau");
    localStorage.setItem("lpy_level", "3");
    localStorage.setItem("lpy_toggles", JSON.stringify({ intenseVm: false, gcFixes: true }));
    const submit = vi.fn().mockResolvedValue(true);
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={submit} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "print(1)\nprint(2)" } });
    fireEvent.click(screen.getByRole("button", { name: "Ofuscar" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ code: "print(1)\nprint(2)", fileName: "script.lua", platform: "luau", level: 3, toggles: { intenseVm: false, gcFixes: true } }));
  });
  it("submits exact attachment bytes without inserting raw source into the editor", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={submit} />);
    const file = new File(["print(42)\n"], "fixture.luau");
    Object.defineProperty(file, "text", { value: async () => "print(42)\n" });
    fireEvent.change(screen.getByLabelText("Arquivo Lua"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Remover anexo" })).toBeEnabled());
    expect(screen.getByRole("textbox")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Ofuscar" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ code: "print(42)\n", fileName: "fixture.luau", inputKind: "attachment" })));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remover anexo" })).toBeNull());
    expect(localStorage.getItem("code")).toBeNull();
  });
  it("removing an attachment restores the independent pasted source", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={submit} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "print(7)" } });
    const file = new File(["print(42)"], "Chu-laele.lua");
    Object.defineProperty(file, "text", { value: async () => "print(42)" });
    fireEvent.change(screen.getByLabelText("Arquivo Lua"), { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: "Remover anexo" }));
    fireEvent.click(screen.getByRole("button", { name: "Ofuscar" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ code: "print(7)", fileName: "script.lua" })));
    expect(submit.mock.calls[0][0].inputKind).toBeUndefined();
  });
  it("rejects unsupported attachments without replacing the current source", async () => {
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "print(1)" } });
    fireEvent.change(screen.getByLabelText("Arquivo Lua"), { target: { files: [new File(["bad"], "bad.exe")] } });
    expect(screen.getByRole("textbox")).toHaveValue("print(1)");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
  it.each([["photo.png", "image/png"], ["movie.mp4", "video/mp4"], ["animation.gif", "image/gif"], ["renamed.lua", "image/png"]])("rejects media attachment %s", async (name, type) => {
    const submit = vi.fn();
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={submit} />);
    const text = vi.fn().mockResolvedValue("print(42)");
    const file = new File(["media"], name, { type });
    Object.defineProperty(file, "text", { value: text });
    fireEvent.change(screen.getByLabelText("Arquivo Lua"), { target: { files: [file] } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(text).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Remover anexo" })).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });
  it("rejects binary data renamed as a text attachment", async () => {
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    const file = new File(["binary"], "binary.txt", { type: "text/plain" });
    Object.defineProperty(file, "text", { value: async () => "GIF89a\0" });
    fireEvent.change(screen.getByLabelText("Arquivo Lua"), { target: { files: [file] } });
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Remover anexo" })).toBeNull();
  });
  it("accepts plain text attachments without changing their contents", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={submit} />);
    const file = new File(["print(9)\n"], "code.txt", { type: "text/plain" });
    Object.defineProperty(file, "text", { value: async () => "print(9)\n" });
    fireEvent.change(screen.getByLabelText("Arquivo Lua"), { target: { files: [file] } });
    await screen.findByRole("button", { name: "Remover anexo" });
    fireEvent.click(screen.getByRole("button", { name: "Ofuscar" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ code: "print(9)\n", fileName: "code.txt", inputKind: "attachment" })));
  });
  it("keeps Ofuscar disabled until there is code to obfuscate", () => {
    const submit = vi.fn();
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={submit} />);
    expect(screen.getByRole("button", { name: "Ofuscar" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   \n " } });
    expect(screen.getByRole("button", { name: "Ofuscar" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "print(1)" } });
    expect(screen.getByRole("button", { name: "Ofuscar" })).toBeEnabled();
  });
  it("enables Ofuscar only while an attachment or typed code is present", async () => {
    const submit = vi.fn().mockResolvedValue(true);
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={submit} />);
    const file = new File(["print(42)"], "fixture.luau");
    Object.defineProperty(file, "text", { value: async () => "print(42)" });
    fireEvent.change(screen.getByLabelText("Arquivo Lua"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Remover anexo" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Ofuscar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Remover anexo" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remover anexo" })).toBeNull());
    expect(screen.getByRole("button", { name: "Ofuscar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Ofuscar" }));
    expect(submit).not.toHaveBeenCalled();
  });
  it("turns the send arrow into a stop square while obfuscating", () => {
    const cancel = vi.fn();
    render(<ObfuscationComposer busy externalError="" onSubmit={vi.fn()} onCancel={cancel} />);
    expect(screen.queryByRole("button", { name: "Ofuscar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Interromper ofusca\xE7\xE3o" }));
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("shows the selected level inside a stretched control", () => {
    localStorage.setItem("lpy_level", "3");
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Intensidade de ofuscamento: 3" }).textContent).toBe("Level 3");
  });
});
