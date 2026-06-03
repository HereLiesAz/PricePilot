import { describe, expect, it } from "vitest";
import { extractFromHtml } from "../src/extract/structured.js";

describe("extractFromHtml (structured data)", () => {
  it("reads schema.org Product + Offer from JSON-LD", () => {
    const html = `<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Acme Wireless Headphones",
        brand: { "@type": "Brand", name: "Acme" },
        gtin13: "0123456789012",
        image: ["https://cdn.example.com/hp.jpg"],
        offers: {
          "@type": "Offer",
          price: "129.99",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      })}</script>
      </head><body></body></html>`;

    const result = extractFromHtml(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Acme Wireless Headphones");
    expect(result!.brand).toBe("Acme");
    expect(result!.gtin).toBe("0123456789012");
    expect(result!.price).toBe(129.99);
    expect(result!.currency).toBe("USD");
    expect(result!.inStock).toBe(true);
    expect(result!.image).toBe("https://cdn.example.com/hp.jpg");
  });

  it("handles JSON-LD @graph and an offers array", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@graph": [
        { "@type": "WebSite", name: "Shop" },
        {
          "@type": "Product",
          name: "Widget",
          offers: [{ "@type": "Offer", price: 9.5, priceCurrency: "EUR" }],
        },
      ],
    })}</script>`;
    const result = extractFromHtml(html);
    expect(result?.title).toBe("Widget");
    expect(result?.price).toBe(9.5);
    expect(result?.currency).toBe("EUR");
  });

  it("falls back to Open Graph product tags", () => {
    const html = `<html><head>
      <meta property="og:title" content="OG Product" />
      <meta property="og:image" content="https://img/og.png" />
      <meta property="product:price:amount" content="$1,299.00" />
      <meta property="product:price:currency" content="USD" />
      <meta property="og:availability" content="instock" />
      </head></html>`;
    const result = extractFromHtml(html);
    expect(result?.title).toBe("OG Product");
    expect(result?.price).toBe(1299);
    expect(result?.inStock).toBe(true);
    expect(result?.image).toBe("https://img/og.png");
  });

  it("parses EU-formatted prices (1.299,00)", () => {
    const html = `<html><head>
      <meta property="og:title" content="Euro Widget" />
      <meta property="product:price:amount" content="1.299,00" />
      <meta property="product:price:currency" content="EUR" />
      </head></html>`;
    expect(extractFromHtml(html)?.price).toBe(1299);
  });

  it("finds a Product nested under another node (mainEntity)", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "WebPage",
      name: "Listing",
      mainEntity: {
        "@type": "Product",
        name: "Nested Gadget",
        offers: { "@type": "Offer", price: 42, priceCurrency: "USD" },
      },
    })}</script>`;
    const result = extractFromHtml(html);
    expect(result?.title).toBe("Nested Gadget");
    expect(result?.price).toBe(42);
  });

  it("returns null when no product signal exists", () => {
    expect(extractFromHtml("<html><head><title>Blog</title></head></html>")).toBeNull();
  });
});
