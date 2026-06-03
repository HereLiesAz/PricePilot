import { describe, expect, it } from "vitest";
import { nextCadenceMinutes } from "../src/cadence.js";

describe("nextCadenceMinutes", () => {
  it("checks near-target offers every 3h", () => {
    expect(nextCadenceMinutes({ failureCount: 0, priceChanged: false, nearTarget: true })).toBe(180);
  });

  it("checks volatile (price-changed) offers every 6h", () => {
    expect(nextCadenceMinutes({ failureCount: 0, priceChanged: true, nearTarget: false })).toBe(360);
  });

  it("checks stable offers daily", () => {
    expect(nextCadenceMinutes({ failureCount: 0, priceChanged: false, nearTarget: false })).toBe(1440);
  });

  it("backs off exponentially on failures, clamped to 7 days", () => {
    expect(nextCadenceMinutes({ failureCount: 1, priceChanged: false, nearTarget: false })).toBe(2880);
    expect(nextCadenceMinutes({ failureCount: 10, priceChanged: false, nearTarget: false })).toBe(
      7 * 24 * 60,
    );
  });
});
