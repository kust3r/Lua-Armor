import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ObfuscationComposer from "../components/ObfuscationComposer";
const css = (path) => readFileSync(path, "utf8");
const obfuscationCss = css("src/obfuscation.css");
const sliderCss = css("src/components/level-slider.css");
const sliderTsx = css("src/components/LevelSlider.jsx");
const rulesFor = (source, selector) => source.split("\n").map((line) => line.trim()).filter((line) => line.startsWith(`${selector}{`)).join("\n");
describe("level trigger reuses the top-right menu disc surface", () => {
  it("declares the exact same hairline border, glass background and foreground color as the menu button", () => {
    const trigger = rulesFor(obfuscationCss, ".obf-composer .obf-level-trigger");
    const menu = rulesFor(obfuscationCss, ".obf-app:not(.obf-modal-host) .obf-header-actions>button");
    const hairline = "border:1px solid hsl(var(--highlight) / .16);border-top-color:hsl(var(--highlight) / .3)";
    const surface = "background:hsl(var(--card) / .72);color:hsl(var(--foreground))";
    expect(menu).toContain(hairline);
    expect(menu).toContain(surface);
    expect(trigger).toContain(hairline);
    expect(trigger).toContain(surface);
  });
  it("keeps the open state on the same hover fill the menu disc uses", () => {
    expect(obfuscationCss).toContain(".obf-composer .obf-level-trigger[data-state=open]{background:hsl(var(--accent) / .85)}");
    expect(obfuscationCss).toContain(".obf-app .obf-header-actions>button[data-state=open],.obf-app .obf-level-trigger[data-state=open]{background:hsl(var(--accent) / .85)}");
  });
});
describe("level 3 is the only level that reveals the nebula and the stars", () => {
  it("hides both layers by default and reveals both only at level 3", () => {
    const nebula = rulesFor(sliderCss, ".level-nebula");
    const starfield = rulesFor(sliderCss, ".level-starfield");
    expect(nebula).toContain("opacity:0");
    expect(starfield).toContain("opacity:0");
    const reveal = rulesFor(sliderCss, '.level-popover[data-level="3"] .level-nebula,.level-popover[data-level="3"] .level-starfield');
    expect(reveal).toContain("opacity:1");
    expect(sliderCss).not.toContain('.level-popover[data-level="1"] .level-nebula');
    expect(sliderCss).not.toContain('.level-popover[data-level="2"] .level-nebula');
    expect(sliderCss).not.toContain('.level-popover[data-level="1"] .level-starfield');
    expect(sliderCss).not.toContain('.level-popover[data-level="2"] .level-starfield');
  });
  it("carries the current level onto the popover so only level 3 can reveal them", async () => {
    localStorage.setItem("lpy_level", "2");
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Intensidade de ofuscamento: 2" }));
    const popover = await screen.findByRole("heading", { name: "Level 2" });
    const card = popover.closest(".level-popover");
    expect(card).toHaveAttribute("data-level", "2");
    expect(card?.querySelector(".level-nebula")).not.toBeNull();
    expect(card?.querySelector(".level-starfield")).not.toBeNull();
  });
});
describe("the description line has no trailing arrow", () => {
  it("renders the protection description without any icon", async () => {
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Intensidade de ofuscamento: 2" }));
    const description = await screen.findByText("Prote\xE7\xE3o equilibrada");
    expect(description.tagName).toBe("P");
    expect(description.querySelector("svg")).toBeNull();
    expect(sliderCss).not.toContain(".level-slider-description svg");
  });
});
describe("the card heading carries no zap symbol", () => {
  it("leaves the restore button as the only icon in the heading", async () => {
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Intensidade de ofuscamento: 2" }));
    const card = (await screen.findByRole("heading", { name: "Level 2" })).closest(".level-popover");
    const heading = card.querySelector(".level-slider-heading");
    expect(card.querySelector(".level-slider-symbol")).toBeNull();
    expect(heading.querySelectorAll("svg")).toHaveLength(1);
    expect(heading.querySelector("svg").closest("button")).toHaveClass("level-slider-reset");
    expect(sliderCss).not.toContain(".level-slider-symbol");
  });
});
describe("the stars and the nebula move slowly and smoothly", () => {
  it("twinkles every star on a cycle of at least six seconds", async () => {
    localStorage.setItem("lpy_level", "3");
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Intensidade de ofuscamento: 3" }));
    const card = (await screen.findByRole("heading", { name: "Level 3" })).closest(".level-popover");
    const stars = Array.from(card.querySelectorAll(".level-particle"));
    expect(stars.length).toBeGreaterThan(0);
    for (const star of stars) {
      const duration = Number(star.style.getPropertyValue("--star-duration").replace("s", ""));
      expect(duration).toBeGreaterThanOrEqual(6);
    }
  });
  it("drifts both background layers over at least twenty seconds", () => {
    const cycle = (rule, name) => {
      const match = rule.match(new RegExp(`animation:${name}\\s+([\\d.]+)s`));
      expect(match).not.toBeNull();
      return Number(match[1]);
    };
    expect(cycle(rulesFor(sliderCss, ".level-nebula"), "level-nebula-drift")).toBeGreaterThanOrEqual(20);
    expect(cycle(rulesFor(sliderCss, ".level-starfield"), "level-star-drift")).toBeGreaterThanOrEqual(20);
    expect(sliderCss).toContain("@keyframes level-nebula-drift");
    expect(sliderCss).toContain("@keyframes level-star-drift");
  });
  it("stops the drift for people who ask for less motion", () => {
    const reduce = sliderCss.split("\n").find((line) => line.includes("@media(prefers-reduced-motion:reduce)")) ?? "";
    expect(reduce).toContain(".level-nebula");
    expect(reduce).toContain(".level-starfield");
  });
});
describe("the track shows one marker per level", () => {
  it("renders exactly three markers on the track itself, never inside the fill", async () => {
    localStorage.setItem("lpy_level", "2");
    render(<ObfuscationComposer busy={false} externalError="" onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Intensidade de ofuscamento: 2" }));
    const card = (await screen.findByRole("heading", { name: "Level 2" })).closest(".level-popover");
    const marks = card.querySelector(".level-slider-marks");
    expect(marks.querySelectorAll("i")).toHaveLength(3);
    expect(marks.closest(".level-slider-track")).not.toBeNull();
    expect(marks.closest(".level-slider-range")).toBeNull();
  });
  it("keeps the markers visible below level 3 and fades them out only at level 3", () => {
    const marks = rulesFor(sliderCss, ".level-slider-marks");
    expect(marks).toContain("opacity:1");
    expect(marks).toContain("transition:opacity");
    const hidden = rulesFor(sliderCss, '.level-popover[data-level="3"] .level-slider-marks');
    expect(hidden).toContain("opacity:0");
    expect(sliderCss).not.toContain('.level-popover[data-level="1"] .level-slider-marks');
    expect(sliderCss).not.toContain('.level-popover[data-level="2"] .level-slider-marks');
  });
  it("centres the markers on the three knob positions so the knob covers the one it rests on", () => {
    const marks = rulesFor(sliderCss, ".level-slider-marks");
    const dot = rulesFor(sliderCss, ".level-slider-marks i");
    const thumb = rulesFor(sliderCss, ".level-slider-thumb");
    const thumbWidth = Number(thumb.match(/width:(\d+(?:\.\d+)?)px/)[1]);
    const dotWidth = Number(dot.match(/width:(\d+(?:\.\d+)?)px/)[1]);
    expect(marks).toContain(`padding:0 ${thumbWidth / 2 - dotWidth / 2}px`);
    expect(marks).toContain("justify-content:space-between");
  });
});
describe("the thumb hides what is behind it", () => {
  it("keeps the thumb sparks behind an opaque disc and makes them larger", () => {
    const thumb = rulesFor(sliderCss, ".level-slider-thumb");
    const cover = rulesFor(sliderCss, ".level-slider-thumb::after");
    expect(thumb).toContain("isolation:isolate");
    expect(cover).toContain("z-index:1");
    expect(cover).toContain("background:hsl(var(--level-thumb))");
    expect(rulesFor(sliderCss, ".level-thumb-sparks")).toContain("z-index:0");
    expect(Number(rulesFor(sliderCss, ".level-thumb-sparks i").match(/width:(\d+)px/)[1])).toBeGreaterThanOrEqual(4);
  });
  it("ends the fill at the knob centre so its square end never shows behind the knob", () => {
    expect(rulesFor(sliderCss, ".level-slider-range")).toContain("clip-path:inset(0 max(0px,calc((var(--level-progress) - .5)*33px)) 0 0)");
  });
  it("draws the three markers at least 6px wide", () => {
    expect(Number(rulesFor(sliderCss, ".level-slider-marks i").match(/width:(\d+)px/)[1])).toBeGreaterThanOrEqual(6);
  });
});
describe("the burst fades fast and the card never turns into a scroll area", () => {
  it("clips the card instead of making it scrollable, so no scrollbars can appear", () => {
    const card = rulesFor(sliderCss, ".level-popover");
    expect(card).toContain("overflow:clip");
    expect(card).not.toContain("overflow-y:auto");
    expect(card).not.toContain("overflow:auto");
    expect(card).not.toContain("overflow-x:hidden");
  });
  it("ends the spark burst within half a second of leaving the knob", () => {
    const burst = rulesFor(sliderCss, '.level-popover[data-level="3"] .level-thumb-sparks[data-emitting=true] i');
    const duration = Number(burst.match(/animation:level-spark-emit\s+(\d+)ms/)[1]);
    const timeout = Number(sliderTsx.match(/setEmitting\(false\),\s*(\d+)\)/)[1]);
    expect(duration).toBeLessThanOrEqual(500);
    expect(timeout).toBeGreaterThanOrEqual(duration);
    expect(timeout).toBeLessThanOrEqual(700);
  });
  it("lets the particles travel past the card edge and fade out there", () => {
    const card = rulesFor(sliderCss, ".level-popover");
    const margin = Number(card.match(/overflow-clip-margin:(\d+)px/)[1]);
    const pairs = sliderTsx.match(/THUMB_SPARKS[^=]+=\s*(\[[^;]+\])/)[1];
    const offsets = [...pairs.matchAll(/\[(-?\d+),\s*(-?\d+)\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const reach = Math.max(...offsets.map(([x, y]) => Math.hypot(x, y)));
    expect(offsets).toHaveLength(12);
    expect(reach).toBeGreaterThanOrEqual(50);
    expect(margin).toBeGreaterThanOrEqual(reach);
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
