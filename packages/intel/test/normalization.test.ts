import { describe, expect, it } from "vitest";
import {
  convertCurrency,
  getRates,
  landedPrice,
  parseQuantity,
  refreshRates,
  resetRates,
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

describe("refreshRates", () => {
  it("updates the live cache from a USD-base feed and keeps it on failure", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ result: "success", rates: { USD: 1, EUR: 0.5, GBP: 0.8 } }), {
        status: 200,
      })) as unknown as typeof fetch;
    const rates = await refreshRates({ fetchImpl, ttlMs: 0, url: "https://fx.test" });
    expect(rates.EUR).toBe(0.5);
    expect(getRates().EUR).toBe(0.5);
    // convertCurrency now uses the refreshed cache by default.
    expect(convertCurrency(0.5, "EUR", "USD")).toBe(1);

    // A failing refresh throws and leaves the previous cache intact.
    const failing = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(
      refreshRates({ fetchImpl: failing, ttlMs: 0, url: "https://fx.test" }),
    ).rejects.toThrow();
    expect(getRates().EUR).toBe(0.5);

    resetRates(); // restore the seed table for other tests
    expect(getRates().EUR).toBe(0.92);
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
