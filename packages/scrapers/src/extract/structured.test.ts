import { describe, expect, it } from "vitest";
import { extractFromHtml, toNumber } from "./structured.js";

describe("extractFromHtml (structured data)", () => {
  it("reads schema.org Product + Offer from JSON-LD", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Acme Wireless Headphones",
      brand: { "@type": "Brand", name: "Acme" },
      gtin13: "0123456789012",
      mpn: "ACME-HP",
      image: ["https://cdn.example.com/hp.jpg"],
      offers: {
        "@type": "Offer",
        price: "129.99",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    })}</script>`;
    const result = extractFromHtml(html);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Acme Wireless Headphones");
    expect(result!.brand).toBe("Acme");
    expect(result!.gtin).toBe("0123456789012");
    expect(result!.mpn).toBe("ACME-HP");
    expect(result!.price).toBe(129.99);
    expect(result!.inStock).toBe(true);
    expect(result!.source).toBe("structured-data");
  });

  it("finds a Product nested under mainEntity and handles offers arrays", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "WebPage",
      mainEntity: {
        "@type": "Product",
        name: "Nested Gadget",
        offers: [{ "@type": "Offer", price: 42, priceCurrency: "EUR" }],
      },
    })}</script>`;
    const result = extractFromHtml(html);
    expect(result?.title).toBe("Nested Gadget");
    expect(result?.price).toBe(42);
    expect(result?.currency).toBe("EUR");
  });

  it("falls back to Open Graph and parses EU-formatted prices", () => {
    const html = `<html><head>
      <meta property="og:title" content="Euro Widget" />
      <meta property="product:price:amount" content="1.299,00" />
      <meta property="product:price:currency" content="EUR" />
      <meta property="og:availability" content="instock" />
      </head></html>`;
    const result = extractFromHtml(html);
    expect(result?.title).toBe("Euro Widget");
    expect(result?.price).toBe(1299);
    expect(result?.inStock).toBe(true);
  });

  it("returns null when no product signal exists", () => {
    expect(extractFromHtml("<html><head><title>Blog</title></head></html>")).toBeNull();
  });
});

describe("toNumber", () => {
  it("parses US and EU formats and strips symbols", () => {
    expect(toNumber("$1,299.00")).toBe(1299);
    expect(toNumber("1.299,00")).toBe(1299);
    expect(toNumber("129.99")).toBe(129.99);
    expect(toNumber("nope")).toBeNull();
  });
});
