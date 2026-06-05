import { describe, expect, it } from "vitest";
import {
  convertCurrency,
  landedPrice,
  parseQuantity,
  unitPrice,
} from "../src/normalization.js";

describe("landedPrice", () => {
  it("adds shipping and tax", () => {
    expect(landedPrice(100, 10)).toBe(110);
    expect(landedPrice(100, 0, 0.1)).toBe(110);
  });
});

describe("convertCurrency", () => {
  it("converts via the units-per-USD table", () => {
    expect(convertCurrency(92, "EUR", "USD")).toBe(100);
    expect(convertCurrency(100, "USD", "USD")).toBe(100);
  });
  it("returns null for unknown currencies", () => {
    expect(convertCurrency(100, "USD", "ZZZ")).toBeNull();
  });
});

describe("parseQuantity / unitPrice", () => {
  it("parses pack counts", () => {
    expect(parseQuantity("Acme AA Batteries 12 pack")).toEqual({ quantity: 12, unit: "each" });
    expect(unitPrice(24, "Acme AA Batteries 12 pack")).toEqual({ value: 2, unit: "each" });
  });

  it("parses volumes to litres (with multipliers)", () => {
    expect(parseQuantity("Olive Oil 500ml")).toEqual({ quantity: 0.5, unit: "l" });
    expect(unitPrice(6, "Sparkling Water 6 x 1l")).toEqual({ value: 1, unit: "l" });
  });

  it("parses weights to kilograms", () => {
    expect(parseQuantity("Coffee Beans 1kg")).toEqual({ quantity: 1, unit: "kg" });
    expect(unitPrice(20, "Protein 500g")?.unit).toBe("kg");
  });

  it("returns null when no quantity is present", () => {
    expect(parseQuantity("Wireless Headphones")).toBeNull();
    expect(unitPrice(99, "Wireless Headphones")).toBeNull();
  });
});
