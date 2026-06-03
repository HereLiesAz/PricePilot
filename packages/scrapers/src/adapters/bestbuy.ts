import { ExtractedProduct } from "@pricepilot/shared";
import { ExtractionError, type AdapterContext, type VendorAdapter } from "../types.js";
import { fetchJson } from "../fetch.js";

const PRODUCTS_BASE = "https://api.bestbuy.com/v1/products";

/** Best Buy products API shape (subset we use). */
export interface BestBuyProduct {
  name?: string;
  salePrice?: number;
  regularPrice?: number;
  image?: string;
  manufacturer?: string;
  upc?: string;
  modelNumber?: string;
  onlineAvailability?: boolean;
}

/** Pure mapping from a Best Buy product to our normalized product. */
export function mapBestBuyProduct(product: BestBuyProduct): ExtractedProduct {
  return ExtractedProduct.parse({
    title: product.name ?? "Best Buy product",
    price: product.salePrice ?? product.regularPrice ?? null,
    currency: "USD",
    inStock: typeof product.onlineAvailability === "boolean" ? product.onlineAvailability : null,
    image: product.image ?? null,
    gtin: product.upc ?? null,
    mpn: product.modelNumber ?? null,
    brand: product.manufacturer ?? null,
    source: "api:bestbuy",
  });
}

/** Best Buy product URLs end with `/<sku>.p`. */
export function bestBuySku(url: URL): string | null {
  const match = url.pathname.match(/\/(\d{6,})\.p/);
  return match?.[1] ?? null;
}

export const bestBuyAdapter: VendorAdapter = {
  name: "bestbuy",
  tier: "api",
  capabilities: ["api", "products"],
  canHandle: (url) => /(^|\.)bestbuy\.com$/i.test(url.hostname),
  isAvailable: (ctx) => Boolean(ctx.credentials.bestBuyApiKey),
  async extract(url: string, ctx: AdapterContext): Promise<ExtractedProduct> {
    const sku = bestBuySku(new URL(url));
    if (!sku) {
      throw new ExtractionError(`Could not find a Best Buy SKU in ${url}`, "bad_url");
    }
    const endpoint =
      `${PRODUCTS_BASE}/${sku}.json?apiKey=${ctx.credentials.bestBuyApiKey}` +
      "&show=name,salePrice,regularPrice,image,manufacturer,upc,modelNumber,onlineAvailability";
    const product = await fetchJson<BestBuyProduct>(endpoint, ctx);
    return mapBestBuyProduct(product);
  },
};
