import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  AddItemInput,
  CreateListInput,
  ImportInput,
  ImportResultDTO,
  ImportWishlistInput,
  ListDetailDTO,
  ListSummaryDTO,
  OfferDTO,
  PriceHistoryDTO,
  SearchResultDTO,
  UpdateListInput,
  type ImportFailureDTO,
} from "@pricepilot/shared";
import { fetchText, parseWishlist, searchVendors, type AdapterContext } from "@pricepilot/scrapers";
import { prisma } from "../db.js";
import { currentUserId } from "../auth.js";
import { AppError } from "../errors.js";
import { parseImport } from "../import/parse.js";
import { addItemToList, refreshOffer } from "../services.js";
import {
  listDetailInclude,
  toListDetailDTO,
  toListSummaryDTO,
  toOfferDTO,
  toPriceHistoryDTO,
} from "../mappers.js";

const IdParam = z.object({ id: z.string().min(1) });
const ItemParams = z.object({ id: z.string().min(1), itemId: z.string().min(1) });
const OfferParams = z.object({ offerId: z.string().min(1) });

export function registerListRoutes(fastify: FastifyInstance, ctx: AdapterContext): void {
  // Encapsulated scope: the auth hook applies to every route registered here.
  void fastify.register(async (scope) => {
    const app = scope.withTypeProvider<ZodTypeProvider>();
    app.addHook("onRequest", fastify.authenticate);

    // --- Lists ----------------------------------------------------------

    app.get("/api/lists", { schema: { response: { 200: z.array(ListSummaryDTO) } } }, async (req) => {
      const lists = await prisma.list.findMany({
        where: { userId: currentUserId(req) },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
      });
      return lists.map(toListSummaryDTO);
    });

    app.post(
      "/api/lists",
      { schema: { body: CreateListInput, response: { 201: ListDetailDTO } } },
      async (req, reply) => {
        const list = await prisma.list.create({
          data: { userId: currentUserId(req), name: req.body.name, type: req.body.type },
          include: listDetailInclude,
        });
        return reply.code(201).send(toListDetailDTO(list));
      },
    );

    app.get(
      "/api/lists/:id",
      { schema: { params: IdParam, response: { 200: ListDetailDTO } } },
      async (req) => requireList(req.params.id, currentUserId(req)),
    );

    app.patch(
      "/api/lists/:id",
      { schema: { params: IdParam, body: UpdateListInput, response: { 200: ListDetailDTO } } },
      async (req) => {
        const userId = currentUserId(req);
        await ensureListExists(req.params.id, userId);
        await prisma.list.update({ where: { id: req.params.id }, data: req.body });
        return requireList(req.params.id, userId);
      },
    );

    app.delete("/api/lists/:id", { schema: { params: IdParam } }, async (req, reply) => {
      await ensureListExists(req.params.id, currentUserId(req));
      await prisma.list.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    });

    // --- Items ----------------------------------------------------------

    app.post(
      "/api/lists/:id/items",
      { schema: { params: IdParam, body: AddItemInput, response: { 201: ListDetailDTO } } },
      async (req, reply) => {
        const userId = currentUserId(req);
        await ensureListExists(req.params.id, userId);
        await addItemToList(req.params.id, req.body, ctx);
        return reply.code(201).send(await requireList(req.params.id, userId));
      },
    );

    app.delete(
      "/api/lists/:id/items/:itemId",
      { schema: { params: ItemParams } },
      async (req, reply) => {
        await ensureListExists(req.params.id, currentUserId(req));
        const item = await prisma.listItem.findFirst({
          where: { id: req.params.itemId, listId: req.params.id },
        });
        if (!item) throw new AppError(404, "Item not found");
        await prisma.listItem.delete({ where: { id: item.id } });
        return reply.code(204).send();
      },
    );

    // --- Bulk import ----------------------------------------------------

    app.post(
      "/api/lists/:id/import",
      { schema: { params: IdParam, body: ImportInput, response: { 200: ImportResultDTO } } },
      async (req) => {
        const userId = currentUserId(req);
        await ensureListExists(req.params.id, userId);

        let rows;
        try {
          rows = parseImport(req.body.format, req.body.data);
        } catch (err) {
          throw new AppError(400, `Could not parse import: ${(err as Error).message}`);
        }

        const failed: ImportFailureDTO[] = [];
        let added = 0;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]!;
          try {
            await addItemToList(
              req.params.id,
              { url: row.url, title: row.title, targetPrice: row.targetPrice, qty: row.qty ?? 1, notes: row.notes },
              ctx,
            );
            added++;
          } catch (err) {
            failed.push({ row: i + 1, input: row.url ?? row.title ?? "", error: (err as Error).message });
          }
        }

        return { added, failed, list: await requireList(req.params.id, userId) };
      },
    );

    app.post(
      "/api/lists/:id/import-wishlist",
      { schema: { params: IdParam, body: ImportWishlistInput, response: { 200: ImportResultDTO } } },
      async (req) => {
        const userId = currentUserId(req);
        await ensureListExists(req.params.id, userId);

        let urls: string[];
        try {
          const html = await fetchText(req.body.url, ctx);
          urls = parseWishlist(html, req.body.url);
        } catch (err) {
          throw new AppError(502, `Could not load wishlist: ${(err as Error).message}`);
        }

        const failed: ImportFailureDTO[] = [];
        let added = 0;
        // Bounded-concurrency scrape so large wishlists don't time out the request.
        const queue = urls.map((url, index) => ({ url, index }));
        const concurrency = Math.min(5, queue.length);
        await Promise.all(
          Array.from({ length: concurrency }, async () => {
            for (let item = queue.shift(); item; item = queue.shift()) {
              try {
                await addItemToList(req.params.id, { url: item.url, qty: 1 }, ctx);
                added++;
              } catch (err) {
                failed.push({ row: item.index + 1, input: item.url, error: (err as Error).message });
              }
            }
          }),
        );
        failed.sort((a, b) => a.row - b.row);
        return { added, failed, list: await requireList(req.params.id, userId) };
      },
    );

    // --- Offers ---------------------------------------------------------

    app.post(
      "/api/offers/:offerId/refresh",
      { schema: { params: OfferParams, response: { 200: OfferDTO } } },
      async (req) => {
        await ensureOfferVisible(req.params.offerId, currentUserId(req));
        try {
          await refreshOffer(req.params.offerId, ctx);
        } catch (err) {
          if ((err as Error).message === "offer_not_found") throw new AppError(404, "Offer not found");
          throw err;
        }
        const offer = await prisma.offer.findUnique({
          where: { id: req.params.offerId },
          include: { vendor: true },
        });
        return toOfferDTO(offer!);
      },
    );

    app.get(
      "/api/offers/:offerId/history",
      { schema: { params: OfferParams, response: { 200: PriceHistoryDTO } } },
      async (req) => {
        await ensureOfferVisible(req.params.offerId, currentUserId(req));
        const offer = await prisma.offer.findUnique({ where: { id: req.params.offerId } });
        if (!offer) throw new AppError(404, "Offer not found");
        const points = await prisma.priceHistory.findMany({
          where: { offerId: offer.id },
          orderBy: { ts: "asc" },
        });
        return toPriceHistoryDTO(offer.id, offer.currency, points);
      },
    );

    // --- Name-search finder ---------------------------------------------

    app.get(
      "/api/search",
      {
        schema: {
          querystring: z.object({ q: z.string().min(1).max(200) }),
          response: { 200: z.array(SearchResultDTO) },
        },
      },
      async (req) => searchVendors(req.query.q, ctx),
    );
  });
}

async function ensureListExists(id: string, userId: string): Promise<void> {
  const list = await prisma.list.findFirst({ where: { id, userId } });
  if (!list) throw new AppError(404, "List not found");
}

async function requireList(id: string, userId: string): Promise<ListDetailDTO> {
  const list = await prisma.list.findFirst({ where: { id, userId }, include: listDetailInclude });
  if (!list) throw new AppError(404, "List not found");
  return toListDetailDTO(list);
}

/** Authorize an offer for a user: they must track its product in one of their lists. */
async function ensureOfferVisible(offerId: string, userId: string): Promise<void> {
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { productId: true } });
  if (!offer) throw new AppError(404, "Offer not found");
  const item = await prisma.listItem.findFirst({
    where: { productId: offer.productId, list: { userId } },
  });
  if (!item) throw new AppError(404, "Offer not found");
}
