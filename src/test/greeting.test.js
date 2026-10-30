import { describe, expect, it } from "vitest";
import { greetingPeriod } from "../lib/greeting";
describe("local greeting periods", () => {
  it("uses night from 00:00 through 05:59", () => {
    expect(greetingPeriod(0)).toBe("night");
    expect(greetingPeriod(5 + 59 / 60)).toBe("night");
  });
  it("uses morning from 06:00 through 11:59", () => {
    expect(greetingPeriod(6)).toBe("morning");
    expect(greetingPeriod(11 + 59 / 60)).toBe("morning");
  });
  it("uses afternoon from 12:00 through 17:59", () => {
    expect(greetingPeriod(12)).toBe("afternoon");
    expect(greetingPeriod(17 + 59 / 60)).toBe("afternoon");
  });
  it("uses night from 18:00 through 23:59", () => {
    expect(greetingPeriod(18)).toBe("night");
    expect(greetingPeriod(23 + 59 / 60)).toBe("night");
  });
});
