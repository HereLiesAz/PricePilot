import { describe, expect, it, vi } from "vitest";
import { extractOffer, type AdapterContext } from "../src/index.js";

const PRODUCT_JSONLD = `<script type="application/ld+json">${JSON.stringify({
  "@type": "Product",
  name: "Rendered Product",
  offers: { "@type": "Offer", price: 42, priceCurrency: "USD" },
})}</script>`;

function baseCtx(over: Partial<AdapterContext>): AdapterContext {
  return { enableAmazon: false, enablePlaywright: false, credentials: {}, ...over };
}

describe("headless → Claude fallback with shared HTML", () => {
  it("returns the headless result when the rendered DOM has structured data", async () => {
    const claudeFallback = vi.fn(async () => null);
    const ctx = baseCtx({
      // Primary (structured-data) sees nothing in the plain-fetch body…
      fetchImpl: async () => new Response("<html><title>blocked</title></html>", { status: 200 }),
      // …but the rendered DOM has the product.
      renderImpl: async () => `<html><head>${PRODUCT_JSONLD}</head></html>`,
      claudeFallback,
    });

    const result = await extractOffer("https://shop.example/p", ctx);
    expect(result.title).toBe("Rendered Product");
    expect(result.source).toBe("headless");
    expect(claudeFallback).not.toHaveBeenCalled(); // structured data sufficed
  });

  it("hands the rendered HTML to Claude instead of re-fetching", async () => {
    const fetchImpl = vi.fn(async () => new Response("BLOCKED", { status: 403 }));
    const renderedHtml = "<html><body data-rendered=\"yes\">no jsonld here</body></html>";
    let claudeReceived: string | undefined;
    const ctx = baseCtx({
      fetchImpl, // primary fails with fetch_failed (403)
      renderImpl: async () => renderedHtml,
      claudeFallback: async ({ html }) => {
        claudeReceived = html;
        return {
          title: "By Claude",
          price: 9.99,
          currency: "USD",
          inStock: null,
          image: null,
          gtin: null,
          mpn: null,
          brand: null,
          source: "claude",
        };
      },
    });

    const result = await extractOffer("https://shop.example/p", ctx);
    expect(result.title).toBe("By Claude");
    // Claude got the rendered DOM, not a fresh fetch…
    expect(claudeReceived).toContain('data-rendered="yes"');
    // …and only the primary attempt hit the network (Claude did not re-fetch).
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to a plain-fetch Claude when headless rendering fails", async () => {
    const ctx = baseCtx({
      fetchImpl: async () => new Response("<html><title>blocked</title></html>", { status: 200 }),
      renderImpl: async () => {
        throw new Error("browser launch failed");
      },
      claudeFallback: async () => ({
        title: "Claude plain fetch",
        price: 1,
        currency: "USD",
        inStock: null,
        image: null,
        gtin: null,
        mpn: null,
        brand: null,
        source: "claude",
      }),
    });
    const result = await extractOffer("https://shop.example/p", ctx);
    expect(result.title).toBe("Claude plain fetch");
  });
});
