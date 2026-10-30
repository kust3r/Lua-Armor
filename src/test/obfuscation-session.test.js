import { describe, expect, it } from "vitest";
import { updateSubmission } from "../lib/obfuscation-session";
import { emptyPhases } from "../lib/job-contract";
const entry = (id, output = "") => ({ id, input: { code: `print('${id}')`, fileName: `${id}.lua`, level: 2, platform: "roblox", toggles: {} }, status: output ? "done" : "running", output, error: "", phases: emptyPhases(), attempt: 1 });
describe("session submissions", () => {
  it("keeps earlier exact output when the next submission completes", () => {
    const previous = "first\nartifact\0";
    const result = updateSubmission([entry("a", previous), entry("b")], "b", { status: "done", output: "second artifact" });
    expect(result[0].output).toBe(previous);
    expect(result[1].output).toBe("second artifact");
  });
  it("keeps the original source for recovery after an error", () => {
    const result = updateSubmission([entry("a")], "a", { status: "error", error: "Parse failed" });
    expect(result[0].input.code).toBe("print('a')");
    expect(result[0].status).toBe("error");
  });
});
