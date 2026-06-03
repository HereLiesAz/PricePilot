import { describe, expect, it } from "vitest";
import { dealScore } from "../src/scoring.js";

describe("dealScore", () => {
  const history = [100, 110, 120, 130, 140]; // median 120, lowest 100

  it("labels an at/near-lowest price as great", () => {
    const s = dealScore(100, history);
    expect(s.tier).toBe("great");
    expect(s.lowest).toBe(100);
    expect(s.median).toBe(120);
  });

  it("labels a clear discount below the median as good", () => {
    expect(dealScore(105, history).tier).toBe("good");
  });

  it("labels a near-median price as normal", () => {
    expect(dealScore(120, history).tier).toBe("normal");
  });

  it("labels an above-median price as high", () => {
    expect(dealScore(150, history).tier).toBe("high");
  });

  it("computes a percentile and is normal with no history", () => {
    expect(dealScore(120, history).percentile).toBe(40);
    expect(dealScore(50, [])).toMatchObject({ tier: "normal", median: null });
  });
});
