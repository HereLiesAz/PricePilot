import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { HealthResponse } from "@pricepilot/shared";
import { corsOrigins, loadEnv, type Env } from "./env.js";
import { adapterContext } from "./adapter-context.js";
import { registerAuth } from "./auth.js";
import { registerErrorHandler } from "./errors.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerListRoutes } from "./routes/lists.js";
import { registerNotificationRoutes } from "./routes/notifications.js";

const START_TIME = Date.now();
const VERSION = process.env.npm_package_version ?? "0.0.0";

export interface BuildServerOptions {
  env?: Env;
}

/**
 * Build (but do not start) the Fastify instance. Returning the instance keeps
 * it injectable for tests via `app.inject()`.
 */
export async function buildServer(opts: BuildServerOptions = {}): Promise<FastifyInstance> {
  const env = opts.env ?? loadEnv();

  const app = Fastify({
    logger:
      env.NODE_ENV === "development"
        ? { transport: { target: "pino-pretty" } }
        : env.NODE_ENV !== "test",
  }).withTypeProvider<ZodTypeProvider>();

  // Wire zod as the validator + serializer for typed routes.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: corsOrigins(env),
    credentials: true,
  });

  // JWT auth (must register before routes that use the `authenticate` hook).
  await registerAuth(app, env.JWT_SECRET);

  app.route({
    method: "GET",
    url: "/health",
    schema: {
      response: { 200: HealthResponse },
    },
    handler: async () => {
      return {
        status: "ok" as const,
        service: "api",
        version: VERSION,
        uptime: (Date.now() - START_TIME) / 1000,
        timestamp: new Date().toISOString(),
      };
    },
  });

  // Auth (register / login / me) — public except `me`; credential routes are
  // rate-limited per IP.
  registerAuthRoutes(app, {
    rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, windowMs: env.AUTH_RATE_WINDOW_MS },
  });

  // List/item CRUD, import, price refresh, and history — backed by the tiered
  // vendor adapters in @pricepilot/scrapers.
  registerListRoutes(app, adapterContext(env));

  // Web Push subscriptions + per-item price alerts (delivered by apps/worker).
  registerNotificationRoutes(app, { vapidPublicKey: env.VAPID_PUBLIC_KEY });

  registerErrorHandler(app);

  return app;
}
