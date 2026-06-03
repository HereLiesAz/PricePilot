import { describe, expect, it } from "vitest";
import { sparklinePoints } from "./sparkline";

describe("sparklinePoints", () => {
  it("scales a series into the box (min at bottom, max at top)", () => {
    expect(sparklinePoints([120, 100, 110], 100, 20)).toBe("2,2 50,18 98,10");
  });

  it("returns an empty string for no data", () => {
    expect(sparklinePoints([], 100, 20)).toBe("");
  });

  it("handles a flat series without dividing by zero", () => {
    expect(sparklinePoints([50, 50], 100, 20)).toBe("2,18 98,18");
  });
});
