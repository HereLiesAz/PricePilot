import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  AlertDTO,
  CreateAlertInput,
  PushSubscriptionInput,
  VapidKeyDTO,
} from "@pricepilot/shared";
import { getDefaultUserId, prisma } from "../db.js";
import { AppError } from "../errors.js";
import { toAlertDTO } from "../mappers.js";

const ItemParams = z.object({ id: z.string().min(1), itemId: z.string().min(1) });
const AlertParams = z.object({ alertId: z.string().min(1) });

export function registerNotificationRoutes(
  fastify: FastifyInstance,
  opts: { vapidPublicKey?: string },
): void {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // --- Web Push subscriptions ------------------------------------------

  app.get("/api/push/key", { schema: { response: { 200: VapidKeyDTO } } }, async () => {
    if (!opts.vapidPublicKey) throw new AppError(503, "Web Push is not configured");
    return { publicKey: opts.vapidPublicKey };
  });

  app.post(
    "/api/push/subscribe",
    { schema: { body: PushSubscriptionInput, response: { 201: z.object({ ok: z.literal(true) }) } } },
    async (req, reply) => {
      const userId = await getDefaultUserId();
      await prisma.pushSubscription.upsert({
        where: { endpoint: req.body.endpoint },
        update: { p256dh: req.body.keys.p256dh, auth: req.body.keys.auth, userId },
        create: {
          userId,
          endpoint: req.body.endpoint,
          p256dh: req.body.keys.p256dh,
          auth: req.body.keys.auth,
        },
      });
      return reply.code(201).send({ ok: true as const });
    },
  );

  app.post(
    "/api/push/unsubscribe",
    { schema: { body: z.object({ endpoint: z.string().url() }) } },
    async (req, reply) => {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: req.body.endpoint } });
      return reply.code(204).send();
    },
  );

  // --- Alerts (per list item) ------------------------------------------

  app.get(
    "/api/lists/:id/items/:itemId/alerts",
    { schema: { params: ItemParams, response: { 200: z.array(AlertDTO) } } },
    async (req) => {
      await requireItem(req.params.id, req.params.itemId);
      const alerts = await prisma.alert.findMany({
        where: { listItemId: req.params.itemId },
        orderBy: { createdAt: "asc" },
      });
      return alerts.map(toAlertDTO);
    },
  );

  app.post(
    "/api/lists/:id/items/:itemId/alerts",
    { schema: { params: ItemParams, body: CreateAlertInput, response: { 201: AlertDTO } } },
    async (req, reply) => {
      await requireItem(req.params.id, req.params.itemId);
      const userId = await getDefaultUserId();
      const alert = await prisma.alert.create({
        data: {
          userId,
          listItemId: req.params.itemId,
          rule: req.body.rule,
          channel: req.body.channel,
          threshold: req.body.threshold ?? null,
        },
      });
      return reply.code(201).send(toAlertDTO(alert));
    },
  );

  app.delete(
    "/api/alerts/:alertId",
    { schema: { params: AlertParams } },
    async (req, reply) => {
      const userId = await getDefaultUserId();
      const alert = await prisma.alert.findFirst({ where: { id: req.params.alertId, userId } });
      if (!alert) throw new AppError(404, "Alert not found");
      await prisma.alert.delete({ where: { id: alert.id } });
      return reply.code(204).send();
    },
  );
}

async function requireItem(listId: string, itemId: string): Promise<void> {
  const userId = await getDefaultUserId();
  const item = await prisma.listItem.findFirst({
    where: { id: itemId, listId, list: { userId } },
  });
  if (!item) throw new AppError(404, "Item not found");
}
