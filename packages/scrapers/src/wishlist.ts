import * as cheerio from "cheerio";

/**
 * Wishlist importer (PLAN.md import flow): extract product URLs from a wishlist
 * / list page. Reads JSON-LD `ItemList` plus anchors that look like product
 * links. Pure and unit-testable; the consumer fetches each URL through the
 * normal adapter tiers. Starts with structured-data-friendly vendors.
 */

const PRODUCT_PATH = /\/(?:dp|gp\/product|itm|product|products|p)\//i;
const BESTBUY_PATH = /\/\d{6,}\.p\b/i;

export function parseWishlist(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  const add = (href: string | undefined): void => {
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl);
      if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
      if (PRODUCT_PATH.test(abs.pathname) || BESTBUY_PATH.test(abs.pathname)) {
        abs.hash = "";
        urls.add(abs.toString());
      }
    } catch {
      // Ignore unparseable hrefs.
    }
  };

  // JSON-LD ItemList → itemListElement[].url / .item.url
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw.trim()) return;
    try {
      collectListUrls(JSON.parse(raw), add);
    } catch {
      // Ignore malformed JSON-LD.
    }
  });

  // Anchor fallback.
  $("a[href]").each((_, el) => add($(el).attr("href")));

  return [...urls].slice(0, 100);
}

function collectListUrls(value: unknown, add: (href: string | undefined) => void): void {
  if (Array.isArray(value)) {
    for (const v of value) collectListUrls(v, add);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj["url"] === "string") add(obj["url"]);
    const item = obj["item"];
    if (item && typeof item === "object" && typeof (item as Record<string, unknown>)["url"] === "string") {
      add((item as Record<string, unknown>)["url"] as string);
    }
    for (const key of Object.keys(obj)) {
      const child = obj[key];
      if (child && typeof child === "object") collectListUrls(child, add);
    }
  }
}
