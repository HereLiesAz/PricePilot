import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { ListDetailDTO, ListSummaryDTO, PriceHistoryDTO } from "@pricepilot/shared";
import { buildServer } from "../src/server.js";
import { prisma } from "../src/db.js";

/**
 * Integration tests for the list/item CRUD loop. They need a real Postgres, so
 * they are skipped unless DATABASE_URL is set (CI provides a Postgres service;
 * locally, infra/docker-compose.yml does). Network-dependent add-by-URL is
 * covered by the extractor unit tests instead — here we use manual items.
 */
describe.skipIf(!process.env.DATABASE_URL)("lists API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer({
      env: {
        NODE_ENV: "test",
        API_HOST: "0.0.0.0",
        API_PORT: 3001,
        CORS_ORIGIN: "http://localhost:5173",
        DATABASE_URL: process.env.DATABASE_URL,
        ENABLE_AMAZON_ADAPTER: false,
        ENABLE_PLAYWRIGHT: false,
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean slate; order respects FK constraints.
    await prisma.priceHistory.deleteMany();
    await prisma.scrapeJob.deleteMany();
    await prisma.offer.deleteMany();
    await prisma.listItem.deleteMany();
    await prisma.list.deleteMany();
    await prisma.product.deleteMany();
    await prisma.vendor.deleteMany();
  });

  async function createList(name = "Holiday gifts") {
    const res = await app.inject({
      method: "POST",
      url: "/api/lists",
      payload: { name, type: "WISHLIST" },
    });
    expect(res.statusCode).toBe(201);
    return ListDetailDTO.parse(res.json());
  }

  it("creates, lists, and fetches a list", async () => {
    const created = await createList();
    expect(created.name).toBe("Holiday gifts");
    expect(created.type).toBe("WISHLIST");

    const listRes = await app.inject({ method: "GET", url: "/api/lists" });
    expect(listRes.statusCode).toBe(200);
    const summaries = ListSummaryDTO.array().parse(listRes.json());
    expect(summaries.map((l) => l.id)).toContain(created.id);

    const getRes = await app.inject({ method: "GET", url: `/api/lists/${created.id}` });
    expect(getRes.statusCode).toBe(200);
  });

  it("adds a manual item and reflects it in item count", async () => {
    const list = await createList();
    const res = await app.inject({
      method: "POST",
      url: `/api/lists/${list.id}/items`,
      payload: { title: "Standing desk", targetPrice: 300, qty: 1 },
    });
    expect(res.statusCode).toBe(201);
    const detail = ListDetailDTO.parse(res.json());
    expect(detail.items).toHaveLength(1);
    expect(detail.items[0]!.product.normalizedTitle).toBe("Standing desk");
    expect(detail.items[0]!.targetPrice).toBe(300);
    expect(detail.items[0]!.bestOffer).toBeNull();
  });

  it("bulk-imports title rows from CSV", async () => {
    const list = await createList();
    const res = await app.inject({
      method: "POST",
      url: `/api/lists/${list.id}/import`,
      payload: { format: "csv", data: "title\nThing A\nThing B" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.added).toBe(2);
    expect(body.list.items).toHaveLength(2);
  });

  it("deletes a list item", async () => {
    const list = await createList();
    const addRes = await app.inject({
      method: "POST",
      url: `/api/lists/${list.id}/items`,
      payload: { title: "Removable" },
    });
    const detail = ListDetailDTO.parse(addRes.json());
    const itemId = detail.items[0]!.id;

    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/lists/${list.id}/items/${itemId}`,
    });
    expect(delRes.statusCode).toBe(204);

    const getRes = await app.inject({ method: "GET", url: `/api/lists/${list.id}` });
    expect(ListDetailDTO.parse(getRes.json()).items).toHaveLength(0);
  });

  it("returns 404 for a missing list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/lists/does-not-exist" });
    expect(res.statusCode).toBe(404);
  });

  it("returns an offer's price history with lowest/median/latest", async () => {
    // Seed a product + vendor + offer + history directly (no network).
    const product = await prisma.product.create({ data: { normalizedTitle: "Tracked" } });
    const vendor = await prisma.vendor.create({
      data: { name: "shop", domain: "shop.example", adapter: "structured-data" },
    });
    const offer = await prisma.offer.create({
      data: { productId: product.id, vendorId: vendor.id, url: "https://shop.example/p", currency: "USD" },
    });
    for (const price of [120, 100, 110]) {
      await prisma.priceHistory.create({ data: { offerId: offer.id, price, currency: "USD" } });
    }

    const res = await app.inject({ method: "GET", url: `/api/offers/${offer.id}/history` });
    expect(res.statusCode).toBe(200);
    const history = PriceHistoryDTO.parse(res.json());
    expect(history.points).toHaveLength(3);
    expect(history.lowest).toBe(100);
    expect(history.median).toBe(110);
    expect(history.latest).toBe(110);
  });
});
