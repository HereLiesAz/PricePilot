import type { SearchResultDTO } from "@pricepilot/shared";
import type { AdapterContext } from "./types.js";
import { fetchJson } from "./fetch.js";
import type { EbayItem } from "./adapters/ebay.js";
import type { BestBuyProduct } from "./adapters/bestbuy.js";

/**
 * Name-search finder (PLAN.md import flow): query API-backed vendors and return
 * candidate products the user can pick from. Pure mappers are unit-tested; the
 * network calls are gated on credentials.
 */

interface EbaySearchResponse {
  itemSummaries?: (EbayItem & { itemWebUrl?: string })[];
}
interface BestBuySearchResponse {
  products?: (BestBuyProduct & { url?: string })[];
}

export function mapEbaySearch(res: EbaySearchResponse): SearchResultDTO[] {
  return (res.itemSummaries ?? [])
    .filter((i) => i.itemWebUrl && i.title)
    .map((i) => ({
      title: i.title!,
      price: i.price?.value ? Number(i.price.value) : null,
      currency: i.price?.currency ?? "USD",
      image: i.image?.imageUrl ?? null,
      url: i.itemWebUrl!,
      vendor: "ebay.com",
      gtin: i.gtin ?? null,
    }));
}

export function mapBestBuySearch(res: BestBuySearchResponse): SearchResultDTO[] {
  return (res.products ?? [])
    .filter((p) => p.url && p.name)
    .map((p) => ({
      title: p.name!,
      price: p.salePrice ?? p.regularPrice ?? null,
      currency: "USD",
      image: p.image ?? null,
      url: p.url!,
      vendor: "bestbuy.com",
      gtin: p.upc ?? null,
    }));
}

/** Query every available API vendor for `query` and merge the candidates. */
export async function searchVendors(
  query: string,
  ctx: AdapterContext,
  limit = 5,
): Promise<SearchResultDTO[]> {
  const q = query.trim();
  if (!q) return [];
  const results: SearchResultDTO[] = [];

  if (ctx.credentials.ebayOAuthToken) {
    try {
      const res = await fetchJson<EbaySearchResponse>(
        `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=${limit}`,
        ctx,
        {
          authorization: `Bearer ${ctx.credentials.ebayOAuthToken}`,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        },
      );
      results.push(...mapEbaySearch(res));
    } catch {
      // Skip a failing vendor; return whatever else succeeded.
    }
  }

  if (ctx.credentials.bestBuyApiKey) {
    try {
      const res = await fetchJson<BestBuySearchResponse>(
        `https://api.bestbuy.com/v1/products(search=${encodeURIComponent(q)})?apiKey=${ctx.credentials.bestBuyApiKey}` +
          `&format=json&pageSize=${limit}&show=name,salePrice,regularPrice,image,url,upc`,
        ctx,
      );
      results.push(...mapBestBuySearch(res));
    } catch {
      // Skip a failing vendor.
    }
  }

  return results;
}
