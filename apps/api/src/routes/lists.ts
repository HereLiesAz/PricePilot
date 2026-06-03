import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  AddItemInput,
  CreateListInput,
  ImportInput,
  ImportResultDTO,
  ListDetailDTO,
  ListSummaryDTO,
  OfferDTO,
  UpdateListInput,
  type ImportFailureDTO,
} from "@pricepilot/shared";
import { getDefaultUserId, prisma } from "../db.js";
import { AppError } from "../errors.js";
import { parseImport } from "../import/parse.js";
import { addItemToList, refreshOffer } from "../services.js";
import {
  listDetailInclude,
  toListDetailDTO,
  toListSummaryDTO,
  toOfferDTO,
} from "../mappers.js";

const IdParam = z.object({ id: z.string().min(1) });
const ItemParams = z.object({ id: z.string().min(1), itemId: z.string().min(1) });
const OfferParams = z.object({ offerId: z.string().min(1) });

export function registerListRoutes(
  fastify: FastifyInstance,
  opts: { enableAmazon: boolean },
): void {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // --- Lists ------------------------------------------------------------

  app.get("/api/lists", { schema: { response: { 200: z.array(ListSummaryDTO) } } }, async () => {
    const userId = await getDefaultUserId();
    const lists = await prisma.list.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    });
    return lists.map(toListSummaryDTO);
  });

  app.post(
    "/api/lists",
    { schema: { body: CreateListInput, response: { 201: ListDetailDTO } } },
    async (req, reply) => {
      const userId = await getDefaultUserId();
      const list = await prisma.list.create({
        data: { userId, name: req.body.name, type: req.body.type },
        include: listDetailInclude,
      });
      return reply.code(201).send(toListDetailDTO(list));
    },
  );

  app.get(
    "/api/lists/:id",
    { schema: { params: IdParam, response: { 200: ListDetailDTO } } },
    async (req) => requireList(req.params.id),
  );

  app.patch(
    "/api/lists/:id",
    { schema: { params: IdParam, body: UpdateListInput, response: { 200: ListDetailDTO } } },
    async (req) => {
      await ensureListExists(req.params.id);
      await prisma.list.update({ where: { id: req.params.id }, data: req.body });
      return requireList(req.params.id);
    },
  );

  app.delete("/api/lists/:id", { schema: { params: IdParam } }, async (req, reply) => {
    await ensureListExists(req.params.id);
    await prisma.list.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });

  // --- Items ------------------------------------------------------------

  app.post(
    "/api/lists/:id/items",
    { schema: { params: IdParam, body: AddItemInput, response: { 201: ListDetailDTO } } },
    async (req, reply) => {
      await ensureListExists(req.params.id);
      await addItemToList(req.params.id, req.body, { enableAmazon: opts.enableAmazon });
      return reply.code(201).send(await requireList(req.params.id));
    },
  );

  app.delete(
    "/api/lists/:id/items/:itemId",
    { schema: { params: ItemParams } },
    async (req, reply) => {
      const item = await prisma.listItem.findFirst({
        where: { id: req.params.itemId, listId: req.params.id },
      });
      if (!item) throw new AppError(404, "Item not found");
      await prisma.listItem.delete({ where: { id: item.id } });
      return reply.code(204).send();
    },
  );

  // --- Bulk import ------------------------------------------------------

  app.post(
    "/api/lists/:id/import",
    { schema: { params: IdParam, body: ImportInput, response: { 200: ImportResultDTO } } },
    async (req) => {
      await ensureListExists(req.params.id);

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
            {
              url: row.url,
              title: row.title,
              targetPrice: row.targetPrice,
              qty: row.qty ?? 1,
              notes: row.notes,
            },
            { enableAmazon: opts.enableAmazon },
          );
          added++;
        } catch (err) {
          failed.push({ row: i + 1, input: row.url ?? row.title ?? "", error: (err as Error).message });
        }
      }

      return { added, failed, list: await requireList(req.params.id) };
    },
  );

  // --- Offers -----------------------------------------------------------

  app.post(
    "/api/offers/:offerId/refresh",
    { schema: { params: OfferParams, response: { 200: OfferDTO } } },
    async (req) => {
      try {
        await refreshOffer(req.params.offerId, { enableAmazon: opts.enableAmazon });
      } catch (err) {
        if ((err as Error).message === "offer_not_found") {
          throw new AppError(404, "Offer not found");
        }
        throw err;
      }
      const offer = await prisma.offer.findUnique({
        where: { id: req.params.offerId },
        include: { vendor: true },
      });
      return toOfferDTO(offer!);
    },
  );
}

async function ensureListExists(id: string): Promise<void> {
  const userId = await getDefaultUserId();
  const list = await prisma.list.findFirst({ where: { id, userId } });
  if (!list) throw new AppError(404, "List not found");
}

async function requireList(id: string): Promise<ListDetailDTO> {
  const list = await prisma.list.findUnique({ where: { id }, include: listDetailInclude });
  if (!list) throw new AppError(404, "List not found");
  return toListDetailDTO(list);
}
