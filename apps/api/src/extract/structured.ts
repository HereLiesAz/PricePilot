import * as cheerio from "cheerio";
import { ExtractedProduct } from "@pricepilot/shared";

/**
 * Structured-data extractor (tier 2 in PLAN.md): read `schema.org/Product` +
 * `Offer` from JSON-LD, falling back to Open Graph product tags. Pure and
 * network-free so it is unit-testable against HTML fixtures; the HTTP fetch
 * lives in `fetch.ts`.
 *
 * Returns `null` when no usable product signal is found.
 */
export function extractFromHtml(html: string): ExtractedProduct | null {
  const $ = cheerio.load(html);

  const fromJsonLd = extractJsonLd($);
  const fromOg = extractOpenGraph($);

  // Prefer JSON-LD; backfill any missing fields from Open Graph.
  const merged = mergeCandidates(fromJsonLd, fromOg);
  if (!merged || !merged.title) return null;

  const parsed = ExtractedProduct.safeParse({
    title: merged.title,
    price: merged.price ?? null,
    currency: merged.currency ?? "USD",
    inStock: merged.inStock ?? null,
    image: merged.image ?? null,
    gtin: merged.gtin ?? null,
    brand: merged.brand ?? null,
  });
  return parsed.success ? parsed.data : null;
}

interface Candidate {
  title?: string;
  price?: number | null;
  currency?: string;
  inStock?: boolean | null;
  image?: string | null;
  gtin?: string | null;
  brand?: string | null;
}

function mergeCandidates(
  primary: Candidate | null,
  secondary: Candidate | null,
): Candidate | null {
  if (!primary) return secondary;
  if (!secondary) return primary;
  return {
    title: primary.title ?? secondary.title,
    price: primary.price ?? secondary.price,
    currency: primary.currency ?? secondary.currency,
    inStock: primary.inStock ?? secondary.inStock,
    image: primary.image ?? secondary.image,
    gtin: primary.gtin ?? secondary.gtin,
    brand: primary.brand ?? secondary.brand,
  };
}

// --- JSON-LD -------------------------------------------------------------

function extractJsonLd($: cheerio.CheerioAPI): Candidate | null {
  const nodes: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    try {
      collectNodes(JSON.parse(raw), nodes);
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  });

  const product = nodes.find(isProductNode) as Record<string, unknown> | undefined;
  if (!product) return null;

  const offer = pickOffer(product["offers"]);
  return {
    title: asString(product["name"]),
    brand: brandName(product["brand"]),
    image: firstImage(product["image"]),
    gtin: firstString(
      product["gtin13"],
      product["gtin12"],
      product["gtin14"],
      product["gtin8"],
      product["gtin"],
      product["mpn"],
    ),
    price: offer ? toNumber(offer["price"] ?? offer["lowPrice"]) : null,
    currency: offer ? asString(offer["priceCurrency"]) : undefined,
    inStock: offer ? availabilityToStock(offer["availability"]) : null,
  };
}

/**
 * Flatten JSON-LD into a list of object nodes, recursing through arrays, the
 * `@graph` container, and nested properties (e.g. a Product under a WebPage's
 * `mainEntity`). Outer nodes are pushed before their children so a top-level
 * Product is still preferred by `find`.
 */
function collectNodes(value: unknown, out: unknown[]): void {
  if (Array.isArray(value)) {
    for (const v of value) collectNodes(v, out);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    out.push(obj);
    for (const key of Object.keys(obj)) {
      const child = obj[key];
      if (child && typeof child === "object") collectNodes(child, out);
    }
  }
}

function isProductNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const type = (node as Record<string, unknown>)["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === "string" && t.toLowerCase() === "product");
}

function pickOffer(offers: unknown): Record<string, unknown> | null {
  if (!offers) return null;
  const list = Array.isArray(offers) ? offers : [offers];
  const obj = list.find((o) => o && typeof o === "object");
  return (obj as Record<string, unknown>) ?? null;
}

// --- Open Graph ----------------------------------------------------------

function extractOpenGraph($: cheerio.CheerioAPI): Candidate | null {
  const meta = (prop: string): string | undefined => {
    const byProperty = $(`meta[property="${prop}"]`).attr("content");
    const byName = $(`meta[name="${prop}"]`).attr("content");
    return byProperty ?? byName ?? undefined;
  };

  const priceAmount = meta("product:price:amount") ?? meta("og:price:amount");
  const availability = meta("og:availability") ?? meta("product:availability");
  const isProductPage =
    (meta("og:type") ?? "").includes("product") ||
    Boolean(priceAmount) ||
    Boolean(availability);
  // Only treat the page as a product when there is a real product signal — a
  // bare <title> alone (e.g. a blog) must not count.
  if (!isProductPage) return null;

  const title = meta("og:title") ?? ($("title").first().text().trim() || undefined);
  if (!title) return null;

  return {
    title,
    image: meta("og:image") ?? null,
    price: toNumber(priceAmount),
    currency: meta("product:price:currency") ?? meta("og:price:currency"),
    inStock: availability ? availabilityToStock(availability) : null,
    brand: meta("product:brand") ?? meta("og:brand") ?? null,
  };
}

// --- Value coercion helpers ----------------------------------------------

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    const s = asString(v);
    if (s) return s;
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;

  let cleaned = v.replace(/[^0-9.,-]/g, "");
  const hasPeriod = cleaned.includes(".");
  const hasComma = cleaned.includes(",");
  if (hasPeriod && hasComma) {
    // Whichever separator comes last is the decimal point; the other groups
    // thousands. Handles both "1,299.00" (US) and "1.299,00" (EU).
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    cleaned = cleaned.replace(",", ".");
  }
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function brandName(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (v && typeof v === "object") {
    return asString((v as Record<string, unknown>)["name"]) ?? null;
  }
  return null;
}

function firstImage(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    for (const item of v) {
      const img = firstImage(item);
      if (img) return img;
    }
    return null;
  }
  if (v && typeof v === "object") {
    return asString((v as Record<string, unknown>)["url"]) ?? null;
  }
  return null;
}

function availabilityToStock(v: unknown): boolean | null {
  const s = asString(v)?.toLowerCase();
  if (!s) return null;
  if (s.includes("instock") || s.includes("in_stock") || s.includes("in stock")) {
    return true;
  }
  if (
    s.includes("outofstock") ||
    s.includes("out_of_stock") ||
    s.includes("out of stock") ||
    s.includes("soldout")
  ) {
    return false;
  }
  return null;
}
