export * from "./types.js";
export { vendorDomain, fetchText, fetchJson, USER_AGENT } from "./fetch.js";
export { extractFromHtml } from "./extract/structured.js";
export { structuredDataAdapter } from "./adapters/structured-data.js";
export { playwrightAdapter } from "./adapters/playwright.js";
export { claudeAdapter } from "./adapters/claude.js";
export { amazonAdapter } from "./adapters/amazon.js";
export { parseWishlist } from "./wishlist.js";
export { ebayAdapter, mapEbayItem, ebayLegacyId } from "./adapters/ebay.js";
export { bestBuyAdapter, mapBestBuyProduct, bestBuySku } from "./adapters/bestbuy.js";
export {
  allAdapters,
  apiAdapters,
  fallbackAdapters,
  resolveAdapter,
  extractOffer,
} from "./registry.js";
export { searchVendors, mapEbaySearch, mapBestBuySearch } from "./search.js";
