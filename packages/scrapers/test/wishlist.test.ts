import { describe, expect, it } from "vitest";
import { parseWishlist } from "../src/wishlist.js";

describe("parseWishlist", () => {
  it("extracts product URLs from JSON-LD ItemList and anchors", () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@type": "ItemList",
        itemListElement: [
          { "@type": "ListItem", item: { url: "https://shop.example/product/abc" } },
          { "@type": "ListItem", url: "https://shop.example/products/def" },
        ],
      })}</script>
      </head><body>
        <a href="/dp/B0EXAMPLE1">Item</a>
        <a href="https://www.bestbuy.com/site/x/6501220.p?skuId=6501220">BB</a>
        <a href="/about">Not a product</a>
      </body></html>`;
    const urls = parseWishlist(html, "https://shop.example");
    expect(urls).toContain("https://shop.example/product/abc");
    expect(urls).toContain("https://shop.example/products/def");
    expect(urls).toContain("https://shop.example/dp/B0EXAMPLE1");
    expect(urls.some((u) => u.includes("6501220.p"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/about"))).toBe(false);
  });

  it("returns an empty list when there are no product links", () => {
    expect(parseWishlist("<html><body><a href='/help'>Help</a></body></html>", "https://x.test")).toEqual([]);
  });
});
