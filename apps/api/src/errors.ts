import type { FastifyError, FastifyInstance } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { ExtractionError } from "@pricepilot/scrapers";

/** Application-level error carrying an HTTP status code. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function extractionStatus(code: ExtractionError["code"]): number {
  switch (code) {
    case "bad_url":
      return 400;
    case "robots_disallowed":
      return 403;
    case "amazon_disabled":
    case "no_product_data":
    case "adapter_unavailable":
      return 422;
    case "fetch_failed":
      return 502;
  }
}

/**
 * Central error handler. Throwing from handlers keeps route bodies aligned with
 * their zod success-response schema (the type provider constrains `reply.send`).
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, req, reply) => {
    if (error instanceof ExtractionError) {
      return reply.code(extractionStatus(error.code)).send({ message: error.message, code: error.code });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ message: error.message });
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({ message: "Validation error", issues: error.validation });
    }
    const status = error.statusCode ?? 500;
    if (status >= 500) req.log.error(error);
    return reply
      .code(status)
      .send({ message: status >= 500 ? "Internal server error" : error.message });
  });
}
