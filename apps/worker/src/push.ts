import webpush from "web-push";
import type { PushPayload } from "@sail/shared";
import { prisma } from "@sail/db";
import type { Env } from "./env.js";

let configured = false;

/** Configure web-push with VAPID details. Returns false if keys are missing. */
export function configurePush(env: Env): boolean {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

/**
 * Send a push payload to all of a user's subscriptions. Subscriptions that the
 * push service reports as gone (404/410) are pruned.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!configured) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
  return sent;
}
