import { describe, expect, it } from "vitest";
import { alertMessage, shouldTriggerAlert } from "../src/alerts.js";

const base = {
  threshold: null,
  newPrice: null,
  prevInStock: null,
  newInStock: null,
  historyMedian: null,
};

describe("shouldTriggerAlert", () => {
  it("TARGET_HIT fires when price <= threshold", () => {
    expect(shouldTriggerAlert({ ...base, rule: "TARGET_HIT", threshold: 100, newPrice: 100 })).toBe(true);
    expect(shouldTriggerAlert({ ...base, rule: "TARGET_HIT", threshold: 100, newPrice: 101 })).toBe(false);
  });

  it("BACK_IN_STOCK fires only on an out -> in transition", () => {
    expect(
      shouldTriggerAlert({ ...base, rule: "BACK_IN_STOCK", prevInStock: false, newInStock: true }),
    ).toBe(true);
    expect(
      shouldTriggerAlert({ ...base, rule: "BACK_IN_STOCK", prevInStock: true, newInStock: true }),
    ).toBe(false);
  });

  it("GOOD_DEAL fires at >=15% below the median", () => {
    expect(shouldTriggerAlert({ ...base, rule: "GOOD_DEAL", newPrice: 85, historyMedian: 100 })).toBe(true);
    expect(shouldTriggerAlert({ ...base, rule: "GOOD_DEAL", newPrice: 90, historyMedian: 100 })).toBe(false);
  });

  it("never fires without the data it needs", () => {
    expect(shouldTriggerAlert({ ...base, rule: "TARGET_HIT", threshold: 100 })).toBe(false);
    expect(shouldTriggerAlert({ ...base, rule: "GOOD_DEAL", newPrice: 50 })).toBe(false);
  });
});

describe("alertMessage", () => {
  it("renders a readable message per rule", () => {
    expect(alertMessage("TARGET_HIT", "Widget", 99.5, "USD")).toContain("target price");
    expect(alertMessage("BACK_IN_STOCK", "Widget", null, "USD")).toContain("back in stock");
  });
});
