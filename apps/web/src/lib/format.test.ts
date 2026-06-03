import { describe, expect, it } from "vitest";
import { formatPrice, timeAgo } from "./format";

describe("formatPrice", () => {
  it("formats USD amounts", () => {
    expect(formatPrice(129.99, "USD")).toBe("$129.99");
  });

  it("renders an em dash for null", () => {
    expect(formatPrice(null)).toBe("—");
  });

  it("falls back gracefully for malformed currency codes", () => {
    // A non-3-letter code makes Intl throw; we fall back to a plain rendering.
    expect(formatPrice(10, "DOLLAR")).toBe("10.00 DOLLAR");
  });
});

describe("timeAgo", () => {
  it("labels missing timestamps as never", () => {
    expect(timeAgo(null)).toBe("never");
  });

  it("labels very recent timestamps as just now", () => {
    expect(timeAgo(new Date().toISOString())).toBe("just now");
  });

  it("labels hours and days", () => {
    const threeHours = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(timeAgo(threeHours)).toBe("3h ago");
    const twoDays = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
    expect(timeAgo(twoDays)).toBe("2d ago");
  });
});
