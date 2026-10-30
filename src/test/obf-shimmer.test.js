import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const css = readFileSync(join(process.cwd(), "src/obfuscation.css"), "utf8");
const rules = css.split("}").filter((rule) => rule.includes(".obf-chat-shimmer"));
const cycle = rules.find((rule) => rule.includes("linear-gradient"));
const sweep = rules.find((rule) => rule.includes("animation:obf-shimmer"));
const keyframes = css.slice(css.indexOf("@keyframes obf-shimmer"), css.indexOf("@keyframes obf-shimmer") + 200);
describe("working shimmer cycle", () => {
  it("paints the sweep with a single continuous cycle, not per-stage palettes", () => {
    expect(cycle).toBeDefined();
    expect(rules.filter((rule) => rule.includes("linear-gradient"))).toHaveLength(1);
    expect(cycle).not.toContain("data-palette");
  });
  it("shows each tint exactly once per cycle", () => {
    for (const tint of ["#D9C9A0", "#D9AEB8", "#6F93FF"]) {
      expect(cycle.split(tint).length - 1).toBe(1);
    }
    expect(cycle.split("#FAFAFA").length - 1).toBe(3);
  });
  it("sweeps slower than the previous four-second pass", () => {
    expect(sweep).toBeDefined();
    expect(sweep).toContain("animation:obf-shimmer 15s linear infinite");
  });
  it("shifts the tile by exactly one tile width so the loop never jumps", () => {
    const tile = Number(/background-size:(\d+)%/.exec(sweep)[1]) / 100;
    const positions = [...keyframes.matchAll(/background-position:(-?[\d.]+)%/g)].map((m) => Number(m[1]));
    expect(positions).toHaveLength(2);
    const travel = Math.abs(positions[0] - positions[1]) * (tile - 1) / 100;
    expect(travel).toBeCloseTo(tile, 3);
  });
  it("stops the sweep for reduced motion, after the rules it must override", () => {
    const base = css.indexOf(".obf-chat-shimmer{display:inline-block");
    const stop = css.indexOf("@media(prefers-reduced-motion:reduce){.obf-chat-shimmer");
    expect(stop).toBeGreaterThan(base);
    const rule = css.slice(stop, css.indexOf("}}", stop) + 2);
    expect(rule).toContain("animation:none");
    expect(rule).toContain("background-image:none");
  });
});
