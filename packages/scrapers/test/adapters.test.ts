import { describe, expect, it } from "vitest";
import { mapEbayItem, ebayLegacyId } from "../src/adapters/ebay.js";
import { mapBestBuyProduct, bestBuySku } from "../src/adapters/bestbuy.js";
import { resolveAdapter, extractOffer } from "../src/registry.js";
import { ExtractionError, type AdapterContext } from "../src/types.js";

const baseCtx: AdapterContext = {
  enableAmazon: false,
  enablePlaywright: false,
  credentials: {},
};

describe("eBay adapter mapping", () => {
  it("maps a Browse API item to ExtractedProduct", () => {
    const result = mapEbayItem({
      title: "Vintage Camera",
      price: { value: "249.50", currency: "USD" },
      image: { imageUrl: "https://i.ebayimg.com/x.jpg" },
      brand: "Canon",
      gtin: "0123456789012",
      estimatedAvailabilities: [{ estimatedAvailabilityStatus: "IN_STOCK" }],
    });
    expect(result.title).toBe("Vintage Camera");
    expect(result.price).toBe(249.5);
    expect(result.inStock).toBe(true);
    expect(result.brand).toBe("Canon");
    expect(result.source).toBe("api:ebay");
  });

  it("extracts the legacy id from an item URL", () => {
    expect(ebayLegacyId(new URL("https://www.ebay.com/itm/123456789012"))).toBe("123456789012");
    expect(ebayLegacyId(new URL("https://www.ebay.com/itm/Some-Title/204567891234"))).toBe(
      "204567891234",
    );
    expect(ebayLegacyId(new URL("https://www.ebay.com/sch/i.html"))).toBeNull();
  });
});

describe("Best Buy adapter mapping", () => {
  it("maps a products API entry, preferring sale price", () => {
    const result = mapBestBuyProduct({
      name: "55-inch TV",
      salePrice: 499.99,
      regularPrice: 599.99,
      manufacturer: "Sony",
      upc: "027242920000",
      modelNumber: "XR55",
      onlineAvailability: true,
    });
    expect(result.price).toBe(499.99);
    expect(result.gtin).toBe("027242920000");
    expect(result.mpn).toBe("XR55");
    expect(result.inStock).toBe(true);
    expect(result.source).toBe("api:bestbuy");
  });

  it("extracts the SKU from a product URL", () => {
    expect(bestBuySku(new URL("https://www.bestbuy.com/site/x/6501220.p?skuId=6501220"))).toBe(
      "6501220",
    );
  });
});

describe("resolveAdapter", () => {
  it("uses an API adapter when the domain matches and credentials exist", () => {
    const ctx = { ...baseCtx, credentials: { ebayOAuthToken: "tok" } };
    expect(resolveAdapter("https://www.ebay.com/itm/123456789012", ctx).name).toBe("ebay");
  });

  it("falls back to structured-data without credentials", () => {
    expect(resolveAdapter("https://www.ebay.com/itm/123456789012", baseCtx).name).toBe(
      "structured-data",
    );
    expect(resolveAdapter("https://shop.example/p/1", baseCtx).name).toBe("structured-data");
  });
});

describe("extractOffer Amazon policy", () => {
  it("rejects Amazon URLs unless enabled", async () => {
    await expect(extractOffer("https://www.amazon.com/dp/B0TEST", baseCtx)).rejects.toMatchObject({
      code: "amazon_disabled",
    });
  });

  it("uses an injected fetch for structured-data extraction", async () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "Injected Product",
      offers: { "@type": "Offer", price: 9.99, priceCurrency: "USD" },
    })}</script>`;
    const ctx: AdapterContext = {
      ...baseCtx,
      fetchImpl: async () => new Response(html, { status: 200 }),
    };
    const result = await extractOffer("https://shop.example/p/1", ctx);
    expect(result.title).toBe("Injected Product");
    expect(result.price).toBe(9.99);
  });

  it("surfaces no_product_data when a page has nothing usable", async () => {
    const ctx: AdapterContext = {
      ...baseCtx,
      fetchImpl: async () => new Response("<html><title>blog</title></html>", { status: 200 }),
    };
    await expect(extractOffer("https://shop.example/blog", ctx)).rejects.toBeInstanceOf(
      ExtractionError,
    );
  });
});
