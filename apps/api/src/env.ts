import { z } from "zod";

/**
 * Validate the subset of environment variables the API needs at boot.
 * Fails fast with a readable error if something is misconfigured.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  // Comma-separated list of allowed CORS origins for the web app.
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Postgres connection string (see infra/docker-compose.yml / .env.example).
  DATABASE_URL: z.string().optional(),
  // Amazon adapter is opt-in / off-by-default (ToS risk; see PLAN.md).
  ENABLE_AMAZON_ADAPTER: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGIN.split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}
