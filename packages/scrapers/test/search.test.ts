import { describe, expect, it } from "vitest";
import { mapEbaySearch, mapBestBuySearch } from "../src/search.js";
import { extractOffer, type AdapterContext } from "../src/index.js";

describe("name-search mappers", () => {
  it("maps eBay item summaries to search results", () => {
    const results = mapEbaySearch({
      itemSummaries: [
        {
          title: "Acme Headphones",
          price: { value: "99.99", currency: "USD" },
          image: { imageUrl: "https://i/x.jpg" },
          itemWebUrl: "https://www.ebay.com/itm/123456789012",
        },
        { title: "No URL" }, // dropped — no itemWebUrl
      ],
    });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ title: "Acme Headphones", price: 99.99, vendor: "ebay.com" });
  });

  it("maps Best Buy products to search results, preferring sale price", () => {
    const results = mapBestBuySearch({
      products: [
        { name: "55in TV", salePrice: 499.99, regularPrice: 599.99, url: "https://bestbuy.com/site/x/1.p", upc: "027" },
      ],
    });
    expect(results[0]).toMatchObject({ title: "55in TV", price: 499.99, vendor: "bestbuy.com", gtin: "027" });
  });
});

describe("Claude fallback tier", () => {
  it("invokes claudeFallback when structured data is missing", async () => {
    const ctx: AdapterContext = {
      enableAmazon: false,
      enablePlaywright: false,
      credentials: {},
      // structured-data finds nothing in this body…
      fetchImpl: async () => new Response("<html><title>blocked</title></html>", { status: 200 }),
      // …so the Claude fallback produces the result.
      claudeFallback: async () => ({
        title: "Recovered by Claude",
        price: 19.99,
        currency: "USD",
        inStock: true,
        image: null,
        gtin: null,
        mpn: null,
        brand: null,
        source: "claude",
      }),
    };
    const result = await extractOffer("https://shop.example/p/1", ctx);
    expect(result.title).toBe("Recovered by Claude");
    expect(result.source).toBe("claude");
  });
});
