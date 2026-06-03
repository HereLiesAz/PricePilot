import { ExtractedProduct } from "@pricepilot/shared";
import { ExtractionError, type AdapterContext, type VendorAdapter } from "../types.js";
import { fetchJson } from "../fetch.js";

const BROWSE_BASE = "https://api.ebay.com/buy/browse/v1";

/** eBay Browse API item shape (subset we use). */
export interface EbayItem {
  title?: string;
  price?: { value?: string; currency?: string };
  image?: { imageUrl?: string };
  brand?: string;
  gtin?: string;
  mpn?: string;
  estimatedAvailabilities?: { estimatedAvailabilityStatus?: string }[];
}

/** Pure mapping from an eBay Browse item to our normalized product. */
export function mapEbayItem(item: EbayItem): ExtractedProduct {
  const availability = item.estimatedAvailabilities?.[0]?.estimatedAvailabilityStatus;
  return ExtractedProduct.parse({
    title: item.title ?? "eBay item",
    price: item.price?.value ? Number(item.price.value) : null,
    currency: item.price?.currency ?? "USD",
    inStock: availability ? availability === "IN_STOCK" : null,
    image: item.image?.imageUrl ?? null,
    gtin: item.gtin ?? null,
    mpn: item.mpn ?? null,
    brand: item.brand ?? null,
    source: "api:ebay",
  });
}

/** Extract the legacy numeric item id from an eBay item URL (…/itm/123…). */
export function ebayLegacyId(url: URL): string | null {
  const match = url.pathname.match(/\/itm\/(?:.*\/)?(\d{6,})/);
  return match?.[1] ?? null;
}

export const ebayAdapter: VendorAdapter = {
  name: "ebay",
  tier: "api",
  capabilities: ["api", "browse"],
  canHandle: (url) => /(^|\.)ebay\.[a-z.]+$/i.test(url.hostname),
  isAvailable: (ctx) => Boolean(ctx.credentials.ebayOAuthToken),
  async extract(url: string, ctx: AdapterContext): Promise<ExtractedProduct> {
    if (!ctx.credentials.ebayOAuthToken) {
      throw new ExtractionError("eBay OAuth token is missing", "adapter_unavailable");
    }
    const legacyId = ebayLegacyId(new URL(url));
    if (!legacyId) {
      throw new ExtractionError(`Could not find an eBay item id in ${url}`, "bad_url");
    }
    const endpoint = `${BROWSE_BASE}/item/get_item_by_legacy_id?legacy_item_id=${legacyId}`;
    const item = await fetchJson<EbayItem>(endpoint, ctx, {
      authorization: `Bearer ${ctx.credentials.ebayOAuthToken}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    });
    return mapEbayItem(item);
  },
};
