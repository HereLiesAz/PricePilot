import { describe, expect, it } from "vitest";
import {
  findProductMatch,
  normalizeTitle,
  titleSimilarity,
  type ExistingProduct,
} from "../src/matching.js";

describe("normalizeTitle", () => {
  it("lowercases, strips punctuation, and drops stopwords", () => {
    expect(normalizeTitle("The NEW Acme Wireless-Headphones (Black)")).toBe(
      "acme wireless headphones black",
    );
  });
});

describe("titleSimilarity", () => {
  it("scores near-identical titles high and unrelated ones low", () => {
    expect(titleSimilarity("Acme Wireless Headphones", "Acme Wireless Headphones Black")).toBeGreaterThan(0.8);
    expect(titleSimilarity("Acme Headphones", "Sony 4K Television")).toBeLessThan(0.2);
  });
});

describe("findProductMatch", () => {
  const existing: ExistingProduct[] = [
    { id: "p1", normalizedTitle: "acme wireless headphones", gtin: "0123456789012" },
    { id: "p2", normalizedTitle: "sony 55 inch 4k tv", mpn: "XR55" },
  ];

  it("matches exactly by GTIN regardless of title", () => {
    const r = findProductMatch({ title: "Totally different name", gtin: "0123456789012" }, existing);
    expect(r).toMatchObject({ productId: "p1", by: "gtin" });
  });

  it("matches by MPN when GTIN is absent", () => {
    const r = findProductMatch({ title: "tv", mpn: "XR55" }, existing);
    expect(r).toMatchObject({ productId: "p2", by: "mpn" });
  });

  it("falls back to fuzzy title and returns the best above the weak threshold", () => {
    const r = findProductMatch({ title: "Acme Wireless Headphones (Renewed)" }, existing);
    expect(r?.productId).toBe("p1");
    expect(r?.by).toBe("title");
  });

  it("returns null when nothing is similar enough", () => {
    expect(findProductMatch({ title: "Unrelated gadget xyz" }, existing)).toBeNull();
  });
});
