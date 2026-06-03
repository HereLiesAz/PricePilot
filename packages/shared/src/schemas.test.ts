import { describe, expect, it } from "vitest";
import { HealthResponse, ListType, Offer } from "./index.js";

describe("shared schemas", () => {
  it("parses a valid health response", () => {
    const parsed = HealthResponse.parse({
      status: "ok",
      service: "api",
      version: "0.0.0",
      uptime: 1.23,
      timestamp: new Date().toISOString(),
    });
    expect(parsed.status).toBe("ok");
  });

  it("rejects a health response with the wrong status", () => {
    expect(() =>
      HealthResponse.parse({
        status: "degraded",
        service: "api",
        version: "0.0.0",
        uptime: 0,
        timestamp: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it("constrains ListType to the known variants", () => {
    expect(ListType.parse("SHOPPING")).toBe("SHOPPING");
    expect(() => ListType.parse("BACKLOG")).toThrow();
  });

  it("defaults Offer currency to USD", () => {
    const cuid = "c".padEnd(25, "a");
    const offer = Offer.parse({
      id: cuid,
      productId: cuid,
      vendorId: cuid,
      url: "https://example.com/p/1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(offer.currency).toBe("USD");
  });
});
